import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';

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

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertProjectAccess(projectId: string, userId: string, userRole: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (userRole !== 'ADMIN') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  async create(dto: CreateIssueDto, reporterId: string, userRole: string) {
    await this.assertProjectAccess(dto.projectId, reporterId, userRole);
    const issue = await this.prisma.issue.create({
      data: { ...dto, reporterId },
      select: issueSelect,
    });

    if (issue.assigneeId && issue.assigneeId !== reporterId) {
      await this.notifications.create({
        userId: issue.assigneeId,
        type: 'ISSUE_ASSIGNED',
        title: 'Issue assigned to you',
        message: `You were assigned to "${issue.title}" in ${issue.project.name}`,
        issueId: issue.id,
        projectId: issue.projectId,
      });
    }

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
    const issue = await this.prisma.issue.findUnique({ where: { id }, select: issueSelect });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);
    return issue;
  }

  /**
   * Permission rules:
   *  - Admin: can update any field on any issue.
   *  - Reporter: can update any field on issues they reported.
   *  - Assignee: can update status only on issues assigned to them.
   *  - Other project members: cannot update issues.
   *
   * If an unauthorized user tries to update a non-status field we throw 403.
   */
  async update(id: string, dto: UpdateIssueDto, userId: string, userRole: string) {
    const before = await this.prisma.issue.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(before.projectId, userId, userRole);

    const isAdmin = userRole === 'ADMIN';
    const isReporter = before.reporterId === userId;
    const isAssignee = before.assigneeId === userId;

    if (!isAdmin && !isReporter && !isAssignee) {
      throw new ForbiddenException('You can only edit issues you reported or are assigned to');
    }

    // Assignees may only change status – reject any other field change
    if (!isAdmin && !isReporter && isAssignee) {
      const { projectId: _p, status, ...otherFields } = dto;
      const hasOtherChanges = Object.keys(otherFields).some(
        (k) => (otherFields as any)[k] !== undefined,
      );
      if (hasOtherChanges) {
        throw new ForbiddenException('Assignees can only update the issue status');
      }
    }

    const { projectId: _p, ...updateData } = dto;
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
        message: `You were assigned to "${issue.title}" in ${issue.project.name}`,
        issueId: issue.id,
        projectId: issue.projectId,
      });
    }

    return issue;
  }

  /**
   * Only the reporter or an admin may delete an issue.
   */
  async remove(id: string, userId: string, userRole: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);
    if (issue.reporterId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Only the reporter or an admin can delete this issue');
    }
    await this.prisma.issue.delete({ where: { id } });
  }
}
