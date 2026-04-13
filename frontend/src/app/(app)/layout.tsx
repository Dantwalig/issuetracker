'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import styles from '../issues.layout.module.css';

/**
 * Single shared layout for all authenticated pages.
 *
 * Previously every section (projects, teams, messages, etc.) had its own
 * layout.tsx with a Sidebar and Topbar. In Next.js App Router, navigating
 * between those sections caused the entire shell to unmount and remount —
 * tearing down all queries, shortcuts, and state on every click.
 *
 * By moving all protected routes into this one (app) route group layout,
 * the Sidebar and Topbar mount ONCE and stay mounted for the entire session,
 * giving true client-side navigation with no shell re-renders.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) return <div className={styles.loadingScreen}><span className={styles.spinner} /></div>;
  if (!user) return null;

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>
        <Topbar />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
