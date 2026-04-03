import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ── Internal: create one or many notifications ────────────────────────────

  async create(payload: CreateNotificationPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        issueId: payload.issueId,
        projectId: payload.projectId,
      },
    });

    // Fire-and-forget email to the recipient
    void this.sendEmailForNotification(payload);

    return notification;
  }

  async createMany(payloads: CreateNotificationPayload[]) {
    if (payloads.length === 0) return;

    const result = await this.prisma.notification.createMany({
      data: payloads,
    });

    // Send emails for all notifications concurrently
    void Promise.all(payloads.map((p) => this.sendEmailForNotification(p)));

    return result;
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

  // ── Private helpers ───────────────────────────────────────────────────────

  private async sendEmailForNotification(
    payload: CreateNotificationPayload,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, isActive: true },
      });
      if (!user || !user.isActive) return;

      await this.emailService.sendNotification({
        to: user.email,
        title: payload.title,
        message: payload.message,
      });
    } catch {
      // Never let email errors bubble up and break the notification flow
    }
  }
}
