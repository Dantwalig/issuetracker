import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    const name = this.config.get<string>('RESEND_FROM_NAME') ?? 'Trackr';
    const email =
      this.config.get<string>('RESEND_FROM_EMAIL') ?? 'noreply@example.com';
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
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Resend error ${res.status}: ${body}`);
      }
    } catch (err) {
      this.logger.error('Failed to send email via Resend', err);
    }
  }

  // ── Helpers for specific email types ─────────────────────────────────────

  async sendWelcome(opts: {
    to: string;
    fullName: string;
    tempPassword: string;
  }): Promise<void> {
    const platformUrl = 'https://trackr.ubwengelab.rw';
    await this.send({
      to: opts.to,
      subject: 'Your Trackr account is ready',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
          <h2 style="color:#111;margin-top:0;">Welcome to Trackr, ${opts.fullName}!</h2>
          <p style="color:#444;line-height:1.6;">An administrator has created an account for you.
          Use the credentials below to sign in for the first time.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:24px 0;">
            <p style="margin:0 0 4px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.05em;">Email</p>
            <p style="margin:0 0 16px;font-size:15px;color:#111;">${opts.to}</p>
            <p style="margin:0 0 4px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.05em;">Temporary password</p>
            <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:.1em;color:#111;font-family:monospace;">${opts.tempPassword}</p>
          </div>
          <div style="text-align:center;margin:28px 0;">
            <a href="${platformUrl}"
               style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;
                      padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
              Sign in to Trackr
            </a>
          </div>
          <p style="color:#666;font-size:13px;line-height:1.6;text-align:center;">
            Or go to <a href="${platformUrl}" style="color:#6366f1;">${platformUrl}</a>
          </p>
          <p style="color:#444;line-height:1.6;margin-top:24px;">You will be asked to choose a new password immediately after your first login.</p>
          <p style="color:#888;font-size:12px;margin-top:32px;">If you didn't expect this email, you can safely ignore it.</p>
        </div>`,
    });
  }

  async sendPasswordReset(opts: {
    to: string;
    fullName: string;
    resetLink: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: 'Reset your Trackr password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
          <h2 style="color:#111;margin-top:0;">Reset your password</h2>
          <p style="color:#444;line-height:1.6;">Hi ${opts.fullName},</p>
          <p style="color:#444;line-height:1.6;">We received a request to reset your Trackr password.
          Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${opts.resetLink}"
               style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;
                      padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
              Reset password
            </a>
          </div>
          <p style="color:#666;font-size:13px;line-height:1.6;">
            Or copy and paste this link into your browser:<br/>
            <a href="${opts.resetLink}" style="color:#6366f1;">${opts.resetLink}</a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:32px;">
            If you didn't request a password reset, you can safely ignore this email.
            Your password will not change.
          </p>
        </div>`,
    });
  }

  async sendNotification(opts: {
    to: string;
    title: string;
    message: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: opts.title,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
          <h2 style="color:#111;margin-top:0;">${opts.title}</h2>
          <p style="color:#444;line-height:1.6;">${opts.message}</p>
          <p style="color:#888;font-size:12px;margin-top:32px;">You're receiving this because you have an active Trackr account.</p>
        </div>`,
    });
  }
}
