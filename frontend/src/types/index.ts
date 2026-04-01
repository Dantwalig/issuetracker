export type Role = 'ADMIN' | 'MEMBER';
export type IssueType = 'TASK' | 'BUG' | 'STORY';
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type SprintStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface IssueUser {
  id: string;
  fullName: string;
  email: string;
}

export interface TeamMemberEntry {
  user: IssueUser & { role: Role };
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members: TeamMemberEntry[];
}

export interface ProjectMemberEntry {
  user: IssueUser & { role: Role };
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  teamId?: string;
  team?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  members: ProjectMemberEntry[];
}

export interface Sprint {
  id: string;
  name: string;
  projectId: string;
  startDate?: string | null;
  endDate?: string | null;
  status: SprintStatus;
  createdAt: string;
  updatedAt: string;
  _count: { issues: number };
}

export interface Issue {
  id: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: string;
  reporterId: string;
  projectId: string;
  sprintId?: string | null;
  backlogOrder?: number | null;
  reporter: IssueUser;
  assignee?: IssueUser;
  project: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'email' | 'fullName' | 'role'>;
}

export interface CreateIssuePayload {
  title: string;
  description?: string;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string;
  projectId: string;
}

export type UpdateIssuePayload = Partial<CreateIssuePayload>;

export interface CreateTeamPayload {
  name: string;
  description?: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  teamId?: string;
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export interface CreateSprintPayload {
  name: string;
  startDate?: string;
  endDate?: string;
}

export type UpdateSprintPayload = Partial<CreateSprintPayload>;
