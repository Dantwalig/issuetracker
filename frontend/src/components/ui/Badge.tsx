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
  const done = status === 'DONE';

  // Format the date as "MMM D" (e.g. "Apr 25")
  const formattedDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (overdue) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
        background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca',
      }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden style={{flexShrink:0}}>
          <path d="M8 1L1 14h14L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Overdue · {formattedDate}
      </span>
    );
  }

  if (soon) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
        background: '#fffbeb', color: '#f59e0b', border: '1px solid #fde68a',
      }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden style={{flexShrink:0}}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Due soon · {formattedDate}
      </span>
    );
  }

  // Default: show due date in a neutral style (including DONE issues)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: done ? '#f0fdf4' : '#f8fafc',
      color: done ? '#16a34a' : '#64748b',
      border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`,
    }}>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden style={{flexShrink:0}}>
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 1v3M11 1v3M2 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {formattedDate}
    </span>
  );
}
