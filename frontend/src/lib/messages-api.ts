import api from '@/lib/api';

export interface DMUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  sender: DMUser;
  receiver: DMUser;
}

export interface Conversation {
  partner: DMUser;
  lastMessage: DirectMessage;
  unreadCount: number;
}

export const messagesApi = {
  listConversations: () =>
    api.get<Conversation[]>('/messages/conversations').then((r) => r.data),

  unreadCount: () =>
    api.get<{ count: number }>('/messages/unread-count').then((r) => r.data.count),

  getConversation: (partnerId: string) =>
    api.get<DirectMessage[]>(`/messages/conversations/${partnerId}`).then((r) => r.data),

  send: (partnerId: string, body: string) =>
    api.post<DirectMessage>(`/messages/conversations/${partnerId}`, { body }).then((r) => r.data),

  delete: (messageId: string) =>
    api.delete(`/messages/${messageId}`),
};
