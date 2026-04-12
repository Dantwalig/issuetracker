import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateChecklistDto,
  UpdateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto';

const itemSelect = {
  id: true,
  checklistId: true,
  text: true,
  isChecked: true,
  order: true,
  createdAt: true,
  updatedAt: true,
};

const checklistSelect = {
  id: true,
  issueId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: itemSelect,
    orderBy: { order: 'asc' as const },
  },
};

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Verify the issue exists and the user is a project member ────────────

  private async assertAccess(issueId: string, userId: string, role: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: true } } },
    });
    if (!issue) throw new NotFoundException(`Issue ${issueId} not found`);
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      const isMember = issue.project.members.some((m) => m.userId === userId);
      if (!isMember)
        throw new ForbiddenException('You are not a member of this project');
    }
    return issue;
  }

  // ── Checklists CRUD ──────────────────────────────────────────────────────

  async listByIssue(issueId: string, userId: string, role: string) {
    await this.assertAccess(issueId, userId, role);
    return this.prisma.checklist.findMany({
      where: { issueId },
      select: checklistSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async createChecklist(
    issueId: string,
    dto: CreateChecklistDto,
    userId: string,
    role: string,
  ) {
    await this.assertAccess(issueId, userId, role);
    return this.prisma.checklist.create({
      data: { issueId, title: dto.title },
      select: checklistSelect,
    });
  }

  async updateChecklist(
    checklistId: string,
    dto: UpdateChecklistDto,
    userId: string,
    role: string,
  ) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
    });
    if (!checklist) throw new NotFoundException('Checklist not found');
    await this.assertAccess(checklist.issueId, userId, role);
    return this.prisma.checklist.update({
      where: { id: checklistId },
      data: { title: dto.title },
      select: checklistSelect,
    });
  }

  async deleteChecklist(checklistId: string, userId: string, role: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
    });
    if (!checklist) throw new NotFoundException('Checklist not found');
    await this.assertAccess(checklist.issueId, userId, role);
    await this.prisma.checklist.delete({ where: { id: checklistId } });
  }

  // ── Checklist items CRUD ─────────────────────────────────────────────────

  async createItem(
    checklistId: string,
    dto: CreateChecklistItemDto,
    userId: string,
    role: string,
  ) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      include: { _count: { select: { items: true } } },
    });
    if (!checklist) throw new NotFoundException('Checklist not found');
    await this.assertAccess(checklist.issueId, userId, role);

    const order = dto.order ?? checklist._count.items;
    return this.prisma.checklistItem.create({
      data: { checklistId, text: dto.text, order },
      select: itemSelect,
    });
  }

  async updateItem(
    itemId: string,
    dto: UpdateChecklistItemDto,
    userId: string,
    role: string,
  ) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { checklist: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    await this.assertAccess(item.checklist.issueId, userId, role);
    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.isChecked !== undefined && { isChecked: dto.isChecked }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      select: itemSelect,
    });
  }

  async deleteItem(itemId: string, userId: string, role: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { checklist: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    await this.assertAccess(item.checklist.issueId, userId, role);
    await this.prisma.checklistItem.delete({ where: { id: itemId } });
  }
}
