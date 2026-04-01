/**
 * Centralised permission helpers.
 *
 * All checks are pure functions – they take only the data already present
 * in the component (current user, issue, comment, project) and return a bool.
 * Nothing async, nothing complex.
 */

import { User, Issue, Comment, Project } from '@/types';

// ── Roles ──────────────────────────────────────────────────────────────────

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

export function isProjectMember(user: User | null | undefined, project: Project | null | undefined): boolean {
  if (!user || !project) return false;
  if (isAdmin(user)) return true;
  return project.members.some((m) => m.user.id === user.id);
}

// ── Issues ─────────────────────────────────────────────────────────────────

/** Reporter or admin: can update all issue fields */
export function canEditIssue(user: User | null | undefined, issue: Issue | null | undefined): boolean {
  if (!user || !issue) return false;
  return isAdmin(user) || issue.reporterId === user.id;
}

/** Reporter, assignee, or admin: can update status */
export function canUpdateIssueStatus(user: User | null | undefined, issue: Issue | null | undefined): boolean {
  if (!user || !issue) return false;
  return isAdmin(user) || issue.reporterId === user.id || issue.assigneeId === user.id;
}

/** Reporter or admin: can delete issue */
export function canDeleteIssue(user: User | null | undefined, issue: Issue | null | undefined): boolean {
  if (!user || !issue) return false;
  return isAdmin(user) || issue.reporterId === user.id;
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

/** Only admins may create, edit, delete, start, or complete sprints */
export function canManageSprints(user: User | null | undefined): boolean {
  return isAdmin(user);
}

// ── Teams & Projects ────────────────────────────────────────────────────────

/** Only admins may create/edit/delete teams */
export function canManageTeams(user: User | null | undefined): boolean {
  return isAdmin(user);
}

/** Only admins may change project settings or manage membership */
export function canManageProject(user: User | null | undefined): boolean {
  return isAdmin(user);
}
