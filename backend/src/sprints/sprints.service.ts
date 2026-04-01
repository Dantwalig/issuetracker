import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
    if (userRole !== 'ADMIN') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember)
        throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  private async getSprintAndAssertAccess(
    sprintId: string,
    userId: string,
    userRole: string,
  ) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) throw new NotFoundException(`Sprint ${sprintId} not found`);
    await this.assertProjectAccess(sprint.projectId, userId, userRole);
    return sprint;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(
    projectId: string,
    dto: CreateSprintDto,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);
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
    return this.prisma.sprint.findUnique({
      where: { id: sprint.id },
      select: sprintSelect,
    });
  }

  async update(
    sprintId: string,
    dto: UpdateSprintDto,
    userId: string,
    userRole: string,
  ) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);
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
    if (sprint.status !== 'DRAFT') {
      throw new BadRequestException('Only draft sprints can be deleted');
    }
    await this.prisma.sprint.delete({ where: { id: sprintId } });
  }

  // ── Transitions ────────────────────────────────────────────────────────────

  async startSprint(sprintId: string, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);

    if (sprint.status !== 'DRAFT') {
      throw new BadRequestException(
        `Sprint is already ${sprint.status.toLowerCase()}`,
      );
    }

    // Enforce: only one ACTIVE sprint per project
    const alreadyActive = await this.prisma.sprint.findFirst({
      where: { projectId: sprint.projectId, status: 'ACTIVE' },
    });
    if (alreadyActive) {
      throw new ConflictException(
        'Another sprint is already active in this project',
      );
    }

    return this.prisma.sprint.update({
      where: { id: sprintId },
      data: { status: 'ACTIVE' },
      select: sprintSelect,
    });
  }

  async completeSprint(sprintId: string, userId: string, userRole: string) {
    const sprint = await this.getSprintAndAssertAccess(sprintId, userId, userRole);

    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestException('Only an active sprint can be completed');
    }

    // Move unfinished issues back to backlog
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
      // Complete the sprint
      this.prisma.sprint.update({
        where: { id: sprintId },
        data: { status: 'COMPLETED' },
      }),
      // Detach all issues from the sprint
      this.prisma.issue.updateMany({
        where: { sprintId },
        data: { sprintId: null, backlogOrder: null },
      }),
      // Re-assign backlogOrder to the unfinished ones
      ...unfinished.map((issue, i) =>
        this.prisma.issue.update({
          where: { id: issue.id },
          data: { backlogOrder: nextOrder + i },
        }),
      ),
    ]);

    return this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: sprintSelect,
    });
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
    issueId: string,
    userId: string,
    userRole: string,
  ) {
    await this.assertProjectAccess(projectId, userId, userRole);

    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found in this project');
    }

    // Append to backlog end
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
