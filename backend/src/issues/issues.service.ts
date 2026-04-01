import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.issue.create({
      data: { ...dto, reporterId },
      select: issueSelect,
    });
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
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    await this.assertProjectAccess(issue.projectId, userId, userRole);
    if (issue.reporterId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You can only edit issues you reported');
    }
    const { projectId: _p, ...updateData } = dto;
    return this.prisma.issue.update({
      where: { id },
      data: updateData,
      select: issueSelect,
    });
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
