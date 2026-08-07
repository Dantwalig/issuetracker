import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMessageDto } from './dto/message.dto';

const USER_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listConversations(userId: string) {
    // Bound to the most recent 200 messages (desc order). Since we dedupe to
    // the LATEST message per partner, any conversation with recent activity
    // survives; older/quiet conversations drop off instead of unbounded growth.
    const messages = await this.prisma.directMessage.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      include: {
        sender:   { select: USER_SELECT },
        receiver: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const conversationMap = new Map<string, any>();
    for (const msg of messages) {
      const partner = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!conversationMap.has(partner.id)) {
        conversationMap.set(partner.id, { partner, lastMessage: msg, unreadCount: 0 });
      }
    }

    // Single batched query for unread counts across all partners, instead of
    // one `count` round-trip per conversation.
    const partnerIds = Array.from(conversationMap.keys());
    if (partnerIds.length > 0) {
      const unread = await this.prisma.directMessage.groupBy({
        by: ['senderId'],
        where: { senderId: { in: partnerIds }, receiverId: userId, isRead: false },
        _count: { _all: true },
      });
      for (const row of unread) {
        const convo = conversationMap.get(row.senderId);
        if (convo) convo.unreadCount = row._count._all;
      }
    }
    return Array.from(conversationMap.values());
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.directMessage.count({
      where: { receiverId: userId, isRead: false },
    });
    return { count };
  }

  async getConversation(userId: string, partnerId: string) {
    await this.prisma.directMessage.updateMany({
      where: { senderId: partnerId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    return this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      include: {
        sender:   { select: USER_SELECT },
        receiver: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(senderId: string, receiverId: string, dto: CreateMessageDto) {
    if (senderId === receiverId) {
      throw new ForbiddenException('Cannot send messages to yourself');
    }

    const message = await this.prisma.directMessage.create({
      data: { senderId, receiverId, body: dto.body },
      include: {
        sender:   { select: USER_SELECT },
        receiver: { select: USER_SELECT },
      },
    });

    // Notify the recipient — fire-and-forget
    void this.notifications.create({
      userId:   receiverId,
      type:     'DIRECT_MESSAGE',
      title:    `New message from ${message.sender.fullName}`,
      message:  dto.body.length > 120 ? dto.body.slice(0, 120) + '…' : dto.body,
      emailContext: { senderName: message.sender.fullName },
    });

    return message;
  }

  async editMessage(messageId: string, userId: string, body: string) {
    const message = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!message || message.senderId !== userId) {
      throw new ForbiddenException('Cannot edit this message');
    }
    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    if (ageMs > 15 * 60 * 1000) {
      throw new ForbiddenException('Messages can only be edited within 15 minutes of sending');
    }
    return this.prisma.directMessage.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: {
        sender:   { select: USER_SELECT },
        receiver: { select: USER_SELECT },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!message || message.senderId !== userId) {
      throw new ForbiddenException('Cannot delete this message');
    }
    await this.prisma.directMessage.delete({ where: { id: messageId } });
  }
}
