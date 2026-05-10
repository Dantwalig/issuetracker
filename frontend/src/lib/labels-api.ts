import api from './api';

export interface Label {
  id: string;
  name: string;
  color: string;
  projectId: string;
  createdAt: string;
}

export interface IssueLabel {
  issueId: string;
  labelId: string;
  label: Label;
}

export const labelsApi = {
  // Project label management
  list: (projectId: string): Promise<Label[]> =>
    api.get(`/projects/${projectId}/labels`).then((r) => r.data),

  create: (projectId: string, data: { name: string; color?: string }): Promise<Label> =>
    api.post(`/projects/${projectId}/labels`, data).then((r) => r.data),

  update: (projectId: string, labelId: string, data: { name?: string; color?: string }): Promise<Label> =>
    api.patch(`/projects/${projectId}/labels/${labelId}`, data).then((r) => r.data),

  remove: (projectId: string, labelId: string): Promise<void> =>
    api.delete(`/projects/${projectId}/labels/${labelId}`).then(() => undefined),

  // Issue label assignment
  getIssueLabels: (issueId: string): Promise<IssueLabel[]> =>
    api.get(`/issues/${issueId}/labels`).then((r) => r.data),

  addToIssue: (issueId: string, labelId: string): Promise<{ issueId: string; labelId: string }> =>
    api.post(`/issues/${issueId}/labels`, { labelId }).then((r) => r.data),

  removeFromIssue: (issueId: string, labelId: string): Promise<void> =>
    api.delete(`/issues/${issueId}/labels/${labelId}`).then(() => undefined),
};
