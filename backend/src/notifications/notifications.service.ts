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
  /** Extra context passed straight through to the email template */
  emailContext?: {
    senderName?: string;
    issueTitle?: string;
    projectName?: string;
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

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

    void this.sendEmail(payload);
    return notification;
  }

  async createMany(payloads: CreateNotificationPayload[]) {
    if (payloads.length === 0) return;
    // emailContext (and any other email-only fields) are NOT database columns —
    // strip them before the insert; sendEmail below consumes the full payload.
    const result = await this.prisma.notification.createMany({
      data: payloads.map(({ emailContext, ...dbFields }) => dbFields),
    });
    void Promise.all(payloads.map((p) => this.sendEmail(p)));
    return result;
  }

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCountForUser(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markOneRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async sendEmail(payload: CreateNotificationPayload): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, fullName: true, isActive: true },
      });
      if (!user || !user.isActive) return;

      await this.emailService.sendNotificationEmail({
        to: user.email,
        recipientName: user.fullName,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        issueId: payload.issueId,
        projectId: payload.projectId,
        ...payload.emailContext,
      });
    } catch {
      // Never let email errors break the notification flow
    }
  }
}
