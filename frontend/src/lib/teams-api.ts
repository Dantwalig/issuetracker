import api from '@/lib/api';
import { Team, CreateTeamPayload } from '@/types';

export const teamsApi = {
  list: () => api.get<Team[]>('/teams').then((r) => r.data),
  get: (id: string) => api.get<Team>(`/teams/${id}`).then((r) => r.data),
  create: (data: CreateTeamPayload) => api.post<Team>('/teams', data).then((r) => r.data),
  update: (id: string, data: Partial<CreateTeamPayload>) =>
    api.patch<Team>(`/teams/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  addMember: (id: string, userId: string) =>
    api.post<Team>(`/teams/${id}/members`, { userId }).then((r) => r.data),
  removeMember: (id: string, userId: string) =>
    api.delete<Team>(`/teams/${id}/members/${userId}`).then((r) => r.data),
};
