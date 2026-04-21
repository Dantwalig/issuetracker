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
    const messages = await this.prisma.directMessage.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      include: {
        sender:   { select: USER_SELECT },
        receiver: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    const conversationMap = new Map<string, any>();
    for (const msg of messages) {
      const partner = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!conversationMap.has(partner.id)) {
        const unreadCount = await this.prisma.directMessage.count({
          where: { senderId: partner.id, receiverId: userId, isRead: false },
        });
        conversationMap.set(partner.id, { partner, lastMessage: msg, unreadCount });
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
