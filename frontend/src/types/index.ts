export type Role = 'SUPERADMIN' | 'ADMIN' | 'MEMBER';
export type IssueType = 'TASK' | 'BUG' | 'STORY';
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type SprintStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';
export type DeletedItemType = 'ISSUE' | 'PROJECT' | 'TEAM';
export type RecycleBinStatus = 'ACTIVE' | 'RESTORED' | 'PURGED';
export type DeletionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
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
  createdById: string;
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
  createdById: string;
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
  storyPoints?: number | null;
  deadline?: string | null;
  assigneeId?: string;
  reporterId: string;
  createdById: string;
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
  user: Pick<User, 'id' | 'email' | 'fullName' | 'role' | 'mustChangePassword'>;
}

export interface DeletedItem {
  id: string;
  itemType: DeletedItemType;
  itemId: string;
  itemSnapshot: any;
  deletedById: string;
  reason: string;
  status: RecycleBinStatus;
  deletedAt: string;
  expiresAt: string;
  restoredAt?: string | null;
  deletedBy: { id: string; fullName: string; email: string };
}

export interface DeletionRequest {
  id: string;
  issueId: string;
  requestedById: string;
  reason: string;
  status: DeletionRequestStatus;
  responseReason?: string | null;
  respondedById?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  issue: { id: string; title: string; projectId: string };
  requestedBy: { id: string; fullName: string; email: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  issueId?: string | null;
  projectId?: string | null;
  createdAt: string;
}

export interface CreateIssuePayload {
  title: string;
  description?: string;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  storyPoints?: number;
  deadline?: string;
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

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: IssueUser;
}

export interface CreateCommentPayload { body: string; }
export type UpdateCommentPayload = CreateCommentPayload;

export type NotificationType =
  | 'ISSUE_ASSIGNED' | 'COMMENT_ADDED' | 'SPRINT_STARTED' | 'SPRINT_COMPLETED'
  | 'DELETION_NOTICE' | 'DELETION_REQUEST' | 'DELETION_APPROVED' | 'DELETION_REJECTED'
  | 'RESTORE_REQUEST' | 'RESTORE_APPROVED' | 'RESTORE_REJECTED' | 'DEADLINE_REMINDER';
