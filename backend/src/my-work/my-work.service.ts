import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const issueSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  priority: true,
  deadline: true,
  storyPoints: true,
  projectId: true,
  sprintId: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
  sprint: { select: { id: true, name: true, status: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  reporter: { select: { id: true, fullName: true, email: true } },
};

@Injectable()
export class MyWorkService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const now = new Date();

    // Issues assigned to me (not done)
    const assignedIssues = await this.prisma.issue.findMany({
      where: { assigneeId: userId, status: { not: 'DONE' } },
      select: issueSelect,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });

    // Issues I reported (not done)
    const reportedIssues = await this.prisma.issue.findMany({
      where: {
        reporterId: userId,
        assigneeId: { not: userId }, // exclude double-counted
        status: { not: 'DONE' },
      },
      select: issueSelect,
      orderBy: { updatedAt: 'desc' },
      take: 15,
    });

    // Overdue: assigned to me, not done, deadline in the past
    const overdueIssues = assignedIssues.filter(
      (i) => i.deadline && new Date(i.deadline) < now,
    );

    // Active sprints I'm part of (have assigned issues in them)
    const activeSprints = await this.prisma.sprint.findMany({
      where: {
        status: 'ACTIVE',
        issues: { some: { assigneeId: userId } },
      },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { issues: true } },
        issues: {
          where: { assigneeId: userId },
          select: { id: true, status: true },
        },
      },
    });

    // Recent activity on my issues (last 30 events)
    const recentActivity = await this.prisma.activity.findMany({
      where: {
        OR: [
          { userId },
          { issue: { assigneeId: userId } },
          { issue: { reporterId: userId } },
        ],
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        issue: { select: { id: true, title: true, projectId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Completed issues (mine, last 7 days) — sense of progress
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentlyCompleted = await this.prisma.issue.findMany({
      where: {
        assigneeId: userId,
        status: 'DONE',
        updatedAt: { gte: sevenDaysAgo },
      },
      select: issueSelect,
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    // Stats summary
    const totalAssigned = await this.prisma.issue.count({ where: { assigneeId: userId, status: { not: 'DONE' } } });
    const totalInProgress = await this.prisma.issue.count({ where: { assigneeId: userId, status: 'IN_PROGRESS' } });
    const totalTodo = await this.prisma.issue.count({ where: { assigneeId: userId, status: 'TODO' } });
    const totalDoneThisWeek = recentlyCompleted.length;
    const totalOverdue = overdueIssues.length;

    return {
      stats: {
        totalAssigned,
        totalInProgress,
        totalTodo,
        totalDoneThisWeek,
        totalOverdue,
      },
      assignedIssues,
      overdueIssues,
      reportedIssues,
      activeSprints: activeSprints.map((s) => ({
        ...s,
        myIssueCount: s.issues.length,
        myDoneCount: s.issues.filter((i) => i.status === 'DONE').length,
      })),
      recentActivity,
      recentlyCompleted,
    };
  }
}
