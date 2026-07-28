'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/notifications-api';
import { ShortcutsButton } from './ShortcutsButton';
import { useTheme } from '@/lib/theme-context';
import styles from './Topbar.module.css';

export function Topbar() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
    enabled: !!user, // only poll when authenticated — prevents spurious 401s
  });

  return (
    <header className={styles.topbar}>
      <div className={styles.spacer} />
      <div className={styles.actions}>
        <button
          className={styles.iconBtn}
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
        <ShortcutsButton />
        <button
          className={styles.iconBtn}
          onClick={() => router.push('/notifications')}
          title="Notifications"
          aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        >
          <BellIcon />
          {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
        </button>
        <button
          className={styles.avatarBtn}
          onClick={() => router.push('/profile')}
          title="Profile"
          aria-label="Open your profile"
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

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M14.5 10.5A6 6 0 1 1 7.5 3.5a5 5 0 0 0 7 7Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 1.5v2M9 14.5v2M16.5 9h-2M3.5 9h-2M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4M14.3 14.3l-1.4-1.4M5.1 5.1 3.7 3.7"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
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
