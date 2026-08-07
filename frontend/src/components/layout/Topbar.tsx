'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/notifications-api';
import { useHeader } from '@/lib/header-context';
import { ShortcutsButton } from './ShortcutsButton';
import styles from './Topbar.module.css';

export function Topbar() {
  const { user } = useAuth();
  const router = useRouter();
  const { breadcrumbs, actions } = useHeader();

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
    enabled: !!user, // only poll when authenticated — prevents spurious 401s
  });

  return (
    <header className={styles.topbar}>
      {breadcrumbs.length > 0 && (
        <nav className={styles.breadcrumbs}>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <span key={idx} className={styles.crumbItem}>
                {idx > 0 && <span className={styles.sep}>/</span>}
                {isLast || !crumb.href ? (
                  <span className={styles.breadCurrent}>{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className={styles.breadLink}>
                    {crumb.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      )}
      <div className={styles.spacer} />

      <div className={styles.actions}>
        {actions && <div className={styles.pageActions}>{actions}</div>}
        <ShortcutsButton />

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
