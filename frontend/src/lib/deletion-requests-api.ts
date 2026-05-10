import api from '@/lib/api';
import { DeletionRequest } from '@/types';

export const deletionRequestsApi = {
  request: (issueId: string, reason: string) =>
    api.post(`/deletion-requests/issues/${issueId}`, { reason }).then(r => r.data),
  listPending: () => api.get<DeletionRequest[]>('/deletion-requests').then(r => r.data),
  respond: (id: string, approved: boolean, responseReason: string) =>
    api.post(`/deletion-requests/${id}/respond`, { approved, responseReason }).then(r => r.data),
};
