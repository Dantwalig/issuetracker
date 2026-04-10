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
    let teamMemberIds: string[] = [];

    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: dto.teamId },
        include: { members: { select: { userId: true } } },
      });
      if (!team) throw new NotFoundException(`Team ${dto.teamId} not found`);
      teamMemberIds = team.members.map((m) => m.userId);
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        teamId: dto.teamId,
        members: teamMemberIds.length
          ? { create: teamMemberIds.map((userId) => ({ userId })) }
          : undefined,
      },
      select: projectSelect,
    });
  }

  async findAll(userId: string, userRole: string) {
    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
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
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      const isMember = project.members.some((m) => m.user.id === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string, userRole: string) {
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only admins can update project settings');
    }

    const existing = await this.findOne(id, userId, userRole);

    if (dto.teamId && dto.teamId !== existing.teamId) {
      // Team changed — fetch new team members and sync ProjectMember rows
      const team = await this.prisma.team.findUnique({
        where: { id: dto.teamId },
        include: { members: { select: { userId: true } } },
      });
      if (!team) throw new NotFoundException(`Team ${dto.teamId} not found`);

      const newMemberIds = team.members.map((m) => m.userId);

      // Upsert each team member into the project (keeps any existing extra members too)
      await Promise.all(
        newMemberIds.map((uid) =>
          this.prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: id, userId: uid } },
            update: {},
            create: { projectId: id, userId: uid },
          }),
        ),
      );
    } else if (dto.teamId === '') {
      // Team explicitly cleared — leave existing project members untouched
    }

    if (dto.teamId !== undefined && dto.teamId === '') {
      dto = { ...dto, teamId: undefined };
    }

    return this.prisma.project.update({ where: { id }, data: dto, select: projectSelect });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    await this.prisma.project.delete({ where: { id } });
  }

  async addMember(projectId: string, userId: string, requesterId: string, requesterRole: string) {
    if (requesterRole !== 'ADMIN' && requesterRole !== 'SUPERADMIN') {
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
    if (requesterRole !== 'ADMIN' && requesterRole !== 'SUPERADMIN') {
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
