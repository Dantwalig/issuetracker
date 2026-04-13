import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

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
  attachments: {
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  mentions: {
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, fullName: true, email: true } },
    },
  },
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
  ) {}

  private async assertProjectMembership(
    issueId: string,
    userId: string,
    userRole: string,
  ) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: true } } },
    });
    if (!issue) throw new NotFoundException(`Issue ${issueId} not found`);
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      const isMember = issue.project.members.some((m) => m.userId === userId);
      if (!isMember)
        throw new ForbiddenException('You are not a member of this project');
    }
    return issue;
  }

  async create(
    issueId: string,
    dto: CreateCommentDto,
    authorId: string,
    userRole: string,
  ) {
    const issue = await this.assertProjectMembership(issueId, authorId, userRole);

    if (dto.attachments?.length) {
      for (const att of dto.attachments) {
        if (!ALLOWED_MIME_TYPES.has(att.mimeType)) {
          throw new BadRequestException(
            `Unsupported file type: ${att.mimeType}. Allowed: JPEG, PNG, GIF, WEBP, PDF`,
          );
        }
      }
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { issueId, authorId, body: dto.body },
        select: { id: true },
      });

      if (dto.attachments?.length) {
        await tx.commentAttachment.createMany({
          data: dto.attachments.map((att) => ({
            commentId: created.id,
            fileName: att.fileName,
            fileUrl: att.fileData,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
          })),
        });
      }

      const mentionedIds = dto.mentionedUserIds ?? [];
      if (mentionedIds.length) {
        await tx.commentMention.createMany({
          data: mentionedIds.map((userId) => ({
            commentId: created.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.comment.findUnique({
        where: { id: created.id },
        select: commentSelect,
      });
    });

    if (!comment) throw new NotFoundException('Failed to create comment');

    const author = comment.author;
    const preview = dto.body.length > 80 ? dto.body.slice(0, 80) + '…' : dto.body;

    const recipientIds = new Set<string>();
    if (issue.reporterId && issue.reporterId !== authorId)
      recipientIds.add(issue.reporterId);
    if (issue.assigneeId && issue.assigneeId !== authorId)
      recipientIds.add(issue.assigneeId);

    if (recipientIds.size > 0) {
      await this.notifications.createMany(
        Array.from(recipientIds).map((userId) => ({
          userId,
          type: 'COMMENT_ADDED' as const,
          title: `New comment on "${issue.title}"`,
          message: `${author.fullName}: ${preview}`,
          issueId: issue.id,
          projectId: issue.projectId,
        })),
      );
    }

    const mentionedIds = dto.mentionedUserIds ?? [];
    if (mentionedIds.length) {
      await this.notifications.createMany(
        mentionedIds
          .filter((uid) => uid !== authorId)
          .map((userId) => ({
            userId,
            type: 'MENTION' as const,
            title: `You were mentioned in "${issue.title}"`,
            message: `${author.fullName} mentioned you: ${preview}`,
            issueId: issue.id,
            projectId: issue.projectId,
          })),
      );
    }

    this.activity.log({
      projectId: issue.projectId,
      userId: authorId,
      action: 'COMMENT_ADDED',
      issueId: issue.id,
      detail: issue.title,
    });

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
    if (
      comment.authorId !== userId &&
      userRole !== 'ADMIN' &&
      userRole !== 'SUPERADMIN'
    ) {
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
    if (
      comment.authorId !== userId &&
      userRole !== 'ADMIN' &&
      userRole !== 'SUPERADMIN'
    ) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.comment.delete({ where: { id } });
  }
}
