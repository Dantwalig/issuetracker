import api from '@/lib/api';

export interface SharedIssue {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  storyPoints?: number | null;
  deadline?: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: { fullName: string } | null;
  assignee?: { fullName: string } | null;
  project?: { name: string } | null;
}

export const shareApi = {
  /** Generate (or retrieve) a share token for an issue. Requires auth. */
  generate: (issueId: string): Promise<{ shareToken: string }> =>
    api.post(`/issues/${issueId}/share`).then((r) => r.data),

  /** Revoke the share token. Requires auth. */
  revoke: (issueId: string): Promise<void> =>
    api.delete(`/issues/${issueId}/share`).then(() => undefined),

  /** Public fetch by token — no auth header needed. */
  getByToken: (token: string): Promise<SharedIssue> =>
    api.get(`/issues/share/${token}`).then((r) => r.data),
};
