import api from '@/lib/api';
import { Issue } from '@/types';

export const backlogApi = {
  /** List all backlog issues for a project, ordered by backlogOrder */
  list: (projectId: string) =>
    api.get<Issue[]>(`/projects/${projectId}/backlog`).then((r) => r.data),

  /** Reorder the backlog: send the full ordered list of issue IDs */
  reorder: (projectId: string, orderedIds: string[]) =>
    api
      .patch<Issue[]>(`/projects/${projectId}/backlog/reorder`, { orderedIds })
      .then((r) => r.data),

  /** Move an issue into the backlog (sprintId = null) or out of it */
  moveIssue: (projectId: string, issueId: string, sprintId: string | null) =>
    api
      .patch<Issue>(`/projects/${projectId}/backlog/${issueId}/move`, {
        sprintId,
      })
      .then((r) => r.data),
};
