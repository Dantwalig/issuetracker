import api from '@/lib/api';
import { User, Role } from '@/types';

export interface CreateUserPayload {
  email: string;
  fullName: string;
  role?: 'ADMIN' | 'TEAM_LEAD' | 'MEMBER';
}

export const usersApi = {
  list: () => api.get<User[]>('/auth/users').then((r) => r.data),
  create: (payload: CreateUserPayload) =>
    api.post<User>('/auth/users', payload).then((r) => r.data),
  hasSuperAdmin: () =>
    api.get<{ exists: boolean }>('/auth/superadmin/exists').then((r) => r.data),
  promoteSuperAdmin: (id: string) =>
    api.post<User>(`/auth/users/${id}/promote-superadmin`).then((r) => r.data),
  updateRole: (id: string, role: 'ADMIN' | 'TEAM_LEAD' | 'MEMBER') =>
    api.patch<User>(`/auth/users/${id}/role`, { role }).then((r) => r.data),
  deactivate: (id: string) =>
    api.patch<User>(`/auth/users/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: string) =>
    api.patch<User>(`/auth/users/${id}/reactivate`).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/auth/users/${id}`).then((r) => r.data),
};
