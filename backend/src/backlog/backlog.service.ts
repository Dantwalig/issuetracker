import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamLeadService } from '../common/team-lead.service';

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
export class BacklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamLead: TeamLeadService,
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

  async list(projectId: string, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);
    return this.prisma.issue.findMany({
      where: { projectId, sprintId: null },
      select: issueSelect,
      orderBy: { backlogOrder: 'asc' },
    });
  }

  async reorder(
    projectId: string,
    orderedIds: string[],
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const issues = await this.prisma.issue.findMany({
      where: { projectId, sprintId: null },
      select: { id: true },
    });
    const backlogIdSet = new Set(issues.map((i) => i.id));

    if (orderedIds.length !== backlogIdSet.size) {
      throw new BadRequestException(
        `orderedIds must contain every backlog issue (expected ${backlogIdSet.size}, got ${orderedIds.length})`,
      );
    }

    for (const id of orderedIds) {
      if (!backlogIdSet.has(id)) {
        throw new BadRequestException(
          `Issue ${id} is not a backlog issue in this project`,
        );
      }
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.issue.update({
          where: { id },
          data: { backlogOrder: index },
        }),
      ),
    );

    return this.list(projectId, userId, userRole);
  }

  async moveIssue(
    projectId: string,
    issueId: string,
    sprintId: string | null,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found in this project');
    }

    if (sprintId === null) {
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
    } else {
      const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
      const isLead = await this.teamLead.isProjectTeamLead(userId, projectId);
      if (!isAdmin && !isLead) {
        throw new ForbiddenException(
          'Only admins or team leads can move issues into a sprint',
        );
      }
      const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
      if (!sprint || sprint.projectId !== projectId) {
        throw new NotFoundException('Sprint not found in this project');
      }
      if (sprint.status === 'COMPLETED') {
        throw new BadRequestException('Cannot add issues to a completed sprint');
      }
      return this.prisma.issue.update({
        where: { id: issueId },
        data: { sprintId, backlogOrder: null },
        select: issueSelect,
      });
    }
  }
}
