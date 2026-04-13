'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/notifications-api';
import { BackButton } from '@/components/ui/BackButton';
import { Notification, NotificationType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';

// ── Icons ─────────────────────────────────────────────────────────────────────
function BellIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.5L2 10h12l-1.5-1.5V6A4.5 4.5 0 0 0 8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6.5 10.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function SprintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <polygon points="3,2 13,8 3,14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M4 14.5L4 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M1.5 11.5L4.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IssueIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 4h11M5.5 4V2.5h5V4M6.5 7v5M9.5 7v5M3.5 4l1 9.5h7l1-9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function AllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

const TYPE_GROUPS: { label: string; types: string[]; icon: React.ReactNode }[] = [
  { label: 'All',       types: [],                                                                                icon: <AllIcon /> },
  { label: 'Issues',    types: ['ISSUE_ASSIGNED', 'DELETION_REQUEST', 'DELETION_APPROVED', 'DELETION_REJECTED'], icon: <IssueIcon /> },
  { label: 'Sprints',   types: ['SPRINT_STARTED', 'SPRINT_COMPLETED'],                                           icon: <SprintIcon /> },
  { label: 'Comments',  types: ['COMMENT_ADDED'],                                                                 icon: <CommentIcon /> },
  { label: 'Deletions', types: ['DELETION_NOTICE', 'RESTORE_REQUEST', 'RESTORE_APPROVED', 'RESTORE_REJECTED'],   icon: <TrashIcon /> },
  { label: 'Deadlines', types: ['DEADLINE_REMINDER'],                                                             icon: <ClockIcon /> },
];

function NotifIcon({ type }: { type: string }) {
  if (type.includes('SPRINT'))              return <SprintIcon />;
  if (type.includes('COMMENT'))             return <CommentIcon />;
  if (type.includes('ASSIGNED'))            return <IssueIcon />;
  if (type.includes('DELETION') || type.includes('RESTORE')) return <TrashIcon />;
  if (type.includes('DEADLINE'))            return <ClockIcon />;
  return <BellIcon />;
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
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
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
              <span className={styles.tabIcon}>{g.icon}</span>
              {g.label}
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
            <span className={styles.itemIcon}><NotifIcon type={n.type} /></span>
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
