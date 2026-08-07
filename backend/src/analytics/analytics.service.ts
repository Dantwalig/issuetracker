import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Pure computation layer (no DB access → unit-testable) ────────────────────

export interface IssueLike {
  id: string;
  status: string;
  storyPoints: number | null;
  completedAt?: Date | null;
  updatedAt: Date;
  assigneeId?: string | null;
  deadline?: Date | null;
}

export interface SprintLike {
  id: string;
  name: string;
  status: string;
  startDate?: Date | null;
  endDate?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  issues: IssueLike[];
}

const sumSP = (issues: IssueLike[]) =>
  issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

/**
 * When an issue was actually completed.
 * `completedAt` is authoritative once Task 1's backfill has run; before that
 * we fall back to `updatedAt` (last edit — the pre-analytics approximation).
 */
export function completionTime(issue: IssueLike): Date | null {
  if (issue.status !== 'DONE') return null;
  return issue.completedAt ?? issue.updatedAt;
}

export function buildVelocitySeries(sprints: SprintLike[]) {
  const sorted = [...sprints].sort(
    (a, b) =>
      (b.completedAt ?? b.updatedAt).getTime() - (a.completedAt ?? a.updatedAt).getTime(),
  );

  const rows = sorted.map((s) => {
    const all = s.issues;
    const done = all.filter((i) => i.status === 'DONE');
    // Issues that finished before the sprint actually ended (completedAt,
    // else endDate, else last update) count toward this sprint's delivery.
    const cutoff = s.completedAt ?? s.endDate ?? s.updatedAt;
    const completedInSprint = done.filter(
      (i) => completionTime(i) !== null && completionTime(i)!.getTime() <= cutoff.getTime(),
    );
    return {
      sprintId: s.id,
      name: s.name,
      endDate: s.completedAt ?? s.endDate ?? null,
      plannedSP: sumSP(all),
      deliveredSP: sumSP(done),
      completedInSprintSP: sumSP(completedInSprint),
    };
  });

  const lastThree = rows.slice(0, 3);
  const averageVelocity =
    lastThree.length > 0
      ? Math.round(
          lastThree.reduce((sum, r) => sum + r.completedInSprintSP, 0) /
            lastThree.length,
        )
      : null;

  return { sprints: rows, averageVelocity };
}

export interface BurndownPoint {
  date: string; // YYYY-MM-DD
  remainingSP: number;
  idealSP: number;
}

export function buildBurndownSeries(
  sprint: SprintLike,
  today: Date = new Date(),
): { plannedSP: number; completedSP: number; series: BurndownPoint[] } {
  const plannedSP = sumSP(sprint.issues);

  const start = sprint.startDate ?? sprint.createdAt;
  // The planned endDate defines the burndown window; completedAt only fills in
  // when no endDate was set. Active sprints clamp to today.
  const rawEnd = sprint.endDate ?? sprint.completedAt;
  const end = rawEnd && rawEnd.getTime() < today.getTime() ? rawEnd : today;
  if (end.getTime() <= start.getTime()) {
    // Degenerate window: single point at start with everything remaining.
    return {
      plannedSP,
      completedSP: 0,
      series: [
        {
          date: start.toISOString().slice(0, 10),
          remainingSP: plannedSP,
          idealSP: plannedSP,
        },
      ],
    };
  }

  const spanDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays < 1) {
    return {
      plannedSP,
      completedSP: 0,
      series: [
        {
          date: start.toISOString().slice(0, 10),
          remainingSP: plannedSP,
          idealSP: plannedSP,
        },
      ],
    };
  }
  const totalDays = Math.max(1, Math.round(spanDays));
  const series: BurndownPoint[] = [];

  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(start.getTime() + day * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const doneByDay = sprint.issues.filter(
      (i) =>
        completionTime(i) !== null &&
        completionTime(i)!.getTime() <= dayEnd.getTime(),
    );
    const remainingSP = plannedSP - sumSP(doneByDay);

    series.push({
      date: date.toISOString().slice(0, 10),
      remainingSP,
      idealSP: Math.round(plannedSP * (1 - day / totalDays)),
    });
  }

  return {
    plannedSP,
    completedSP: plannedSP - (series[series.length - 1]?.remainingSP ?? plannedSP),
    series,
  };
}

export interface WorkloadRow {
  userId: string;
  fullName: string;
  activeSprintSP: number;
  openIssues: number;
  overdue: number;
  utilization: number; // 0..n, activeSprintSP / capacity
}

export function buildWorkloadReport(
  members: { userId: string; fullName: string }[],
  activeSprintIssues: IssueLike[],
  backlogIssues: IssueLike[],
  capacity = 10,
) {
  const now = new Date();

  const rows: WorkloadRow[] = members.map((m) => {
    const assigned = activeSprintIssues.filter((i) => i.assigneeId === m.userId);
    const open = assigned.filter((i) => i.status !== 'DONE');
    return {
      userId: m.userId,
      fullName: m.fullName,
      activeSprintSP: sumSP(assigned),
      openIssues: open.length,
      overdue: open.filter(
        (i) => i.deadline !== null && i.deadline !== undefined && i.deadline.getTime() < now.getTime(),
      ).length,
      utilization: capacity === 0 ? 0 : Math.round((sumSP(assigned) / capacity) * 100) / 100,
    };
  });

  const unassigned = activeSprintIssues.filter((i) => !i.assigneeId);
  const backlogSP = sumSP(backlogIssues);

  return {
    capacity,
    members: rows.sort((a, b) => b.activeSprintSP - a.activeSprintSP),
    unassigned: { count: unassigned.length, sp: sumSP(unassigned) },
    backlogSP,
    backlogCount: backlogIssues.length,
  };
}

// ── NestJS service ───────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertProjectAccess(projectId: string, userId: string, userRole: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  /** GET /projects/:projectId/analytics/velocity */
  async getVelocity(projectId: string, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const sprints = await this.prisma.sprint.findMany({
      where: { projectId, status: 'COMPLETED' },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        issues: { select: { id: true, status: true, storyPoints: true, updatedAt: true } },
      },
    });

    return buildVelocitySeries(sprints);
  }

  /** GET /projects/:projectId/analytics/burndown?sprintId=… */
  async getBurndown(projectId: string, sprintId: string, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        name: true,
        projectId: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        issues: { select: { id: true, status: true, storyPoints: true, updatedAt: true } },
      },
    });
    if (!sprint || sprint.projectId !== projectId) {
      throw new NotFoundException('Sprint not found in this project');
    }

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      ...buildBurndownSeries(sprint),
    };
  }

  /** GET /projects/:projectId/analytics/workload */
  async getWorkload(projectId: string, userId: string, userRole: string) {
    const project = await this.assertProjectAccess(projectId, userId, userRole);

    const memberIds = project.members.map((m) => m.userId);
    const members = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, fullName: true },
    });

    const activeSprint = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        issues: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
            assigneeId: true,
            deadline: true,
            updatedAt: true,
          },
        },
      },
    });

    const backlog = await this.prisma.issue.findMany({
      where: { projectId, sprintId: null },
      select: { id: true, storyPoints: true, status: true, updatedAt: true },
    });

    return {
      activeSprint: activeSprint
        ? { id: activeSprint.id, name: activeSprint.name }
        : null,
      ...buildWorkloadReport(
        members.map((m) => ({ userId: m.id, fullName: m.fullName })),
        activeSprint?.issues ?? [],
        backlog,
      ),
    };
  }
}
