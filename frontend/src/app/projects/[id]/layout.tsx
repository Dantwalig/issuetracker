'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useShortcut } from '@/lib/keyboard-shortcuts';
import styles from './layout.module.css';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { label: 'Overview', href: `/projects/${id}` },
    { label: 'Issues', href: `/projects/${id}/issues` },
    { label: 'Backlog', href: `/projects/${id}/backlog` },
    { label: 'Sprints', href: `/projects/${id}/sprints` },
    { label: 'Board', href: `/projects/${id}/board` },
    { label: 'Activity', href: `/projects/${id}/activity` },
  ];

  function isActive(href: string) {
    if (href === `/projects/${id}`) return pathname === href;
    return pathname.startsWith(href);
  }

  // Project tab keyboard shortcuts
  useShortcut('proj:overview', {
    key: 'o',
    description: 'Project Overview',
    group: 'Project Tabs',
    action: () => router.push(`/projects/${id}`),
  });
  useShortcut('proj:issues-tab', {
    key: 'g',
    description: 'Go to Issues',
    group: 'Project Tabs',
    action: () => router.push(`/projects/${id}/issues`),
  });
  useShortcut('proj:backlog', {
    key: 'k',
    description: 'Go to Backlog',
    group: 'Project Tabs',
    action: () => router.push(`/projects/${id}/backlog`),
  });
  useShortcut('proj:board', {
    key: 'd',
    description: 'Go to Board',
    group: 'Project Tabs',
    action: () => router.push(`/projects/${id}/board`),
  });
  useShortcut('proj:sprints', {
    key: 'q',
    description: 'Go to Sprints',
    group: 'Project Tabs',
    action: () => router.push(`/projects/${id}/sprints`),
  });
  useShortcut('proj:activity', {
    key: 'y',
    description: 'Go to Activity log',
    group: 'Project Tabs',
    action: () => router.push(`/projects/${id}/activity`),
  });

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
