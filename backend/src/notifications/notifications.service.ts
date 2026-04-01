import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  issueId?: string;
  projectId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Internal: create one or many notifications ────────────────────────────

  async create(payload: CreateNotificationPayload) {
    return this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        issueId: payload.issueId,
        projectId: payload.projectId,
      },
    });
  }

  async createMany(payloads: CreateNotificationPayload[]) {
    if (payloads.length === 0) return;
    return this.prisma.notification.createMany({ data: payloads });
  }

  // ── User-facing queries & mutations ───────────────────────────────────────

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCountForUser(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markOneRead(id: string, userId: string) {
    // Silently ignore if it doesn't belong to this user
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
