import api from '@/lib/api';
import { User, Role } from '@/types';

export interface CreateUserPayload {
  email: string;
  fullName: string;
  role?: Role;
}

export const usersApi = {
  list: () => api.get<User[]>('/auth/users').then((r) => r.data),
  create: (payload: CreateUserPayload) =>
    api.post<User>('/auth/users', payload).then((r) => r.data),
};
