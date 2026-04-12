'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/notifications-api';
import styles from './Topbar.module.css';

export function Topbar() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
  });

  return (
    <header className={styles.topbar}>
      <div className={styles.spacer} />
      <div className={styles.actions}>
        <button
          className={styles.iconBtn}
          onClick={() => router.push('/notifications')}
          title="Notifications"
        >
          <BellIcon />
          {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
        </button>
        <button
          className={styles.avatarBtn}
          onClick={() => router.push('/profile')}
          title="Profile"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.fullName} className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarInitial}>
              {user?.fullName?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2a5 5 0 0 0-5 5v3l-1.5 2h13L14 10V7a5 5 0 0 0-5-5Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 14a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
