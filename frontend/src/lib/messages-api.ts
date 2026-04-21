import api from '@/lib/api';

export interface DMUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  isRead: boolean;
  editedAt?: string | null;
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

export type GroupMemberRole = 'ADMIN' | 'MEMBER';
export type GroupInviteStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
  user: DMUser;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  editedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sender: DMUser;
}

export interface GroupInviteApproval {
  id: string;
  requestId: string;
  memberId: string;
  status: GroupInviteStatus;
  reason?: string | null;
  member: GroupMember;
}

export interface GroupInviteRequest {
  id: string;
  groupId: string;
  initiatorId: string;
  inviteeId: string;
  status: GroupInviteStatus;
  createdAt: string;
  invitee: DMUser;
  initiator: DMUser;
  approvals: GroupInviteApproval[];
}

export interface GroupChat {
  id: string;
  name: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: GroupMember[];
  messages: GroupMessage[];
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
  edit: (messageId: string, body: string) =>
    api.patch<DirectMessage>(`/messages/${messageId}`, { body }).then((r) => r.data),
  delete: (messageId: string) =>
    api.delete(`/messages/${messageId}`),
};

export const groupsApi = {
  create: (name: string, memberIds: string[]) =>
    api.post<GroupChat>('/groups', { name, memberIds }).then((r) => r.data),
  list: () =>
    api.get<GroupChat[]>('/groups').then((r) => r.data),
  get: (groupId: string) =>
    api.get<GroupChat>(`/groups/${groupId}`).then((r) => r.data),
  getMessages: (groupId: string) =>
    api.get<GroupMessage[]>(`/groups/${groupId}/messages`).then((r) => r.data),
  sendMessage: (groupId: string, body: string) =>
    api.post<GroupMessage>(`/groups/${groupId}/messages`, { body }).then((r) => r.data),
  editMessage: (messageId: string, body: string) =>
    api.patch<GroupMessage>(`/groups/messages/${messageId}`, { body }).then((r) => r.data),
  deleteMessage: (messageId: string) =>
    api.delete(`/groups/messages/${messageId}`),
  requestInvite: (groupId: string, inviteeId: string) =>
    api.post<GroupInviteRequest>(`/groups/${groupId}/invite`, { inviteeId }).then((r) => r.data),
  getPendingInvites: (groupId: string) =>
    api.get<GroupInviteRequest[]>(`/groups/${groupId}/invites`).then((r) => r.data),
  respondToInvite: (requestId: string, decision: 'approve' | 'reject', reason?: string) =>
    api.post(`/groups/invites/${requestId}/respond`, { decision, reason }).then((r) => r.data),
  cancelInvite: (requestId: string) =>
    api.delete(`/groups/invites/${requestId}`),
};
