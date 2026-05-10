'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { shareApi, SharedIssue } from '@/lib/share-api';
import { format } from 'date-fns';
import styles from './page.module.css';

// ── Badge helpers ─────────────────────────────────────────────────────────────

function statusClass(status: string) {
  if (status === 'TODO') return styles.badgeTodo;
  if (status === 'IN_PROGRESS') return styles.badgeInProgress;
  if (status === 'DONE') return styles.badgeDone;
  return styles.badgeTodo;
}

function priorityClass(priority: string) {
  if (priority === 'LOW') return styles.badgeLow;
  if (priority === 'MEDIUM') return styles.badgeMedium;
  if (priority === 'HIGH') return styles.badgeHigh;
  return styles.badgeLow;
}

function typeClass(type: string) {
  if (type === 'TASK') return styles.badgeTask;
  if (type === 'BUG') return styles.badgeBug;
  if (type === 'STORY') return styles.badgeStory;
  return styles.badgeTask;
}

function statusLabel(status: string) {
  return status.replace('_', ' ');
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [issue, setIssue] = useState<SharedIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    shareApi
      .getByToken(token)
      .then(setIssue)
      .catch((err) => {
        setError(
          err?.response?.data?.message ??
            'This link is invalid or has been revoked.',
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className={styles.root}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <span className={styles.logo}>
          <span className={styles.logoMark} />
          Trackr
        </span>
        <span className={styles.pill}>Shared card</span>
      </div>

      {loading && (
        <div className={styles.center}>
          <span className={styles.spinner} />
        </div>
      )}

      {!loading && error && (
        <div className={styles.center}>
          <p className={styles.errorTitle}>Link not found</p>
          <p className={styles.errorMsg}>{error}</p>
          <Link href="/login" className={styles.footerLink}>
            Sign in to Trackr →
          </Link>
        </div>
      )}

      {!loading && issue && (
        <>
          <div className={styles.card}>
            {issue.project && (
              <p className={styles.projectName}>{issue.project.name}</p>
            )}

            <div className={styles.badgeRow}>
              <span className={`${styles.badge} ${typeClass(issue.type)}`}>
                {issue.type}
              </span>
              <span
                className={`${styles.badge} ${statusClass(issue.status)}`}
              >
                {statusLabel(issue.status)}
              </span>
              <span
                className={`${styles.badge} ${priorityClass(issue.priority)}`}
              >
                {issue.priority}
              </span>
            </div>

            <h1 className={styles.title}>{issue.title}</h1>

            {issue.description && (
              <p className={styles.description}>{issue.description}</p>
            )}

            <div className={styles.separator} />

            <div className={styles.meta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Reporter</span>
                <span className={styles.metaValue}>
                  {issue.reporter?.fullName ?? '—'}
                </span>
              </div>

              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Assignee</span>
                <span className={styles.metaValue}>
                  {issue.assignee?.fullName ?? 'Unassigned'}
                </span>
              </div>

              {issue.storyPoints != null && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Story points</span>
                  <span className={styles.metaValue}>{issue.storyPoints}</span>
                </div>
              )}

              {issue.deadline && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Deadline</span>
                  <span className={styles.metaValue}>
                    {format(new Date(issue.deadline), 'MMM d, yyyy')}
                  </span>
                </div>
              )}

              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Created</span>
                <span className={styles.metaValue}>
                  {format(new Date(issue.createdAt), 'MMM d, yyyy')}
                </span>
              </div>

              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Updated</span>
                <span className={styles.metaValue}>
                  {format(new Date(issue.updatedAt), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>

          <p className={styles.footer}>
            Shared via{' '}
            <Link href="/login" className={styles.footerLink}>
              Trackr
            </Link>{' '}
            · Sign in to manage your projects
          </p>
        </>
      )}
    </div>
  );
}
