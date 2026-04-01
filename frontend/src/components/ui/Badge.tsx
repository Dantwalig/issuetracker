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
