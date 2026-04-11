import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

const teamSelect = {
  id: true,
  name: true,
  description: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  members: {
    select: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
      createdAt: true,
    },
  },
};

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto, createdById: string) {
    const existing = await this.prisma.team.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Team "${dto.name}" already exists`);
    return this.prisma.team.create({ data: { ...dto, createdById }, select: teamSelect });
  }

  async findAll() {
    return this.prisma.team.findMany({
      select: teamSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({ where: { id }, select: teamSelect });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    return team;
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.findOne(id);
    if (dto.name) {
      const existing = await this.prisma.team.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (existing) throw new ConflictException(`Team "${dto.name}" already exists`);
    }
    return this.prisma.team.update({ where: { id }, data: dto, select: teamSelect });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.team.delete({ where: { id } });
  }

  async addMember(teamId: string, userId: string) {
    await this.findOne(teamId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    try {
      await this.prisma.teamMember.create({ data: { teamId, userId } });
    } catch {
      throw new ConflictException('User is already a member of this team');
    }
    return this.findOne(teamId);
  }

  async removeMember(teamId: string, userId: string) {
    await this.findOne(teamId);
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new NotFoundException('User is not a member of this team');
    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
    return this.findOne(teamId);
  }
}
