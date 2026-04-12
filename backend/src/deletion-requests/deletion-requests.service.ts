import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecycleBinService } from '../recycle-bin/recycle-bin.service';
import { DeletionRequestStatus } from '@prisma/client';

@Injectable()
export class DeletionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly recycleBin: RecycleBinService,
  ) {}

  private escapeHtml(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async requestDelete(issueId: string, requestedById: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');

    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: { include: { user: true } } } } },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    // Verify the requester is a member (or reporter) of this issue's project
    const requesterUser = await this.prisma.user.findUnique({ where: { id: requestedById }, select: { role: true } });
    const isPrivileged = requesterUser?.role === 'ADMIN' || requesterUser?.role === 'SUPERADMIN';
    const isMember = issue.project.members.some(m => m.userId === requestedById);
    if (!isPrivileged && !isMember) {
      throw new ForbiddenException('You are not a member of the project this issue belongs to');
    }

    // Check no pending request already exists
    const existing = await this.prisma.deletionRequest.findFirst({
      where: { issueId, status: DeletionRequestStatus.PENDING },
    });
    if (existing) throw new ConflictException('A deletion request is already pending for this issue');

    const request = await this.prisma.deletionRequest.create({
      data: { issueId, requestedById, reason },
    });

    // Notify project admins and superadmins
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, isActive: true },
      select: { id: true, email: true, fullName: true },
    });

    const requester = await this.prisma.user.findUnique({ where: { id: requestedById }, select: { fullName: true } });

    for (const admin of admins) {
      await this.notifications.create({
        userId: admin.id,
        type: 'DELETION_REQUEST',
        title: 'Issue deletion requested',
        message: `${requester?.fullName} requested deletion of issue "${issue.title}". Reason: ${reason}`,
        issueId,
      });

      void this.email.send({
        to: admin.email,
        subject: `Deletion request: "${issue.title}"`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <h2 style="margin-top:0;">Issue Deletion Request</h2>
            <p><strong>${requester?.fullName}</strong> has requested to delete issue "<strong>${issue.title}</strong>".</p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0 0 4px;font-size:13px;color:#666;">Reason</p>
              <p style="margin:0;">${this.escapeHtml(reason)}</p>
            </div>
            <a href="https://trackr.ubwengelab.rw/admin/deletion-requests"
               style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
              Review Request
            </a>
          </div>`,
      });
    }

    return request;
  }

  async listPending(callerRole: string) {
    if (!['ADMIN', 'SUPERADMIN'].includes(callerRole)) throw new ForbiddenException();
    return this.prisma.deletionRequest.findMany({
      where: { status: DeletionRequestStatus.PENDING },
      include: {
        issue: { select: { id: true, title: true, projectId: true } },
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(
    requestId: string,
    respondedById: string,
    callerRole: string,
    approved: boolean,
    responseReason: string,
  ) {
    if (!['ADMIN', 'SUPERADMIN'].includes(callerRole)) throw new ForbiddenException();
    if (!responseReason?.trim()) throw new BadRequestException('A response reason is required');

    const req = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: { select: { id: true, email: true, fullName: true } },
        issue: { select: { id: true, title: true } },
      },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== DeletionRequestStatus.PENDING) throw new BadRequestException('Request already resolved');

    const status = approved ? DeletionRequestStatus.APPROVED : DeletionRequestStatus.REJECTED;

    await this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: { status, responseReason, respondedById, respondedAt: new Date() },
    });

    const responder = await this.prisma.user.findUnique({ where: { id: respondedById }, select: { fullName: true } });

    // Notify the requester
    await this.notifications.create({
      userId: req.requestedById,
      type: approved ? 'DELETION_APPROVED' : 'DELETION_REJECTED',
      title: approved ? 'Deletion request approved' : 'Deletion request rejected',
      message: `${responder?.fullName} ${approved ? 'approved' : 'rejected'} your request to delete "${req.issue.title}". ${responseReason}`,
      issueId: req.issueId,
    });

    void this.email.send({
      to: req.requestedBy.email,
      subject: `Deletion request ${approved ? 'approved' : 'rejected'}: "${req.issue.title}"`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="margin-top:0;">Deletion Request ${approved ? 'Approved' : 'Rejected'}</h2>
          <p>Hi ${req.requestedBy.fullName},</p>
          <p>Your request to delete issue "<strong>${req.issue.title}</strong>" has been 
          <strong>${approved ? 'approved' : 'rejected'}</strong> by ${responder?.fullName}.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 4px;font-size:13px;color:#666;">Reason</p>
            <p style="margin:0;">${this.escapeHtml(responseReason)}</p>
          </div>
          <a href="https://trackr.ubwengelab.rw"
             style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
            Go to Trackr
          </a>
        </div>`,
    });

    // If approved, move issue to recycle bin
    if (approved) {
      await this.recycleBin.softDeleteIssue(req.issueId, respondedById, callerRole, `Approved deletion: ${responseReason}`);
    }

    return { message: `Request ${status.toLowerCase()}` };
  }
}
