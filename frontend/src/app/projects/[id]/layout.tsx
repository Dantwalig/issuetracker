'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import styles from './layout.module.css';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();

  const tabs = [
    { label: 'Overview', href: `/projects/${id}` },
    { label: 'Issues', href: `/projects/${id}/issues` },
    { label: 'Backlog', href: `/projects/${id}/backlog` },
  ];

  // Exact match for overview, prefix match for the rest
  function isActive(href: string) {
    if (href === `/projects/${id}`) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div>
      <div className={styles.tabBar}>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${isActive(tab.href) ? styles.tabActive : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
