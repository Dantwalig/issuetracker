import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all users the current user has a conversation with */
  async listConversations(userId: string) {
    const messages = await this.prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build a map of partner -> latest message
    const conversationMap = new Map<string, any>();
    for (const msg of messages) {
      const partner = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!conversationMap.has(partner.id)) {
        const unreadCount = await this.prisma.directMessage.count({
          where: { senderId: partner.id, receiverId: userId, isRead: false },
        });
        conversationMap.set(partner.id, {
          partner,
          lastMessage: msg,
          unreadCount,
        });
      }
    }

    return Array.from(conversationMap.values());
  }

  /** Get total unread message count for user */
  async unreadCount(userId: string) {
    const count = await this.prisma.directMessage.count({
      where: { receiverId: userId, isRead: false },
    });
    return { count };
  }

  /** Get conversation between two users */
  async getConversation(userId: string, partnerId: string) {
    // Mark all messages from partner as read
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
        sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Send a message */
  async sendMessage(senderId: string, receiverId: string, dto: CreateMessageDto) {
    if (senderId === receiverId) {
      throw new ForbiddenException('Cannot send messages to yourself');
    }

    const message = await this.prisma.directMessage.create({
      data: {
        senderId,
        receiverId,
        body: dto.body,
      },
      include: {
        sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
    });

    return message;
  }

  /** Edit a DM (sender only, within 15 min) */
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
        sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
    });
  }

  /** Delete a message (sender only) */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.senderId !== userId) {
      throw new ForbiddenException('Cannot delete this message');
    }
    await this.prisma.directMessage.delete({ where: { id: messageId } });
  }
}
