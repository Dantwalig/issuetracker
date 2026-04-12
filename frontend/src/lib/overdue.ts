import { Issue } from '@/types';

export function isOverdue(issue: Issue): boolean {
  if (!issue.deadline) return false;
  if (issue.status === 'DONE') return false;
  return new Date(issue.deadline) < new Date();
}

export function isDueSoon(issue: Issue): boolean {
  if (!issue.deadline) return false;
  if (issue.status === 'DONE') return false;
  const diff = new Date(issue.deadline).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}
