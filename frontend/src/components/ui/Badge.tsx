import { IssueStatus, IssuePriority, IssueType } from '@/types';
import styles from './Badge.module.css';

export function StatusBadge({ status }: { status: IssueStatus }) {
  const map: Record<IssueStatus, { label: string; cls: string }> = {
    TODO: { label: 'Todo', cls: styles.todo },
    IN_PROGRESS: { label: 'In Progress', cls: styles.inProgress },
    DONE: { label: 'Done', cls: styles.done },
  };
  const { label, cls } = map[status];
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const map: Record<IssuePriority, { label: string; cls: string }> = {
    LOW: { label: 'Low', cls: styles.low },
    MEDIUM: { label: 'Medium', cls: styles.medium },
    HIGH: { label: 'High', cls: styles.high },
  };
  const { label, cls } = map[priority];
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export function TypeBadge({ type }: { type: IssueType }) {
  const map: Record<IssueType, { label: string; cls: string }> = {
    TASK: { label: 'Task', cls: styles.task },
    BUG: { label: 'Bug', cls: styles.bug },
    STORY: { label: 'Story', cls: styles.story },
  };
  const { label, cls } = map[type];
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

export function DeadlineBadge({ deadline, status }: { deadline?: string | null; status: string }) {
  if (!deadline) return null;
  const date = new Date(deadline);
  const now = new Date();
  const overdue = status !== 'DONE' && date < now;
  const soon = !overdue && status !== 'DONE' && (date.getTime() - now.getTime()) < 86400000;
  if (!overdue && !soon) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: overdue ? '#fef2f2' : '#fffbeb',
      color: overdue ? '#ef4444' : '#f59e0b',
      border: `1px solid ${overdue ? '#fecaca' : '#fde68a'}`,
    }}>
      {overdue ? (
        <>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden style={{flexShrink:0}}>
            <path d="M8 1L1 14h14L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Overdue
        </>
      ) : (
        <>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden style={{flexShrink:0}}>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Due soon
        </>
      )}
    </span>
  );
}
