import api from '@/lib/api';
import { Project, CreateProjectPayload, UpdateProjectPayload } from '@/types';

export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then((r) => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: CreateProjectPayload) =>
    api.post<Project>('/projects', data).then((r) => r.data),
  update: (id: string, data: UpdateProjectPayload) =>
    api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, userId: string) =>
    api.post<Project>(`/projects/${id}/members`, { userId }).then((r) => r.data),
  removeMember: (id: string, userId: string) =>
    api.delete<Project>(`/projects/${id}/members/${userId}`).then((r) => r.data),
  /** Promote a project member to Team Lead (admin only) */
  promoteToTeamLead: (projectId: string, userId: string) =>
    api.post(`/projects/${projectId}/members/${userId}/team-lead`).then((r) => r.data),
  /** Revoke Team Lead from a project member (admin only) */
  revokeTeamLead: (projectId: string, userId: string) =>
    api.delete(`/projects/${projectId}/members/${userId}/team-lead`).then((r) => r.data),
};

