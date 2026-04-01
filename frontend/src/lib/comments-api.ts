import api from '@/lib/api';
import { Comment, CreateCommentPayload, UpdateCommentPayload } from '@/types';

export const commentsApi = {
  list: (issueId: string) =>
    api.get<Comment[]>(`/issues/${issueId}/comments`).then((r) => r.data),

  create: (issueId: string, data: CreateCommentPayload) =>
    api.post<Comment>(`/issues/${issueId}/comments`, data).then((r) => r.data),

  update: (issueId: string, commentId: string, data: UpdateCommentPayload) =>
    api
      .patch<Comment>(`/issues/${issueId}/comments/${commentId}`, data)
      .then((r) => r.data),

  delete: (issueId: string, commentId: string) =>
    api.delete(`/issues/${issueId}/comments/${commentId}`),
};
