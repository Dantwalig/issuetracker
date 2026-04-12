import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ActivityAction =
  | 'ISSUE_CREATED'
  | 'ISSUE_UPDATED'
  | 'ISSUE_STATUS_CHANGED'
  | 'ISSUE_DELETED'
  | 'ISSUE_ASSIGNED'
  | 'COMMENT_ADDED'
  | 'LABEL_ADDED'
  | 'LABEL_REMOVED'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED'
  | 'SHARE_LINK_CREATED'
  | 'SHARE_LINK_REVOKED';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  /** Fire-and-forget — never throws so it can't break the calling request */
  async log(params: {
    projectId: string;
    userId: string;
    action: ActivityAction;
    issueId?: string;
    detail?: string;
  }): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          projectId: params.projectId,
          userId: params.userId,
          action: params.action,
          issueId: params.issueId ?? null,
          detail: params.detail ?? null,
        },
      });
    } catch (err) {
      // swallow — activity logging must never break the main flow
      console.error('[ActivityService] log error:', err);
    }
  }

  /** Cursor-based paginated activity feed for a project, newest first */
  async getProjectActivity(
    projectId: string,
    take = 30,
    cursor?: string,
  ) {
    const items = await this.prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        issue: { select: { id: true, title: true } },
      },
    });

    const nextCursor = items.length === take ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }
}
