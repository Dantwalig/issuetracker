import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { TeamLeadService } from '../common/team-lead.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';

const sprintSelect = {
  id: true,
  name: true,
  projectId: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { issues: true } },
};

const issueSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  status: true,
  priority: true,
  assigneeId: true,
  reporterId: true,
  projectId: true,
  sprintId: true,
  backlogOrder: true,
  createdAt: true,
  updatedAt: true,
  reporter: { select: { id: true, fullName: true, email: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  project: { select: { id: true, name: true } },
};

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
    private readonly teamLead: TeamLeadService,
  ) {}

  // ── Access control ─────────────────────────────────────────────────────────

  private async assertProjectAccess(
    projectId: string,
    userId: string,
    userRole: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember)
        throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  private assertAdminOrForbid(userRole: string, action: string) {
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      throw new ForbiddenException(`Only admins can ${action}`);
    }
  }

  /**
   * Passes if the user is an ADMIN/SUPERADMIN **or** a Team Lead for the given project.
   */
  private async assertAdminOrTeamLead(
    userRole: string,
    userId: string,
    projectId: string,
    action: string,
  ): Promise<void> {
    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') return;
    const isLead = await this.teamLead.isProjectTeamLead(userId, projectId);
    if (!isLead) {
      throw new ForbiddenException(`Only admins or team leads can ${action}`);
    }
  }

  private async getSprintAndAssertAccess(
    sprintId: string,
    userId: string,
    userRole: string,
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);
    await this.assertProjectAccess(sprint.projectId, userId, userRole);
    return sprint;
  }

  private async getProjectMemberIds(projectId: string): Promise<string[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(projectId: string, dto: CreateSprintDto, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);
    await this.assertAdminOrTeamLead(userRole, userId, projectId, 'create sprints');
    return this.prisma.sprint.create({
      data: {
        name: dto.name,
        projectId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: 'DRAFT',
      },
      select: sprintSelect,
    });
  }

  async findByProject(projectId: string, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);
    return this.prisma.sprint.findMany({
      where: { projectId },
      select: sprintSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(sprintId: string, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);
    return this.prisma.sprint.findUnique({ where: { id: sprint.id }, select: sprintSelect });
  }

  async update(sprintId: string, dto: UpdateSprintDto, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);
    await this.assertAdminOrTeamLead(userRole, userId, sprint.projectId, 'edit sprints');
    if (sprint.status === 'COMPLETED') {
      throw new BadRequestException('Cannot edit a completed sprint');
    }
    return this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
      },
      select: sprintSelect,
    });
  }

  async deleteSprint(sprintId: string, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);
    await this.assertAdminOrTeamLead(userRole, userId, sprint.projectId, 'delete sprints');
    if (sprint.status !== 'DRAFT') {
      throw new BadRequestException('Only draft sprints can be deleted');
    }
    await this.prisma.sprint.delete({ where: { id: sprintId } });
  }

  // ── Transitions ────────────────────────────────────────────────────────────

  async startSprint(sprintId: string, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);
    await this.assertAdminOrTeamLead(userRole, userId, sprint.projectId, 'start sprints');

    if (sprint.status !== 'DRAFT') {
      throw new BadRequestException(`Sprint is already ${sprint.status.toLowerCase()}`);
    }

    const alreadyActive = await this.prisma.sprint.findFirst({
      where: { projectId: sprint.projectId, status: 'ACTIVE' },
    });
    if (alreadyActive) {
      throw new ConflictException('Another sprint is already active in this project');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: sprint.projectId },
      select: { name: true },
    });

    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: { status: 'ACTIVE' },
      select: sprintSelect,
    });

    const memberIds = await this.getProjectMemberIds(sprint.projectId);
    await this.notifications.createMany(
      memberIds.map((uid) => ({
        userId: uid,
        type: 'SPRINT_STARTED' as const,
        title: `Sprint "${sprint.name}" started`,
        message: `Sprint "${sprint.name}" is now active in ${project?.name ?? 'your project'}`,
        projectId: sprint.projectId,
      })),
    );

    this.activity.log({
      projectId: sprint.projectId,
      userId,
      action: 'SPRINT_STARTED',
      detail: sprint.name,
    });

    return updated;
  }

  async completeSprint(sprintId: string, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);
    await this.assertAdminOrTeamLead(userRole, userId, sprint.projectId, 'complete sprints');

    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestException('Only an active sprint can be completed');
    }

    const backlogMax = await this.prisma.issue.aggregate({
      where: { projectId: sprint.projectId, sprintId: null },
      _max: { backlogOrder: true },
    });
    let nextOrder = (backlogMax._max.backlogOrder ?? -1) + 1;

    const unfinished = await this.prisma.issue.findMany({
      where: { sprintId, status: { not: 'DONE' } },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.sprint.update({ where: { id: sprintId }, data: { status: 'COMPLETED' } }),
      ...unfinished.map((issue, i) =>
        this.prisma.issue.update({
          where: { id: issue.id },
          data: { sprintId: null, backlogOrder: nextOrder + i },
        }),
      ),
    ]);

    const project = await this.prisma.project.findUnique({
      where: { id: sprint.projectId },
      select: { name: true },
    });

    const memberIds = await this.getProjectMemberIds(sprint.projectId);
    await this.notifications.createMany(
      memberIds.map((uid) => ({
        userId: uid,
        type: 'SPRINT_COMPLETED' as const,
        title: `Sprint "${sprint.name}" completed`,
        message: `Sprint "${sprint.name}" has been completed in ${project?.name ?? 'your project'}. ${unfinished.length} issue(s) returned to backlog.`,
        projectId: sprint.projectId,
      })),
    );

    this.activity.log({
      projectId: sprint.projectId,
      userId,
      action: 'SPRINT_COMPLETED',
      detail: `${sprint.name} — ${unfinished.length} issue(s) returned to backlog`,
    });

    return this.prisma.sprint.findUnique({ where: { id: sprintId }, select: sprintSelect });
  }

  // ── Sprint issues ──────────────────────────────────────────────────────────

  async getSprintIssues(sprintId: string, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);
    return this.prisma.issue.findMany({
      where: { sprintId: sprint.id },
      select: issueSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async addIssueToSprint(
    projectId: string,
    sprintId: string,
    issueId: string,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);
    await this.assertAdminOrTeamLead(userRole, userId, projectId, 'add issues to sprints');

    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || sprint.projectId !== projectId) {
      throw new NotFoundException('Sprint not found in this project');
    }
    if (sprint.status === 'COMPLETED') {
      throw new BadRequestException('Cannot add issues to a completed sprint');
    }

    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found in this project');
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: { sprintId, backlogOrder: null },
      select: issueSelect,
    });
  }

  async removeIssueFromSprint(
    projectId: string,
    sprintId: string,
    issueId: string,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);
    await this.assertAdminOrTeamLead(userRole, userId, projectId, 'remove issues from sprints');

    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found in this project');
    }
    if (issue.sprintId !== sprintId) {
      throw new NotFoundException('Issue does not belong to this sprint');
    }

    const backlogMax = await this.prisma.issue.aggregate({
      where: { projectId, sprintId: null },
      _max: { backlogOrder: true },
    });
    const nextOrder = (backlogMax._max.backlogOrder ?? -1) + 1;

    return this.prisma.issue.update({
      where: { id: issueId },
      data: { sprintId: null, backlogOrder: nextOrder },
      select: issueSelect,
    });
  }
}
