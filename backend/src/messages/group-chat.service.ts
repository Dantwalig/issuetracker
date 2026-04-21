import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto, SendGroupMessageDto, EditMessageDto, InviteToGroupDto } from './dto/group.dto';

// Role rank for determining group admin
const ROLE_RANK: Record<string, number> = {
  SUPERADMIN: 4,
  ADMIN: 3,
  TEAM_LEAD: 2,
  MEMBER: 1,
};

/** Select shape reused across queries */
const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatarUrl: true,
  role: true,
} as const;

@Injectable()
export class GroupChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async assertMember(groupId: string, userId: string) {
    const m = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!m) throw new ForbiddenException('You are not a member of this group');
    return m;
  }

  /**
   * Recompute admin assignments based on global role rank.
   * Highest rank → ADMIN. If there are ties at the top, all get ADMIN.
   */
  private async recomputeAdmins(groupId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { role: true } } },
    });

    if (members.length === 0) return;

    const maxRank = Math.max(...members.map((m) => ROLE_RANK[m.user.role] ?? 1));

    for (const m of members) {
      const rank = ROLE_RANK[m.user.role] ?? 1;
      const shouldBeAdmin = rank === maxRank;
      await this.prisma.groupMember.update({
        where: { id: m.id },
        data: { role: shouldBeAdmin ? 'ADMIN' : 'MEMBER' },
      });
    }
  }

  // ── Group CRUD ───────────────────────────────────────────────────────────

  async createGroup(creatorId: string, dto: CreateGroupDto) {
    const allMemberIds = [creatorId, ...dto.memberIds.filter((id) => id !== creatorId)];

    // Fetch all users to determine ranks
    const users = await this.prisma.user.findMany({
      where: { id: { in: allMemberIds } },
      select: USER_SELECT,
    });

    if (users.length !== allMemberIds.length) {
      throw new BadRequestException('One or more users not found');
    }

    const maxRank = Math.max(...users.map((u) => ROLE_RANK[u.role] ?? 1));

    const group = await this.prisma.groupChat.create({
      data: {
        name: dto.name,
        createdById: creatorId,
        members: {
          create: allMemberIds.map((userId) => {
            const user = users.find((u) => u.id === userId)!;
            const rank = ROLE_RANK[user.role] ?? 1;
            return {
              userId,
              role: rank === maxRank ? 'ADMIN' : 'MEMBER',
            };
          }),
        },
      },
      include: this.groupInclude(),
    });

    return group;
  }

  async listGroups(userId: string) {
    return this.prisma.groupChat.findMany({
      where: { members: { some: { userId } } },
      include: this.groupInclude(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getGroup(groupId: string, userId: string) {
    await this.assertMember(groupId, userId);
    return this.prisma.groupChat.findUnique({
      where: { id: groupId },
      include: this.groupInclude(),
    });
  }

  // ── Messages ─────────────────────────────────────────────────────────────

  async getMessages(groupId: string, userId: string) {
    await this.assertMember(groupId, userId);
    return this.prisma.groupMessage.findMany({
      where: { groupId },
      include: { sender: { select: USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(groupId: string, senderId: string, dto: SendGroupMessageDto) {
    await this.assertMember(groupId, senderId);

    const msg = await this.prisma.groupMessage.create({
      data: { groupId, senderId, body: dto.body },
      include: { sender: { select: USER_SELECT } },
    });

    // Bump group updatedAt so conversation list sorts correctly
    await this.prisma.groupChat.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    });

    return msg;
  }

  async editMessage(messageId: string, userId: string, dto: EditMessageDto) {
    const msg = await this.prisma.groupMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Cannot edit another user\'s message');

    const ageMs = Date.now() - new Date(msg.createdAt).getTime();
    if (ageMs > 15 * 60 * 1000) {
      throw new ForbiddenException('Messages can only be edited within 15 minutes of sending');
    }

    return this.prisma.groupMessage.update({
      where: { id: messageId },
      data: { body: dto.body, editedAt: new Date() },
      include: { sender: { select: USER_SELECT } },
    });
  }

  async deleteGroupMessage(messageId: string, userId: string) {
    const msg = await this.prisma.groupMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Cannot delete another user\'s message');
    await this.prisma.groupMessage.delete({ where: { id: messageId } });
  }

  // ── Add member via consent flow ──────────────────────────────────────────

  async requestInvite(groupId: string, initiatorId: string, dto: InviteToGroupDto) {
    await this.assertMember(groupId, initiatorId);

    // Ensure invitee isn't already a member
    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: dto.inviteeId } },
    });
    if (existing) throw new BadRequestException('User is already a member of this group');

    // Check no pending request for same invitee
    const pendingReq = await this.prisma.groupInviteRequest.findFirst({
      where: { groupId, inviteeId: dto.inviteeId, status: 'PENDING' },
    });
    if (pendingReq) throw new BadRequestException('A pending invite request already exists for this user');

    // Get all current members (they all need to approve)
    const members = await this.prisma.groupMember.findMany({ where: { groupId } });

    const request = await this.prisma.groupInviteRequest.create({
      data: {
        groupId,
        initiatorId,
        inviteeId: dto.inviteeId,
        status: 'PENDING',
        approvals: {
          create: members
            .filter((m) => m.userId !== initiatorId) // initiator auto-approves
            .map((m) => ({ memberId: m.id, status: 'PENDING' })),
        },
      },
      include: {
        invitee: { select: USER_SELECT },
        initiator: { select: USER_SELECT },
        approvals: {
          include: {
            member: { include: { user: { select: USER_SELECT } } },
          },
        },
      },
    });

    return request;
  }

  async respondToInvite(
    requestId: string,
    responderId: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ) {
    const request = await this.prisma.groupInviteRequest.findUnique({
      where: { id: requestId },
      include: {
        approvals: { include: { member: true } },
        group: { include: { members: { include: { user: { select: USER_SELECT } } } } },
      },
    });

    if (!request) throw new NotFoundException('Invite request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is no longer pending');

    // Find the approval for this responder
    const myMembership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: request.groupId, userId: responderId } },
    });
    if (!myMembership) throw new ForbiddenException('Not a member of this group');

    const approval = request.approvals.find((a) => a.memberId === myMembership.id);
    if (!approval) throw new ForbiddenException('You are not required to approve this request');

    // Record the decision
    await this.prisma.groupInviteApproval.update({
      where: { id: approval.id },
      data: { status: decision === 'approve' ? 'APPROVED' : 'REJECTED', reason: reason ?? null },
    });

    // If rejected → cancel the whole request immediately
    if (decision === 'reject') {
      await this.prisma.groupInviteRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });
      return { status: 'REJECTED' };
    }

    // Check if all approvals are now approved
    const allApprovals = await this.prisma.groupInviteApproval.findMany({
      where: { requestId },
    });
    const allApproved = allApprovals.every((a) => a.status === 'APPROVED');

    if (allApproved) {
      // Add invitee to group, then recompute admins
      const inviteeUser = await this.prisma.user.findUnique({
        where: { id: request.inviteeId },
        select: USER_SELECT,
      });
      if (!inviteeUser) throw new NotFoundException('Invitee user not found');

      await this.prisma.groupMember.create({
        data: { groupId: request.groupId, userId: request.inviteeId, role: 'MEMBER' },
      });

      await this.recomputeAdmins(request.groupId);

      await this.prisma.groupInviteRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' },
      });

      return { status: 'APPROVED' };
    }

    return { status: 'PENDING' };
  }

  async cancelInvite(requestId: string, userId: string) {
    const request = await this.prisma.groupInviteRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Invite request not found');
    if (request.initiatorId !== userId) throw new ForbiddenException('Only the initiator can cancel');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is no longer pending');

    await this.prisma.groupInviteRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    return { status: 'CANCELLED' };
  }

  async getPendingInviteRequests(groupId: string, userId: string) {
    await this.assertMember(groupId, userId);
    return this.prisma.groupInviteRequest.findMany({
      where: { groupId, status: 'PENDING' },
      include: {
        invitee: { select: USER_SELECT },
        initiator: { select: USER_SELECT },
        approvals: {
          include: { member: { include: { user: { select: USER_SELECT } } } },
        },
      },
    });
  }

  // ── Include helper ───────────────────────────────────────────────────────

  private groupInclude() {
    return {
      members: {
        include: { user: { select: USER_SELECT } },
        orderBy: { joinedAt: 'asc' as const },
      },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: { sender: { select: USER_SELECT } },
      },
    };
  }
}
