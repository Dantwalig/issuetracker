import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

// ── Shared layout wrapper ─────────────────────────────────────────────────────

function layout(accentColor: string, icon: string, title: string, body: string): string {
  const platformUrl = 'https://trackr.ubwengelab.rw';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- header bar -->
        <tr><td style="background:${accentColor};padding:20px 32px;text-align:left;">
          <span style="font-size:26px;">${icon}</span>
          <span style="display:inline-block;margin-left:10px;font-size:18px;font-weight:700;color:#fff;vertical-align:middle;">${title}</span>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:28px 32px 24px;">${body}</td></tr>
        <!-- footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            You're receiving this because you have an active Trackr account.
            <a href="${platformUrl}" style="color:#6366f1;text-decoration:none;">Open Trackr</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(label: string, url: string, color = '#6366f1'): string {
  return `<div style="margin:24px 0 8px;">
    <a href="${url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:11px 26px;border-radius:8px;font-size:14px;font-weight:600;">${label}</a>
  </div>`;
}

function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const APP_URL = 'https://trackr.ubwengelab.rw';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    const name = this.config.get<string>('RESEND_FROM_NAME') ?? 'Trackr';
    const email = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'noreply@example.com';
    this.from = `${name} <${email}>`;
  }

  async send(opts: SendEmailOptions): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not set — skipping email send');
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: [opts.to], subject: opts.subject, html: opts.html }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Resend error ${res.status}: ${body}`);
      }
    } catch (err) {
      this.logger.error('Failed to send email via Resend', err);
    }
  }

  // ── Welcome / auth ────────────────────────────────────────────────────────

  async sendWelcome(opts: { to: string; fullName: string; tempPassword: string }): Promise<void> {
    const safeName = esc(opts.fullName);
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${safeName}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 20px;">An administrator has created an account for you on Trackr. Use the credentials below to sign in for the first time.</p>
      <div style="background:#f7f7fb;border-radius:8px;padding:18px 22px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.06em;">Email</p>
        <p style="margin:0 0 16px;font-size:15px;color:#111;">${esc(opts.to)}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.06em;">Temporary password</p>
        <p style="margin:0;font-size:24px;font-weight:700;letter-spacing:.12em;color:#111;font-family:monospace;">${esc(opts.tempPassword)}</p>
      </div>
      <p style="color:#555;font-size:14px;line-height:1.7;">You will be asked to choose a new password immediately after your first login.</p>
      ${btn('Sign in to Trackr', APP_URL)}`;
    await this.send({ to: opts.to, subject: 'Your Trackr account is ready', html: layout('#6366f1', '👋', 'Welcome to Trackr', body) });
  }

  async sendPasswordReset(opts: { to: string; fullName: string; resetLink: string }): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.fullName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 24px;">We received a request to reset your Trackr password. This link expires in <strong>1 hour</strong>.</p>
      ${btn('Reset my password', opts.resetLink)}
      <p style="color:#aaa;font-size:12px;margin-top:16px;">If you didn't request this, you can safely ignore this email.</p>`;
    await this.send({ to: opts.to, subject: 'Reset your Trackr password', html: layout('#6366f1', '🔒', 'Password Reset', body) });
  }

  // ── Notifications (typed) ──────────────────────────────────────────────────

  /**
   * Route to the correct rich template based on notification type.
   * Falls back to the generic template for types without a dedicated one.
   */
  async sendNotificationEmail(opts: {
    to: string;
    recipientName: string;
    type: NotificationType;
    title: string;
    message: string;
    issueTitle?: string;
    projectName?: string;
    senderName?: string;
    issueId?: string;
    projectId?: string;
  }): Promise<void> {
    const { type } = opts;
    switch (type) {
      case 'ISSUE_ASSIGNED':    return this.sendIssueAssigned(opts);
      case 'COMMENT_ADDED':     return this.sendCommentAdded(opts);
      case 'MENTION':           return this.sendMention(opts);
      case 'SPRINT_STARTED':    return this.sendSprintEvent(opts, 'started');
      case 'SPRINT_COMPLETED':  return this.sendSprintEvent(opts, 'completed');
      case 'DIRECT_MESSAGE':    return this.sendDirectMessage(opts);
      case 'DELETION_REQUEST':  return this.sendDeletionRequest(opts);
      case 'DELETION_APPROVED': return this.sendDeletionDecision(opts, true);
      case 'DELETION_REJECTED': return this.sendDeletionDecision(opts, false);
      case 'DELETION_NOTICE':   return this.sendDeletionNotice(opts);
      case 'RESTORE_REQUEST':   return this.sendRestoreRequest(opts);
      case 'RESTORE_APPROVED':  return this.sendRestoreDecision(opts, true);
      case 'RESTORE_REJECTED':  return this.sendRestoreDecision(opts, false);
      case 'DEADLINE_REMINDER': return this.sendDeadlineReminder(opts);
      default:                  return this.sendGeneric(opts);
    }
  }

  // Legacy method kept for backward compat (used in deadline.service currently)
  async sendNotification(opts: { to: string; title: string; message: string }): Promise<void> {
    await this.sendGeneric({ to: opts.to, recipientName: '', type: 'DEADLINE_REMINDER' as any, title: opts.title, message: opts.message });
  }

  // ── Per-type templates ────────────────────────────────────────────────────

  private async sendIssueAssigned(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">You've been assigned to an issue${opts.projectName ? ` in <strong>${esc(opts.projectName)}</strong>` : ''}:</p>
      <div style="background:#f0f0ff;border-left:4px solid #6366f1;border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${esc(opts.issueTitle ?? opts.title)}</p>
      </div>
      ${btn('View Issue', APP_URL)}`;
    await this.send({ to: opts.to, subject: `You've been assigned: ${opts.issueTitle ?? opts.title}`, html: layout('#6366f1', '📋', 'Issue Assigned', body) });
  }

  private async sendCommentAdded(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">${esc(opts.senderName ?? 'Someone')} commented on an issue you're involved in:</p>
      <div style="background:#f7f7fb;border-radius:8px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${esc(opts.issueTitle ?? opts.title)}</p>
        ${opts.projectName ? `<p style="margin:6px 0 0;font-size:13px;color:#888;">in ${esc(opts.projectName)}</p>` : ''}
      </div>
      <p style="color:#555;font-size:14px;line-height:1.6;">${esc(opts.message)}</p>
      ${btn('View Comment', APP_URL)}`;
    await this.send({ to: opts.to, subject: `New comment on: ${opts.issueTitle ?? opts.title}`, html: layout('#0ea5e9', '💬', 'New Comment', body) });
  }

  private async sendMention(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;"><strong>${esc(opts.senderName ?? 'Someone')}</strong> mentioned you in a comment${opts.projectName ? ` in <strong>${esc(opts.projectName)}</strong>` : ''}:</p>
      <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">${esc(opts.message)}</p>
      </div>
      ${btn('View Mention', APP_URL, '#f97316')}`;
    await this.send({ to: opts.to, subject: `${opts.senderName ?? 'Someone'} mentioned you`, html: layout('#f97316', '@', 'You Were Mentioned', body) });
  }

  private async sendSprintEvent(opts: any, event: 'started' | 'completed'): Promise<void> {
    const isStart = event === 'started';
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">A sprint in <strong>${esc(opts.projectName ?? 'your project')}</strong> has been <strong>${event}</strong>.</p>
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${esc(opts.title)}</p>
      </div>
      <p style="color:#555;font-size:14px;line-height:1.6;">${esc(opts.message)}</p>
      ${btn('View Sprint', APP_URL, '#22c55e')}`;
    await this.send({ to: opts.to, subject: opts.title, html: layout('#22c55e', isStart ? '🚀' : '✅', isStart ? 'Sprint Started' : 'Sprint Completed', body) });
  }

  private async sendDirectMessage(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">You have a new message from <strong>${esc(opts.senderName ?? 'a teammate')}</strong>:</p>
      <div style="background:#f7f7fb;border-radius:8px;padding:16px 18px;margin:16px 0;border-left:4px solid #6366f1;">
        <p style="margin:0;font-size:15px;color:#333;line-height:1.6;">${esc(opts.message)}</p>
      </div>
      ${btn('Reply in Trackr', APP_URL + '/messages')}`;
    await this.send({ to: opts.to, subject: `New message from ${opts.senderName ?? 'a teammate'}`, html: layout('#6366f1', '✉️', 'New Message', body) });
  }

  private async sendDeletionRequest(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;"><strong>${esc(opts.senderName ?? 'A team member')}</strong> has submitted a deletion request that requires your review:</p>
      <div style="background:#fff1f2;border-left:4px solid #ef4444;border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${esc(opts.issueTitle ?? opts.title)}</p>
        ${opts.projectName ? `<p style="margin:6px 0 0;font-size:13px;color:#888;">in ${esc(opts.projectName)}</p>` : ''}
      </div>
      <p style="color:#555;font-size:14px;line-height:1.6;">${esc(opts.message)}</p>
      ${btn('Review Request', APP_URL, '#ef4444')}`;
    await this.send({ to: opts.to, subject: `Deletion request: ${opts.issueTitle ?? opts.title}`, html: layout('#ef4444', '🗑️', 'Deletion Request', body) });
  }

  private async sendDeletionDecision(opts: any, approved: boolean): Promise<void> {
    const color = approved ? '#22c55e' : '#ef4444';
    const icon = approved ? '✅' : '❌';
    const word = approved ? 'Approved' : 'Rejected';
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">Your deletion request has been <strong>${word.toLowerCase()}</strong>:</p>
      <div style="background:${approved ? '#f0fdf4' : '#fff1f2'};border-left:4px solid ${color};border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${esc(opts.issueTitle ?? opts.title)}</p>
      </div>
      <p style="color:#555;font-size:14px;line-height:1.6;">${esc(opts.message)}</p>
      ${btn('View in Trackr', APP_URL, color)}`;
    await this.send({ to: opts.to, subject: `Deletion ${word.toLowerCase()}: ${opts.issueTitle ?? opts.title}`, html: layout(color, icon, `Deletion ${word}`, body) });
  }

  private async sendDeletionNotice(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">An item you were involved with has been deleted:</p>
      <div style="background:#fff1f2;border-left:4px solid #ef4444;border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">${esc(opts.message)}</p>
      </div>
      ${btn('Open Trackr', APP_URL, '#ef4444')}`;
    await this.send({ to: opts.to, subject: opts.title, html: layout('#ef4444', '🗑️', 'Item Deleted', body) });
  }

  private async sendRestoreRequest(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">A restore request has been submitted and needs your attention:</p>
      <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">${esc(opts.message)}</p>
      </div>
      ${btn('Review in Trackr', APP_URL, '#0ea5e9')}`;
    await this.send({ to: opts.to, subject: opts.title, html: layout('#0ea5e9', '♻️', 'Restore Request', body) });
  }

  private async sendRestoreDecision(opts: any, approved: boolean): Promise<void> {
    const color = approved ? '#22c55e' : '#ef4444';
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;">${esc(opts.message)}</p>
      ${btn('Open Trackr', APP_URL, color)}`;
    await this.send({ to: opts.to, subject: opts.title, html: layout(color, approved ? '✅' : '❌', opts.title, body) });
  }

  private async sendDeadlineReminder(opts: any): Promise<void> {
    // Detect urgency from the title to pick the right colour
    const titleLower = (opts.title ?? '').toLowerCase();
    let accentColor = '#f97316'; // orange default
    let icon = '⏰';
    let urgencyLabel = 'Deadline Reminder';

    if (titleLower.includes('overdue') || titleLower.includes('deadline has arrived') || titleLower.includes('due now')) {
      accentColor = '#ef4444'; icon = '🚨'; urgencyLabel = 'Deadline Reached';
    } else if (titleLower.includes('3 hour') || titleLower.includes('three hour')) {
      accentColor = '#ef4444'; icon = '⚡'; urgencyLabel = 'Deadline in 3 Hours';
    } else if (titleLower.includes('24 hour') || titleLower.includes('1 day') || titleLower.includes('one day')) {
      accentColor = '#f97316'; icon = '⏰'; urgencyLabel = 'Deadline Tomorrow';
    } else if (titleLower.includes('2 day') || titleLower.includes('two day') || titleLower.includes('48 hour')) {
      accentColor = '#eab308'; icon = '📅'; urgencyLabel = 'Deadline in 2 Days';
    }

    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hi <strong>${esc(opts.recipientName)}</strong>,</p>
      <p style="color:#555;line-height:1.7;margin:0 0 8px;">${esc(opts.message)}</p>
      ${opts.issueTitle ? `
      <div style="background:#fff7ed;border-left:4px solid ${accentColor};border-radius:4px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#111;">${esc(opts.issueTitle)}</p>
        ${opts.projectName ? `<p style="margin:6px 0 0;font-size:13px;color:#888;">in ${esc(opts.projectName)}</p>` : ''}
      </div>` : ''}
      <p style="color:#888;font-size:13px;">Make sure to update the issue status once it's done.</p>
      ${btn('View Issue', APP_URL, accentColor)}`;
    await this.send({ to: opts.to, subject: opts.title, html: layout(accentColor, icon, urgencyLabel, body) });
  }

  private async sendGeneric(opts: any): Promise<void> {
    const body = `
      <p style="margin:0 0 16px;color:#333;font-size:15px;">${opts.recipientName ? `Hi <strong>${esc(opts.recipientName)}</strong>,` : ''}</p>
      <p style="color:#555;line-height:1.7;">${esc(opts.message)}</p>
      ${btn('Open Trackr', APP_URL)}`;
    await this.send({ to: opts.to, subject: opts.title, html: layout('#6366f1', '🔔', opts.title, body) });
  }
}
