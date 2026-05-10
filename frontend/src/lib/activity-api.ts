import api from './api';

export interface ActivityUser {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface ActivityIssue {
  id: string;
  title: string;
}

export interface ActivityItem {
  id: string;
  projectId: string;
  issueId: string | null;
  userId: string;
  action: string;
  detail: string | null;
  createdAt: string;
  user: ActivityUser;
  issue: ActivityIssue | null;
}

export interface ActivityResponse {
  items: ActivityItem[];
  nextCursor: string | null;
}

export const activityApi = {
  getProjectActivity: async (
    projectId: string,
    take = 30,
    cursor?: string,
  ): Promise<ActivityResponse> => {
    const params = new URLSearchParams({ take: String(take) });
    if (cursor) params.set('cursor', cursor);
    const res = await api.get(`/projects/${projectId}/activity?${params}`);
    return res.data;
  },
};
