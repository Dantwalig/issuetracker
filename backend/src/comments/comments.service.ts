import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

const commentSelect = {
  id: true,
  issueId: true,
  authorId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, fullName: true, email: true },
  },
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertProjectMembership(issueId: string, userId: string, userRole: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: true } } },
    });
    if (!issue) throw new NotFoundException(`Issue ${issueId} not found`);
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      const isMember = issue.project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('You are not a member of this project');
    }
    return issue;
  }

  async create(issueId: string, dto: CreateCommentDto, authorId: string, userRole: string) {
    const issue = await this.assertProjectMembership(issueId, authorId, userRole);
    const comment = await this.prisma.comment.create({
      data: { issueId, authorId, body: dto.body },
      select: commentSelect,
    });

    // Notify the issue reporter and assignee (excluding the commenter)
    const recipientIds = new Set<string>();
    if (issue.reporterId && issue.reporterId !== authorId) recipientIds.add(issue.reporterId);
    if (issue.assigneeId && issue.assigneeId !== authorId) recipientIds.add(issue.assigneeId);

    if (recipientIds.size > 0) {
      const preview = dto.body.length > 80 ? dto.body.slice(0, 80) + '…' : dto.body;
      await this.notifications.createMany(
        Array.from(recipientIds).map((userId) => ({
          userId,
          type: 'COMMENT_ADDED' as const,
          title: `New comment on "${issue.title}"`,
          message: `${comment.author.fullName}: ${preview}`,
          issueId: issue.id,
          projectId: issue.projectId,
        })),
      );
    }

    return comment;
  }

  async findByIssue(issueId: string, userId: string, userRole: string) {
    await this.assertProjectMembership(issueId, userId, userRole);
    return this.prisma.comment.findMany({
      where: { issueId },
      select: commentSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, dto: UpdateCommentDto, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException(`Comment ${id} not found`);
    await this.assertProjectMembership(comment.issueId, userId, userRole);
    if (comment.authorId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      throw new ForbiddenException('You can only edit your own comments');
    }
    return this.prisma.comment.update({
      where: { id },
      data: { body: dto.body },
      select: commentSelect,
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException(`Comment ${id} not found`);
    await this.assertProjectMembership(comment.issueId, userId, userRole);
    if (comment.authorId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.comment.delete({ where: { id } });
  }
}
