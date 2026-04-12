import api from '@/lib/api';
import { DeletedItem } from '@/types';

export const recycleBinApi = {
  list: () => api.get<DeletedItem[]>('/recycle-bin').then(r => r.data),
  deleteIssue: (id: string, reason: string) => api.post<DeletedItem>(`/issues/${id}/delete`, { reason }).then(r => r.data),
  deleteProject: (id: string, reason: string) => api.post<DeletedItem>(`/projects/${id}/delete`, { reason }).then(r => r.data),
  deleteTeam: (id: string, reason: string) => api.post<DeletedItem>(`/teams/${id}/delete`, { reason }).then(r => r.data),
  restore: (id: string) => api.post(`/recycle-bin/${id}/restore`).then(r => r.data),
  hardDelete: (id: string) => api.delete(`/recycle-bin/${id}`).then(r => r.data),
};
