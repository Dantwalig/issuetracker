import api from '@/lib/api';
import { User } from '@/types';

export const usersApi = {
  list: () => api.get<User[]>('/auth/users').then((r) => r.data),
};
