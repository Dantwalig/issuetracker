import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Deadline reminder stages.
 * The cron runs every 30 minutes and checks all four windows each time.
 * A DeadlineReminder row is inserted per (issue, stage) to prevent double-sends,
 * even if the cron fires multiple times inside a window.
 */
const STAGES = [
  {
    key: 'TWO_DAYS' as const,
    label: '2 days',
    title: 'Issue deadline in 2 days',
    emailTitle: 'Deadline in 2 days',
    minHours: 47,  // window: 47h – 49h before deadline
    maxHours: 49,
  },
  {
    key: 'ONE_DAY' as const,
    label: '24 hours',
    title: 'Issue deadline in 24 hours',
    emailTitle: 'Deadline Tomorrow',
    minHours: 23,  // window: 23h – 25h
    maxHours: 25,
  },
  {
    key: 'THREE_HOURS' as const,
    label: '3 hours',
    title: 'Issue deadline in 3 hours',
    emailTitle: 'Deadline in 3 hours',
    minHours: 2.5,   // window: 2.5h – 3.5h
    maxHours: 3.5,
  },
  {
    key: 'AT_DEADLINE' as const,
    label: 'now',
    title: 'Issue deadline has arrived',
    emailTitle: 'Deadline reached',
    minHours: -1,    // window: up to 1h past deadline
    maxHours: 0.5,   // and up to 30 min before
  },
] as const;

@Injectable()
export class DeadlineService {
  private readonly logger = new Logger(DeadlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Runs every 30 minutes — checks all four reminder stages */
  @Cron('0,30 * * * *')
  async sendDeadlineReminders() {
    const now = new Date();
    let totalSent = 0;

    for (const stage of STAGES) {
      const windowStart = new Date(now.getTime() + stage.minHours * 60 * 60 * 1000);
      const windowEnd   = new Date(now.getTime() + stage.maxHours * 60 * 60 * 1000);

      // For AT_DEADLINE, windowStart is negative (past deadline), so swap the gte/lte
      const deadlineFilter = stage.key === 'AT_DEADLINE'
        ? { gte: windowStart, lte: windowEnd }  // -1h ago ≤ deadline ≤ +30min from now
        : { gte: windowStart, lt:  windowEnd };

      const issues = await this.prisma.issue.findMany({
        where: {
          deadline: deadlineFilter,
          status: { not: 'DONE' },
          // Exclude issues that already had this stage sent
          deadlineReminders: { none: { stage: stage.key } },
        },
        include: {
          assignee: { select: { id: true, email: true, fullName: true, isActive: true } },
          reporter: { select: { id: true, email: true, fullName: true, isActive: true } },
          project:  { select: { id: true, name: true } },
        },
      });

      for (const issue of issues) {
        const recipients = [issue.assignee, issue.reporter]
          .filter((u): u is NonNullable<typeof u> => Boolean(u?.isActive));
        const unique = [...new Map(recipients.map((r) => [r.id, r])).values()];

        for (const user of unique) {
          const message = `"${issue.title}" in ${issue.project.name} is due in ${stage.label}.`;
          const overdueMessage = `"${issue.title}" in ${issue.project.name} deadline has arrived — please update the issue status.`;

          await this.notifications.create({
            userId:    user.id,
            type:      'DEADLINE_REMINDER',
            title:     stage.title,
            message:   stage.key === 'AT_DEADLINE' ? overdueMessage : message,
            issueId:   issue.id,
            projectId: issue.project.id,
            emailContext: {
              issueTitle:  issue.title,
              projectName: issue.project.name,
            },
          });
        }

        // Mark this stage as sent so re-runs don't double-notify
        await this.prisma.deadlineReminder.create({
          data: { issueId: issue.id, stage: stage.key },
        });

        totalSent += unique.length;
      }
    }

    if (totalSent > 0) {
      this.logger.log(`Deadline reminders: sent ${totalSent} notification(s) across all stages`);
    }
  }
}
