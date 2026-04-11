import api from '@/lib/api';
import { Notification } from '@/types';

export const notificationsApi = {
  list: () =>
    api.get<Notification[]>('/notifications').then((r) => r.data),

  unreadCount: () =>
    api.get<number>('/notifications/unread-count').then((r) => r.data),

  markOneRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    api.patch('/notifications/read-all'),
};
