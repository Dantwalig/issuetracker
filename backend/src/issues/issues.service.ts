import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';
import { randomBytes } from 'crypto';

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
  storyPoints: true,
  deadline: true,
  shareToken: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  reporter: {
    select: { id: true, fullName: true, email: true },
  },
  assignee: {
    select: { id: true, fullName: true, email: true },
  },
  project: {
    select: { id: true, name: true },
  },
};

// Public share view — no sensitive IDs, no project members
const shareSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  status: true,
  priority: true,
  storyPoints: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  reporter: { select: { fullName: true } },
  assignee: { select: { fullName: true } },
  project: { select: { name: true } },
};

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
  ) {}

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

  async create(dto: CreateIssueDto, reporterId: string, userRole: string) {
    await this.assertProjectAccess(dto.projectId, reporterId, userRole);

    const backlogMax = await this.prisma.issue.aggregate({
      where: { projectId: dto.projectId, sprintId: null },
      _max: { backlogOrder: true },
    });
    const backlogOrder = (backlogMax._max.backlogOrder ?? -1) + 1;

    const issue = await this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        status: dto.status,
        priority: dto.priority,
        storyPoints: dto.storyPoints,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        assigneeId: dto.assigneeId,
        projectId: dto.projectId!,
        reporterId,
        createdById: reporterId,
        backlogOrder,
      },
      select: issueSelect,
    });

    if (issue.assigneeId && issue.assigneeId !== reporterId) {
      await this.notifications.create({
        userId: issue.assigneeId,
        type: 'ISSUE_ASSIGNED',
        title: 'Issue assigned to you',
        message: `You were assigned to "${issue.title}" in ${issue.project?.name ?? 'a project'}`,
        issueId: issue.id,
        projectId: issue.projectId,
      });
    }

    this.activity.log({
      projectId: issue.projectId,
      userId: reporterId,
      action: 'ISSUE_CREATED',
      issueId: issue.id,
      detail: issue.title,
    });

    return issue;
  }

  async findByProject(projectId: string, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);
    return this.prisma.issue.findMany({
      where: { projectId },
      select: issueSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      select: issueSelect,
    });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);
    return issue;
  }

  async update(id: string, dto: UpdateIssueDto, userId: string, userRole: string) {
    const before = await this.prisma.issue.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(before.projectId, userId, userRole);

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
    const isReporter = before.reporterId === userId;
    const isAssignee = before.assigneeId === userId;
    const isUnassigned = before.assigneeId === null;

    // For status-only updates: assignee, reporter, admin, OR any project member
    // if the issue is unassigned (so members can self-assign/claim tasks).
    // For full edits: only reporter or admin.
    const canUpdateStatus = isAdmin || isReporter || isAssignee || isUnassigned;

    if (!canUpdateStatus) {
      throw new ForbiddenException(
        'You can only edit issues you reported or are assigned to',
      );
    }

    // Non-admins who are not the reporter may only update status.
    if (!isAdmin && !isReporter) {
      const { status, ...otherFields } = dto;
      const hasOtherChanges = Object.keys(otherFields).some(
        (k) => (otherFields as any)[k] !== undefined,
      );
      if (hasOtherChanges) {
        throw new ForbiddenException('Assignees can only update the issue status');
      }
    }

    const updateData: any = { ...dto };
    if (dto.deadline === null) {
      updateData.deadline = null;
    } else if (dto.deadline) {
      updateData.deadline = new Date(dto.deadline);
    } else {
      delete updateData.deadline;
    }
    if (dto.storyPoints === null) {
      updateData.storyPoints = null;
    } else if (dto.storyPoints === undefined) {
      delete updateData.storyPoints;
    }

    const issue = await this.prisma.issue.update({
      where: { id },
      data: updateData,
      select: issueSelect,
    });

    const assigneeChanged =
      dto.assigneeId !== undefined && dto.assigneeId !== before.assigneeId;
    if (assigneeChanged && issue.assigneeId && issue.assigneeId !== userId) {
      await this.notifications.create({
        userId: issue.assigneeId,
        type: 'ISSUE_ASSIGNED',
        title: 'Issue assigned to you',
        message: `You were assigned to "${issue.title}" in ${issue.project?.name ?? 'a project'}`,
        issueId: issue.id,
        projectId: issue.projectId,
      });
      this.activity.log({
        projectId: issue.projectId,
        userId,
        action: 'ISSUE_ASSIGNED',
        issueId: issue.id,
        detail: issue.title,
      });
    }

    if (dto.status && dto.status !== before.status) {
      this.activity.log({
        projectId: issue.projectId,
        userId,
        action: 'ISSUE_STATUS_CHANGED',
        issueId: issue.id,
        detail: `${before.status} → ${dto.status}`,
      });
    } else {
      this.activity.log({
        projectId: issue.projectId,
        userId,
        action: 'ISSUE_UPDATED',
        issueId: issue.id,
        detail: issue.title,
      });
    }

    return issue;
  }

  async remove(id: string, userId: string, userRole: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);
    if (
      issue.reporterId !== userId &&
      userRole !== 'ADMIN' &&
      userRole !== 'SUPERADMIN'
    ) {
      throw new ForbiddenException(
        'Only the reporter or an admin can delete this issue',
      );
    }

    this.activity.log({
      projectId: issue.projectId,
      userId,
      action: 'ISSUE_DELETED',
      detail: issue.title,
    });

    await this.prisma.issue.delete({ where: { id } });
  }

  // ── Share token ──────────────────────────────────────────────────────────

  async generateShareToken(
    issueId: string,
    userId: string,
    userRole: string,
  ): Promise<{ shareToken: string }> {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException(`Issue ${issueId} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);

    if (issue.shareToken) return { shareToken: issue.shareToken };

    const token = randomBytes(24).toString('hex');
    await this.prisma.issue.update({
      where: { id: issueId },
      data: { shareToken: token },
    });

    this.activity.log({
      projectId: issue.projectId,
      userId,
      action: 'SHARE_LINK_CREATED',
      issueId: issue.id,
      detail: issue.title,
    });

    return { shareToken: token };
  }

  async revokeShareToken(
    issueId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException(`Issue ${issueId} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);

    await this.prisma.issue.update({
      where: { id: issueId },
      data: { shareToken: null },
    });

    this.activity.log({
      projectId: issue.projectId,
      userId,
      action: 'SHARE_LINK_REVOKED',
      issueId: issue.id,
      detail: issue.title,
    });
  }

  async findByShareToken(token: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { shareToken: token },
      select: shareSelect,
    });
    if (!issue) throw new NotFoundException('Shared card not found or link has been revoked');
    return issue;
  }
}