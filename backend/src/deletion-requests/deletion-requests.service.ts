import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecycleBinService } from '../recycle-bin/recycle-bin.service';
import { DeletionRequestStatus } from '@prisma/client';

@Injectable()
export class DeletionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly recycleBin: RecycleBinService,
  ) {}

  async requestDelete(issueId: string, requestedById: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required');

    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { members: { include: { user: true } } } } },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    const requesterUser = await this.prisma.user.findUnique({ where: { id: requestedById }, select: { role: true } });
    const isPrivileged = requesterUser?.role === 'ADMIN' || requesterUser?.role === 'SUPERADMIN';
    const isMember = issue.project.members.some((m) => m.userId === requestedById);
    if (!isPrivileged && !isMember) {
      throw new ForbiddenException('You are not a member of the project this issue belongs to');
    }

    const existing = await this.prisma.deletionRequest.findFirst({
      where: { issueId, status: DeletionRequestStatus.PENDING },
    });
    if (existing) throw new ConflictException('A deletion request is already pending for this issue');

    const request = await this.prisma.deletionRequest.create({ data: { issueId, requestedById, reason } });

    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, isActive: true },
      select: { id: true },
    });
    const requester = await this.prisma.user.findUnique({ where: { id: requestedById }, select: { fullName: true } });

    // notifications.create already sends the rich email — no manual email.send() needed
    for (const admin of admins) {
      await this.notifications.create({
        userId: admin.id,
        type: 'DELETION_REQUEST',
        title: 'Issue deletion requested',
        message: `${requester?.fullName} requested deletion of issue "${issue.title}". Reason: ${reason}`,
        issueId,
        emailContext: {
          senderName: requester?.fullName,
          issueTitle: issue.title,
          projectName: issue.project.name,
        },
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
        requestedBy: { select: { id: true, fullName: true } },
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

    await this.notifications.create({
      userId: req.requestedById,
      type: approved ? 'DELETION_APPROVED' : 'DELETION_REJECTED',
      title: approved ? 'Deletion request approved' : 'Deletion request rejected',
      message: `${responder?.fullName} ${approved ? 'approved' : 'rejected'} your request to delete "${req.issue.title}". ${responseReason}`,
      issueId: req.issueId,
      emailContext: {
        senderName: responder?.fullName,
        issueTitle: req.issue.title,
      },
    });

    if (approved) {
      await this.recycleBin.softDeleteIssue(req.issueId, respondedById, callerRole, `Approved deletion: ${responseReason}`);
    }

    return { message: `Request ${status.toLowerCase()}` };
  }
}
