'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/Sidebar';
import styles from '../issues.layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && !isPrivileged) router.replace('/projects');
  }, [user, loading, router, isPrivileged]);

  if (loading) return <div className={styles.loadingScreen}><span className={styles.spinner} /></div>;
  if (!user || !isPrivileged) return null;

  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
