import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DeadlineService {
  private readonly logger = new Logger(DeadlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Escape user-controlled strings before interpolating them into HTML email bodies. */
  private escapeHtml(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendDeadlineReminders() {
    const now = new Date();
    const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Wider 23-25h window so a single skipped/delayed run won't silently miss issues.
    // reminderSentAt guards against double-sending when the window overlaps across runs.
    const issues = await this.prisma.issue.findMany({
      where: {
        deadline: { gte: in23h, lt: in25h },
        status: { not: 'DONE' },
        reminderSentAt: null,
      },
      include: {
        assignee: { select: { id: true, email: true, fullName: true, isActive: true } },
        reporter: { select: { id: true, email: true, fullName: true, isActive: true } },
        project: { select: { name: true } },
      },
    });

    for (const issue of issues) {
      // Filter out null/undefined and deactivated users before sending reminders
      const recipients = [issue.assignee, issue.reporter].filter(
        (user): user is NonNullable<typeof issue.assignee> => Boolean(user && user.isActive),
      );
      const unique = [...new Map(recipients.map(r => [r.id, r])).values()];

      for (const user of unique) {
        await this.notifications.create({
          userId: user.id,
          type: 'DEADLINE_REMINDER',
          title: 'Issue deadline in 24 hours',
          message: `"${issue.title}" in ${issue.project.name} is due in 24 hours.`,
          issueId: issue.id,
        });

        const safeName = this.escapeHtml(user.fullName);
        const safeTitle = this.escapeHtml(issue.title);
        const safeProject = this.escapeHtml(issue.project.name);

        void this.email.send({
          to: user.email,
          subject: `Deadline reminder: "${issue.title}"`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h2 style="margin-top:0;">&#9200; Deadline in 24 hours</h2>
              <p>Hi ${safeName},</p>
              <p>The issue <strong>"${safeTitle}"</strong> in project <strong>${safeProject}</strong>
              is due in <strong>24 hours</strong>.</p>
              <a href="https://trackr.ubwengelab.rw"
                 style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                View Issue
              </a>
            </div>`,
        });
      }

      // Mark reminder as sent so a subsequent overlapping cron run won't re-send
      await this.prisma.issue.update({
        where: { id: issue.id },
        data: { reminderSentAt: new Date() },
      });
    }

    this.logger.log(`Sent deadline reminders for ${issues.length} issues`);
  }
}
