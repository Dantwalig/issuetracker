import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IssueStatus } from '@prisma/client';

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
export class BoardService {
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
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember)
        throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  /**
   * GET /projects/:projectId/board
   * Returns the active sprint and its issues grouped into three columns.
   */
  async getBoard(projectId: string, userId: string, userRole: string) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const activeSprint = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        projectId: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { issues: true } },
      },
    });

    if (!activeSprint) {
      return { sprint: null, columns: { TODO: [], IN_PROGRESS: [], DONE: [] } };
    }

    const issues = await this.prisma.issue.findMany({
      where: { sprintId: activeSprint.id },
      select: issueSelect,
      orderBy: { createdAt: 'asc' },
    });

    const columns: Record<IssueStatus, typeof issues> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };

    for (const issue of issues) {
      columns[issue.status].push(issue);
    }

    return { sprint: activeSprint, columns };
  }

  /**
   * PATCH /projects/:projectId/board/issues/:issueId/status
   * Updates the status of a single issue that belongs to the active sprint.
   */
  async updateIssueStatus(
    projectId: string,
    issueId: string,
    status: IssueStatus,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found in this project');
    }

    // Must belong to the active sprint
    if (!issue.sprintId) {
      throw new BadRequestException('Issue is not in any sprint');
    }
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: issue.sprintId },
    });
    if (!sprint || sprint.status !== 'ACTIVE') {
      throw new BadRequestException('Issue does not belong to the active sprint');
    }

    // Assignee, reporter, or admin may update status
    if (
      issue.reporterId !== userId &&
      issue.assigneeId !== userId &&
      userRole !== 'ADMIN' && userRole !== 'SUPERADMIN'
    ) {
      throw new ForbiddenException(
        'Only the reporter, assignee, or an admin can update this issue',
      );
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: { status },
      select: issueSelect,
    });
  }
}
