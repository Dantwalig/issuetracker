'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { notificationsApi } from '@/lib/notifications-api';
import { Notification, NotificationType } from '@/types';
import { format } from 'date-fns';
import styles from './NotificationBell.module.css';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();
  const router = useRouter();

  // Poll unread count — lightweight, runs every 30 s
  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
  });

  // Full list — only fetched when panel is opened
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: open,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markOneRead(id),
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

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) markOne.mutate(n.id);
    setOpen(false);
    if (n.projectId && n.issueId) {
      router.push(`/projects/${n.projectId}/issues/${n.issueId}`);
    } else if (n.projectId) {
      router.push(`/projects/${n.projectId}`);
    }
  }

  const unread = countData?.count ?? 0;
  const hasUnread = unread > 0;

  return (
    <div className={styles.wrapper}>
      <button
        ref={buttonRef}
        className={`${styles.bell} ${open ? styles.bellActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${hasUnread ? ` (${unread} unread)` : ''}`}
        title="Notifications"
      >
        <BellIcon />
        {hasUnread && (
          <span className={styles.badge} aria-hidden>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
            {hasUnread && (
              <button
                className={styles.markAllBtn}
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {isLoading && (
              <div className={styles.center}>
                <span className={styles.spinner} />
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className={styles.empty}>
                <BellOffIcon />
                <p>No notifications yet</p>
              </div>
            )}

            {!isLoading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={`${styles.item} ${!n.isRead ? styles.itemUnread : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <span className={styles.itemIcon}>
                    <NotifIcon type={n.type} />
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    <span className={styles.itemMessage}>{n.message}</span>
                    <span className={styles.itemTime}>
                      {format(new Date(n.createdAt), 'MMM d · HH:mm')}
                    </span>
                  </span>
                  {!n.isRead && <span className={styles.unreadDot} aria-hidden />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.5L2 10h12l-1.5-1.5V6A4.5 4.5 0 0 0 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 10.5a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a7 7 0 0 0-7 7v3.5L3 15h18l-2-1.5V10a7 7 0 0 0-7-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 15a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function NotifIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case 'ISSUE_ASSIGNED':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'COMMENT_ADDED':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4 13.5 L4 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M5 10.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1.5 11.5 L4.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'SPRINT_STARTED':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <polygon points="3,2 13,8 3,14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'SPRINT_COMPLETED':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
