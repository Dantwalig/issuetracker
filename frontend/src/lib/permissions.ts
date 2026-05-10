/**
 * Centralised permission helpers.
 *
 * All checks are pure functions – they take only the data already present
 * in the component (current user, issue, comment, project) and return a bool.
 * Nothing async, nothing complex.
 *
 * Team Lead is a SCOPED role stored on ProjectMemberEntry.scopedRole or
 * TeamMemberEntry.scopedRole — it is NOT a global User.role value.
 * Use isProjectTeamLead() to check it within a project context.
 */

import { User, Issue, Comment, Project } from '@/types';

// ── Global roles ────────────────────────────────────────────────────────────

/** True for both ADMIN and SUPERADMIN */
export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  return user?.role === 'SUPERADMIN';
}

// ── Scoped: Team Lead ────────────────────────────────────────────────────────

/**
 * True when the user holds the TEAM_LEAD scopedRole in the given project.
 * Admins are always considered elevated and pass this check too.
 */
export function isProjectTeamLead(
  user: User | null | undefined,
  project: Project | null | undefined,
): boolean {
  if (!user || !project) return false;
  if (isAdmin(user)) return true;
  const membership = project.members.find((m) => m.user.id === user.id);
  return membership?.scopedRole === 'TEAM_LEAD';
}

export function isProjectMember(user: User | null | undefined, project: Project | null | undefined): boolean {
  if (!user || !project) return false;
  if (isAdmin(user)) return true;
  return project.members.some((m) => m.user.id === user.id);
}

// ── Issues ─────────────────────────────────────────────────────────────────

/**
 * Reporter, team lead (within scope), or admin: can update all issue fields.
 */
export function canEditIssue(
  user: User | null | undefined,
  issue: Issue | null | undefined,
  project?: Project | null,
): boolean {
  if (!user || !issue) return false;
  if (isAdmin(user)) return true;
  if (issue.reporterId === user.id) return true;
  if (project) return isProjectTeamLead(user, project);
  return false;
}

/**
 * Reporter, assignee, team lead, or admin: can update status.
 */
export function canUpdateIssueStatus(
  user: User | null | undefined,
  issue: Issue | null | undefined,
  project?: Project | null,
): boolean {
  if (!user || !issue) return false;
  if (isAdmin(user)) return true;
  if (issue.reporterId === user.id || issue.assigneeId === user.id) return true;
  if (project) return isProjectTeamLead(user, project);
  return false;
}

/**
 * Reporter, team lead (within scope), or admin: can delete issue directly.
 * Regular members must submit a deletion request instead.
 */
export function canDeleteIssue(
  user: User | null | undefined,
  issue: Issue | null | undefined,
  project?: Project | null,
): boolean {
  if (!user || !issue) return false;
  if (isAdmin(user)) return true;
  if (issue.reporterId === user.id) return true;
  if (project) return isProjectTeamLead(user, project);
  return false;
}

/**
 * Admin or team lead: can assign issues to members within the project.
 */
export function canAssignIssue(
  user: User | null | undefined,
  project?: Project | null,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (project) return isProjectTeamLead(user, project);
  return false;
}

// ── Comments ───────────────────────────────────────────────────────────────

/** Only the comment author can edit */
export function canEditComment(user: User | null | undefined, comment: Comment | null | undefined): boolean {
  if (!user || !comment) return false;
  return comment.authorId === user.id;
}

/** Author or admin can delete */
export function canDeleteComment(user: User | null | undefined, comment: Comment | null | undefined): boolean {
  if (!user || !comment) return false;
  return isAdmin(user) || comment.authorId === user.id;
}

// ── Sprints ────────────────────────────────────────────────────────────────

/**
 * Admins OR team leads within the project can manage sprints.
 * Pass `project` to enable team lead check; omit for a global admin-only check.
 */
export function canManageSprints(
  user: User | null | undefined,
  project?: Project | null,
): boolean {
  if (isAdmin(user)) return true;
  if (project) return isProjectTeamLead(user, project);
  return false;
}

// ── Teams & Projects ────────────────────────────────────────────────────────

/** Only admins may create/edit/delete teams globally */
export function canManageTeams(user: User | null | undefined): boolean {
  return isAdmin(user);
}

/** Only admins may change project settings or manage membership globally */
export function canManageProject(user: User | null | undefined): boolean {
  return isAdmin(user);
}
