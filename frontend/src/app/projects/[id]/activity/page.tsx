'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { activityApi, ActivityItem } from '@/lib/activity-api';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import styles from './page.module.css';

const ACTION_LABELS: Record<string, string> = {
  ISSUE_CREATED: 'Created',
  ISSUE_UPDATED: 'Updated',
  ISSUE_STATUS_CHANGED: 'Status changed',
  ISSUE_DELETED: 'Deleted',
  ISSUE_ASSIGNED: 'Assigned',
  COMMENT_ADDED: 'Commented',
  LABEL_ADDED: 'Label added',
  LABEL_REMOVED: 'Label removed',
  SPRINT_STARTED: 'Sprint started',
  SPRINT_COMPLETED: 'Sprint completed',
  SHARE_LINK_CREATED: 'Share link created',
  SHARE_LINK_REVOKED: 'Share link revoked',
};

function badgeClass(action: string) {
  return `${styles.badge} ${styles['badge-' + action.toLowerCase()]}`;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function ActivityRow({ item, projectId }: { item: ActivityItem; projectId: string }) {
  const ts = new Date(item.createdAt);

  return (
    <div className={styles.item}>
      <div className={styles.avatarWrap}>
        <div className={styles.avatar}>
          {item.user?.avatarUrl ? (
            <img src={item.user.avatarUrl} alt={item.user?.fullName} className={styles.avatarImg} />
          ) : (
            initials(item.user?.fullName)
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.row}>
          <span className={styles.actor}>{item.user?.fullName}</span>
          <span className={badgeClass(item.action)}>
            {ACTION_LABELS[item.action] ?? item.action}
          </span>
          {item.issue && (
            <Link
              href={`/projects/${projectId}/issues/${item.issue.id}`}
              className={styles.issueLink}
              title={item.issue.title}
            >
              {item.issue.title}
            </Link>
          )}
        </div>
        {item.detail && <p className={styles.detail}>{item.detail}</p>}
      </div>

      <span
        className={styles.timestamp}
        title={format(ts, 'PPpp')}
      >
        {formatDistanceToNow(ts, { addSuffix: true })}
      </span>
    </div>
  );
}

export default function ActivityPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<ActivityItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: async () => {
      const res = await activityApi.getProjectActivity(projectId, 30);
      setAllItems(res.items);
      return res;
    },
    refetchInterval: 30_000,
  });

  async function loadMore() {
    if (!data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await activityApi.getProjectActivity(projectId, 30, data.nextCursor);
      setAllItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor ?? undefined);
    } finally {
      setLoadingMore(false);
    }
  }

  const nextCursor = cursor ?? data?.nextCursor;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Activity</h1>
        <p className={styles.sub}>Everything that happened in this project, newest first.</p>
      </div>

      {isLoading && (
        <div className={styles.skeleton}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonItem}>
              <div className={styles.skeletonAvatar} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <div className={styles.skeletonLine} style={{ width: `${40 + (i % 4) * 12}%` }} />
                <div className={styles.skeletonLine} style={{ width: `${25 + (i % 3) * 8}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && <p className={styles.error}>Failed to load activity.</p>}

      {!isLoading && !isError && allItems.length === 0 && (
        <p className={styles.empty}>No activity yet — start creating issues!</p>
      )}

      {!isLoading && allItems.length > 0 && (
        <>
          <div className={styles.feed}>
            {allItems.map((item) => (
              <ActivityRow key={item.id} item={item} projectId={projectId} />
            ))}
          </div>

          {nextCursor && (
            <div className={styles.loadMore}>
              <button
                className={styles.loadMoreBtn}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
