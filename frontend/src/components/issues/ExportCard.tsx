import React, { forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Issue } from '@/types';
import styles from './ExportCard.module.css';

interface Props {
  issue: Issue;
}

const statusColors: Record<string, { bg: string; fg: string }> = {
  TODO: { bg: '#1e2535', fg: '#8a95aa' },
  IN_PROGRESS: { bg: '#0f1e45', fg: '#4f7ef8' },
  DONE: { bg: '#0d2e1c', fg: '#34c97e' },
};

const priorityColors: Record<string, { bg: string; fg: string }> = {
  LOW: { bg: '#1e2535', fg: '#5a6480' },
  MEDIUM: { bg: '#2e2008', fg: '#f5b223' },
  HIGH: { bg: '#2e0e0e', fg: '#f05252' },
};

const typeColors: Record<string, { bg: string; fg: string }> = {
  TASK: { bg: '#1a2e5a', fg: '#4f7ef8' },
  BUG: { bg: '#2e0e0e', fg: '#f05252' },
  STORY: { bg: '#1e1040', fg: '#9b7cf8' },
};

export const ExportCard = forwardRef<HTMLDivElement, Props>(({ issue }, ref) => {
  const typeColor = typeColors[issue.type] ?? { bg: '#1e2535', fg: '#8a95aa' };
  const statusColor = statusColors[issue.status] ?? { bg: '#1e2535', fg: '#8a95aa' };
  const priorityColor = priorityColors[issue.priority] ?? { bg: '#1e2535', fg: '#8a95aa' };

  return (
    <div ref={ref} className={styles.card}>
      <div className={styles.project}>{issue.project?.name ?? 'Trackr'}</div>
      <h2 className={styles.title}>{issue.title}</h2>

      <div className={styles.badges}>
        <span className={styles.badge} style={{ backgroundColor: typeColor.bg, color: typeColor.fg }}>
          {issue.type}
        </span>
        <span className={styles.badge} style={{ backgroundColor: statusColor.bg, color: statusColor.fg }}>
          {issue.status.replace('_', ' ')}
        </span>
        <span className={styles.badge} style={{ backgroundColor: priorityColor.bg, color: priorityColor.fg }}>
          {issue.priority}
        </span>
      </div>

      {issue.description && (
        <div className={styles.description}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{issue.description}</ReactMarkdown>
        </div>
      )}

      <div className={styles.separator} />

      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Reporter</span>
          <span className={styles.metaValue}>{issue.reporter?.fullName ?? '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Assignee</span>
          <span className={styles.metaValue}>{issue.assignee?.fullName ?? 'Unassigned'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Story Points</span>
          <span className={styles.metaValue}>{issue.storyPoints != null ? issue.storyPoints : '—'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Deadline</span>
          <span className={styles.metaValue}>
            {issue.deadline ? new Date(issue.deadline).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>

      <div className={styles.watermark}>Trackr</div>
    </div>
  );
});

ExportCard.displayName = 'ExportCard';
