export type Role = 'SUPERADMIN' | 'ADMIN' | 'TEAM_LEAD' | 'MEMBER';
export type IssueType = 'TASK' | 'BUG' | 'STORY';
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type SprintStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';
export type DeletedItemType = 'ISSUE' | 'PROJECT' | 'TEAM';
export type RecycleBinStatus = 'ACTIVE' | 'RESTORED' | 'PURGED';
export type DeletionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type NotificationType =
  | 'ISSUE_ASSIGNED'
  | 'COMMENT_ADDED'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED'
  | 'DELETION_NOTICE'
  | 'DELETION_REQUEST'
  | 'DELETION_APPROVED'
  | 'DELETION_REJECTED'
  | 'RESTORE_REQUEST'
  | 'RESTORE_APPROVED'
  | 'RESTORE_REJECTED'
  | 'DEADLINE_REMINDER'
  | 'DIRECT_MESSAGE'
  | 'MENTION';

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

export type ScopedRole = 'TEAM_LEAD' | null;

export interface TeamMemberEntry {
  user: IssueUser & { role: Role };
  scopedRole?: ScopedRole;
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
  scopedRole?: ScopedRole;
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
  projectId: string;
  sprintId?: string | null;
  reporterId?: string | null;
  assigneeId?: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: IssueUser | null;
  assignee?: IssueUser | null;
  project?: { id: string; name: string };
}

export interface DeletedItem {
  id: string;
  itemType: DeletedItemType;
  itemId: string;
  itemSnapshot: Record<string, unknown>;
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
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  issueId?: string | null;
  projectId?: string | null;
  createdAt: string;
}

// ── Comment attachment ─────────────────────────────────────────────────────
export interface CommentAttachment {
  id: string;
  fileName: string;
  /** base64-encoded file data (stored directly) */
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

// ── Comment mention ────────────────────────────────────────────────────────
export interface CommentMention {
  id: string;
  userId: string;
  user: IssueUser;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: IssueUser;
  attachments: CommentAttachment[];
  mentions: CommentMention[];
}

export interface CreateCommentPayload {
  body: string;
  attachments?: {
    fileName: string;
    fileData: string;
    mimeType: string;
    fileSize: number;
  }[];
  mentionedUserIds?: string[];
}

export type UpdateCommentPayload = Pick<CreateCommentPayload, 'body'>;

// ── Issue payloads ─────────────────────────────────────────────────────────
export interface CreateIssuePayload {
  title: string;
  description?: string;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  storyPoints?: number;
  deadline?: string | null;
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

// ── Labels ─────────────────────────────────────────────────────────────────
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
