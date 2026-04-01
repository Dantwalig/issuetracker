import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

const projectSelect = {
  id: true,
  name: true,
  description: true,
  teamId: true,
  createdAt: true,
  updatedAt: true,
  team: {
    select: { id: true, name: true },
  },
  members: {
    select: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
      createdAt: true,
    },
  },
};

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
      if (!team) throw new NotFoundException(`Team ${dto.teamId} not found`);
    }
    return this.prisma.project.create({ data: dto, select: projectSelect });
  }

  async findAll(userId: string, userRole: string) {
    if (userRole === 'ADMIN') {
      return this.prisma.project.findMany({ select: projectSelect, orderBy: { name: 'asc' } });
    }
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      select: projectSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const project = await this.prisma.project.findUnique({ where: { id }, select: projectSelect });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    if (userRole !== 'ADMIN') {
      const isMember = project.members.some((m) => m.user.id === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  /**
   * Only admins may update project settings (name, description, team).
   * The AdminGuard on the controller already blocks non-admins before this is called,
   * but we keep the check here for defence-in-depth.
   */
  async update(id: string, dto: UpdateProjectDto, userId: string, userRole: string) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update project settings');
    }
    await this.findOne(id, userId, userRole);
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
      if (!team) throw new NotFoundException(`Team ${dto.teamId} not found`);
    }
    return this.prisma.project.update({ where: { id }, data: dto, select: projectSelect });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    await this.prisma.project.delete({ where: { id } });
  }

  /**
   * Only admins may manage project membership.
   */
  async addMember(projectId: string, userId: string, requesterId: string, requesterRole: string) {
    if (requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can add project members');
    }
    await this.findOne(projectId, requesterId, requesterRole);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    try {
      await this.prisma.projectMember.create({ data: { projectId, userId } });
    } catch {
      throw new ConflictException('User is already a member of this project');
    }
    return this.findOne(projectId, requesterId, requesterRole);
  }

  async removeMember(projectId: string, userId: string, requesterId: string, requesterRole: string) {
    if (requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can remove project members');
    }
    await this.findOne(projectId, requesterId, requesterRole);
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) throw new NotFoundException('User is not a member of this project');
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
    return this.findOne(projectId, requesterId, requesterRole);
  }
}
