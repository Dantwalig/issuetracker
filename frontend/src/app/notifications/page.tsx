'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/notifications-api';
import { BackButton } from '@/components/ui/BackButton';
import { Notification, NotificationType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';

const TYPE_GROUPS: { label: string; types: string[]; icon: string }[] = [
  { label: 'All', types: [], icon: '🔔' },
  { label: 'Issues', types: ['ISSUE_ASSIGNED', 'DELETION_REQUEST', 'DELETION_APPROVED', 'DELETION_REJECTED'], icon: '🎯' },
  { label: 'Sprints', types: ['SPRINT_STARTED', 'SPRINT_COMPLETED'], icon: '🏃' },
  { label: 'Comments', types: ['COMMENT_ADDED'], icon: '💬' },
  { label: 'Deletions', types: ['DELETION_NOTICE', 'RESTORE_REQUEST', 'RESTORE_APPROVED', 'RESTORE_REJECTED'], icon: '🗑️' },
  { label: 'Deadlines', types: ['DEADLINE_REMINDER'], icon: '⏰' },
];

function notifIcon(type: string) {
  if (type.includes('SPRINT')) return '🏃';
  if (type.includes('COMMENT')) return '💬';
  if (type.includes('ASSIGNED')) return '🎯';
  if (type.includes('DELETION') || type.includes('RESTORE')) return '🗑️';
  if (type.includes('DEADLINE')) return '⏰';
  return '🔔';
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [activeGroup, setActiveGroup] = useState('All');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const { data: all = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
  });

  const markOne = useMutation({
    mutationFn: notificationsApi.markOneRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const group = TYPE_GROUPS.find(g => g.label === activeGroup)!;
  let filtered = group.types.length === 0 ? all : all.filter(n => group.types.includes(n.type));
  filtered = [...filtered].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sort === 'newest' ? -diff : diff;
  });

  const unread = filtered.filter(n => !n.isRead).length;

  return (
    <div className={styles.page}>
      <BackButton href="/projects" label="Back" />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.sub}>{unread} unread</p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={e => setSort(e.target.value as any)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          {unread > 0 && (
            <button className={styles.markAllBtn} onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Group filter tabs */}
      <div className={styles.tabs}>
        {TYPE_GROUPS.map(g => {
          const count = g.types.length === 0 ? all.filter(n => !n.isRead).length
            : all.filter(n => g.types.includes(n.type) && !n.isRead).length;
          return (
            <button
              key={g.label}
              className={`${styles.tab} ${activeGroup === g.label ? styles.tabActive : ''}`}
              onClick={() => setActiveGroup(g.label)}
            >
              {g.icon} {g.label}
              {count > 0 && <span className={styles.tabBadge}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading && <div className={styles.state}><span className={styles.spinner} /></div>}
      {!isLoading && filtered.length === 0 && (
        <div className={styles.empty}>
          <p>No notifications here.</p>
        </div>
      )}
      <div className={styles.list}>
        {filtered.map(n => (
          <div
            key={n.id}
            className={`${styles.item} ${!n.isRead ? styles.itemUnread : ''}`}
            onClick={() => !n.isRead && markOne.mutate(n.id)}
          >
            <span className={styles.itemIcon}>{notifIcon(n.type)}</span>
            <div className={styles.itemBody}>
              <p className={styles.itemTitle}>{n.title}</p>
              <p className={styles.itemMsg}>{n.message}</p>
              <p className={styles.itemTime}>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
            </div>
            {!n.isRead && <span className={styles.dot} />}
          </div>
        ))}
      </div>
    </div>
  );
}
