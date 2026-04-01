import api from '@/lib/api';
import { Issue, IssueStatus, Sprint } from '@/types';

export interface BoardColumns {
  TODO: Issue[];
  IN_PROGRESS: Issue[];
  DONE: Issue[];
}

export interface BoardData {
  sprint: Sprint | null;
  columns: BoardColumns;
}

export const boardApi = {
  /** Fetch the active sprint and its issues grouped by status */
  getBoard: (projectId: string) =>
    api.get<BoardData>(`/projects/${projectId}/board`).then((r) => r.data),

  /** Update the status of an issue on the board */
  updateStatus: (projectId: string, issueId: string, status: IssueStatus) =>
    api
      .patch<Issue>(`/projects/${projectId}/board/issues/${issueId}/status`, {
        status,
      })
      .then((r) => r.data),
};
