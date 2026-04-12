import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto, UpdateLabelDto } from './dto/label.dto';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertProjectMember(projectId: string, userId: string, role: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  async listByProject(projectId: string, userId: string, role: string) {
    await this.assertProjectMember(projectId, userId, role);
    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateLabelDto, userId: string, role: string) {
    await this.assertProjectMember(projectId, userId, role);
    try {
      return await this.prisma.label.create({
        data: { name: dto.name, color: dto.color ?? '#6366f1', projectId },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(`Label "${dto.name}" already exists in this project`);
      }
      throw e;
    }
  }

  async update(labelId: string, dto: UpdateLabelDto, userId: string, role: string) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw new NotFoundException('Label not found');
    await this.assertProjectMember(label.projectId, userId, role);
    return this.prisma.label.update({
      where: { id: labelId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async remove(labelId: string, userId: string, role: string) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw new NotFoundException('Label not found');
    await this.assertProjectMember(label.projectId, userId, role);
    await this.prisma.label.delete({ where: { id: labelId } });
  }

  async getIssueLabels(issueId: string, userId: string, role: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: true } } },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      const isMember = issue.project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    return this.prisma.issueLabel.findMany({
      where: { issueId },
      include: { label: true },
    });
  }

  async addLabelToIssue(issueId: string, labelId: string, userId: string, role: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: true } } },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      const isMember = issue.project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label || label.projectId !== issue.projectId) {
      throw new NotFoundException('Label not found in this project');
    }
    await this.prisma.issueLabel.upsert({
      where: { issueId_labelId: { issueId, labelId } },
      create: { issueId, labelId },
      update: {},
    });
    return { issueId, labelId };
  }

  async removeLabelFromIssue(issueId: string, labelId: string, userId: string, role: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: true } } },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      const isMember = issue.project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    await this.prisma.issueLabel.deleteMany({ where: { issueId, labelId } });
  }
}
