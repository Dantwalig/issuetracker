import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReorderBacklogDto, MoveIssueDto } from './dto/backlog.dto';

const backlogIssueSelect = {
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
  constructor(private readonly prisma: PrismaService) {}

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
    if (userRole !== 'ADMIN') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember)
        throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  /** List all backlog issues (sprintId = null) for a project, ordered by backlogOrder asc */
  async listBacklog(projectId: string, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);
    return this.prisma.issue.findMany({
      where: { projectId, sprintId: null },
      select: backlogIssueSelect,
      orderBy: [{ backlogOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Reorder the backlog for a project.
   * orderedIds must contain exactly the IDs of all current backlog issues.
   * Issues are assigned backlogOrder = their index in the array.
   */
  async reorder(
    projectId: string,
    dto: ReorderBacklogDto,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);

    // Validate: all supplied IDs must belong to this project's backlog
    const backlogIssues = await this.prisma.issue.findMany({
      where: { projectId, sprintId: null },
      select: { id: true },
    });
    const backlogIds = new Set(backlogIssues.map((i) => i.id));
    const invalid = dto.orderedIds.filter((id) => !backlogIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `These IDs are not in the backlog: ${invalid.join(', ')}`,
      );
    }
    if (dto.orderedIds.length !== backlogIds.size) {
      throw new BadRequestException(
        'orderedIds must include every backlog issue exactly once',
      );
    }

    // Bulk-update in a transaction
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.issue.update({
          where: { id },
          data: { backlogOrder: index },
        }),
      ),
    );

    return this.listBacklog(projectId, userId, userRole);
  }

  /**
   * Move an issue into or out of the backlog.
   * sprintId = null  → move to backlog (appended at the end)
   * sprintId = <id>  → move out of backlog (into a sprint; order cleared)
   */
  async moveIssue(
    projectId: string,
    issueId: string,
    dto: MoveIssueDto,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundException(`Issue ${issueId} not found`);
    if (issue.projectId !== projectId) {
      throw new ForbiddenException('Issue does not belong to this project');
    }

    if (dto.sprintId === null) {
      // Moving into backlog — place at the end
      const maxOrder = await this.prisma.issue.aggregate({
        where: { projectId, sprintId: null },
        _max: { backlogOrder: true },
      });
      const nextOrder = (maxOrder._max.backlogOrder ?? -1) + 1;
      return this.prisma.issue.update({
        where: { id: issueId },
        data: { sprintId: null, backlogOrder: nextOrder },
        select: backlogIssueSelect,
      });
    } else {
      // Moving out of backlog into a sprint
      return this.prisma.issue.update({
        where: { id: issueId },
        data: { sprintId: dto.sprintId, backlogOrder: null },
        select: backlogIssueSelect,
      });
    }
  }
}
