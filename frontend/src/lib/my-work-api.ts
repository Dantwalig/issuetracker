import api from './api';
import { Issue, IssueStatus } from '@/types';

export interface MyWorkSprint {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  project: { id: string; name: string };
  _count: { issues: number };
  myIssueCount: number;
  myDoneCount: number;
}

export interface MyWorkActivity {
  id: string;
  projectId: string;
  issueId: string | null;
  userId: string;
  action: string;
  detail: string | null;
  createdAt: string;
  user: { id: string; fullName: string; avatarUrl?: string | null };
  issue: { id: string; title: string; projectId: string } | null;
}

export interface MyWorkStats {
  totalAssigned: number;
  totalInProgress: number;
  totalTodo: number;
  totalDoneThisWeek: number;
  totalOverdue: number;
}

export interface MyWorkDashboard {
  stats: MyWorkStats;
  assignedIssues: Issue[];
  overdueIssues: Issue[];
  reportedIssues: Issue[];
  activeSprints: MyWorkSprint[];
  recentActivity: MyWorkActivity[];
  recentlyCompleted: Issue[];
}

export const myWorkApi = {
  getDashboard: (): Promise<MyWorkDashboard> =>
    api.get('/my-work').then((r) => r.data),

  updateIssueStatus: (projectId: string, issueId: string, status: IssueStatus): Promise<Issue> =>
    api.patch<Issue>(`/projects/${projectId}/issues/${issueId}`, { status }).then((r) => r.data),
};
