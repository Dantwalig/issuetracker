'use client';

import { useAuth } from '@/lib/auth-context';
import styles from './Sidebar.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationBell } from './NotificationBell';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <div className={styles.logo}>
          <span className={styles.logoMark} />
          <span className={styles.logoText}>Trackr</span>
        </div>

        <nav className={styles.nav}>
          <Link
            href="/teams"
            className={`${styles.navItem} ${pathname.startsWith('/teams') ? styles.active : ''}`}
          >
            <TeamsIcon />
            Teams
          </Link>
          <Link
            href="/projects"
            className={`${styles.navItem} ${pathname.startsWith('/projects') ? styles.active : ''}`}
          >
            <ProjectsIcon />
            Projects
          </Link>
          {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
            <Link
              href="/admin/users"
              className={`${styles.navItem} ${pathname.startsWith('/admin') ? styles.active : ''}`}
            >
              <UsersIcon />
              Users
            </Link>
          )}
        </nav>
      </div>

      <div className={styles.bottom}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>
            {user?.fullName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.fullName}</span>
            <span className={styles.userRole}>{user?.role}</span>
          </div>
        </div>
        <NotificationBell />
        <button className={styles.logoutBtn} onClick={logout} title="Sign out">
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}

function TeamsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 13c0-2 2-3.5 4.5-3.5S10 11 10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 9.5c2.5 0 4.5 1.5 4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 13c0-2.5 2.5-4 6-4s6 1.5 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12.5 2.5a2.5 2.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14.5 13c0-1.5-1-2.5-2.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10.5 11l3-3-3-3M13.5 8H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
