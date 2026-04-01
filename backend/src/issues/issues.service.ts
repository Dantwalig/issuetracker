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

    // Notify assignee if one was set at creation time
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

  async update(id: string, dto: UpdateIssueDto, userId: string, userRole: string) {
    const before = await this.prisma.issue.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(before.projectId, userId, userRole);
    if (before.reporterId !== userId && before.assigneeId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only edit issues you reported or are assigned to');
    }
    const { projectId: _p, ...updateData } = dto;
    const issue = await this.prisma.issue.update({
      where: { id },
      data: updateData,
      select: issueSelect,
    });

    // Notify new assignee only when the assignee actually changed
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

  async remove(id: string, userId: string, userRole: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);
    if (issue.reporterId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only delete issues you reported');
    }
    await this.prisma.issue.delete({ where: { id } });
  }
}
