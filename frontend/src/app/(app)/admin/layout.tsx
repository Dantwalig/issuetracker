'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from '../../issues.layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  useEffect(() => {
    if (!loading && user && !isPrivileged) router.replace('/projects');
  }, [user, loading, router, isPrivileged]);

  if (loading) return <div className={styles.loadingScreen}><span className={styles.spinner} /></div>;
  if (!user || !isPrivileged) return null;

  return <>{children}</>;
}
