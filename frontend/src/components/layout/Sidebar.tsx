'use client';

import { useAuth } from '@/lib/auth-context';
import styles from './Sidebar.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const active = (path: string) =>
    `${styles.navItem} ${pathname.startsWith(path) ? styles.active : ''}`;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <div className={styles.logo}>
          <span className={styles.logoMark} />
          <span className={styles.logoText}>Trackr</span>
        </div>

        <nav className={styles.nav}>
          <Link href="/teams" className={active('/teams')}><TeamsIcon /> Teams</Link>
          <Link href="/projects" className={active('/projects')}><ProjectsIcon /> Projects</Link>
          <Link href="/notifications" className={active('/notifications')}><BellIcon /> Notifications</Link>
          <Link href="/recycle-bin" className={active('/recycle-bin')}><TrashIcon /> Recycle Bin</Link>
          {isPrivileged && (
            <Link href="/admin/users" className={active('/admin/users')}><UsersIcon /> Users</Link>
          )}
          {isPrivileged && (
            <Link href="/admin/deletion-requests" className={active('/admin/deletion-requests')}>
              <FlagIcon /> Deletion Requests
            </Link>
          )}
        </nav>
      </div>

      <div className={styles.bottom}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.fullName} className={styles.avatarImg} />
              : user?.fullName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.fullName}</span>
            <span className={styles.userRole}>{user?.role}</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={logout} title="Sign out">
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}

function TeamsIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="10.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 13c0-2 2-3.5 4.5-3.5S10 11 10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M10 9.5c2.5 0 4.5 1.5 4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function ProjectsIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
function BellIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 0 0-4 4v2.5L2.5 10h11L12 8.5V6a4 4 0 0 0-4-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M6.5 12a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 13c0-2.5 2.5-4 6-4s6 1.5 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function FlagIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2v12M3 2h8l-2 4 2 4H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
