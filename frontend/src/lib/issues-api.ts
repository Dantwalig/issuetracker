import api from '@/lib/api';
import { Issue, CreateIssuePayload, UpdateIssuePayload } from '@/types';

export const issuesApi = {
  listByProject: (projectId: string) =>
    api.get<Issue[]>(`/projects/${projectId}/issues`).then((r) => r.data),
  get: (projectId: string, id: string) =>
    api.get<Issue>(`/projects/${projectId}/issues/${id}`).then((r) => r.data),
  create: (projectId: string, data: Omit<CreateIssuePayload, 'projectId'>) =>
    api.post<Issue>(`/projects/${projectId}/issues`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: UpdateIssuePayload) =>
    api.patch<Issue>(`/projects/${projectId}/issues/${id}`, data).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    api.delete(`/projects/${projectId}/issues/${id}`),
};
