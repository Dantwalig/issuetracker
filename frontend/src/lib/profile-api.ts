import api from '@/lib/api';
import { User } from '@/types';

export const profileApi = {
  update: (data: { fullName?: string; avatarUrl?: string }) =>
    api.patch<User>('/auth/profile', data).then(r => r.data),
};
