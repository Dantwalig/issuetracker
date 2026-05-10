'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recycleBinApi } from '@/lib/recycle-bin-api';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import { isAdmin } from '@/lib/permissions';
import { DeletedItem, DeletedItemType } from '@/types';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import styles from './page.module.css';

// ── Icons ─────────────────────────────────────────────────────────────────────
function IssueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ProjectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5H12.5A1.5 1.5 0 0 1 14 6v5.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5V4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}
function TeamIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M14.5 13c0-2-1.2-3.2-3-3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function AllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}
function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8a5 5 0 1 1 1.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3 4.5V8H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 4h11M5.5 4V2.5h5V4M6.5 7v5M9.5 7v5M3.5 4l1 9.5h7l1-9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function EmptyTrashIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <path d="M6 10h28M13 10V7h14v3M9 10l2.5 23h17L31 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 17v10M20 17v10M24 17v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function TypeIcon({ type }: { type: DeletedItemType }) {
  if (type === 'ISSUE') return <IssueIcon />;
  if (type === 'PROJECT') return <ProjectIcon />;
  return <TeamIcon />;
}

function daysLeft(expiresAt: string) {
  return Math.max(0, differenceInDays(new Date(expiresAt), new Date()));
}

export default function RecycleBinPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<DeletedItemType | 'ALL'>('ALL');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<DeletedItem[]>({
    queryKey: ['recycle-bin'],
    queryFn: recycleBinApi.list,
  });

  const restoreMutation = useMutation({
    mutationFn: recycleBinApi.restore,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recycle-bin'] }),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: recycleBinApi.hardDelete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recycle-bin'] }); setConfirmId(null); },
  });

  const filtered = filter === 'ALL' ? items : items.filter(i => i.itemType === filter);
  const canHardDelete = isAdmin(user);

  const filterOptions: { key: DeletedItemType | 'ALL'; label: string; icon: React.ReactNode }[] = [
    { key: 'ALL',     label: 'All',      icon: <AllIcon /> },
    { key: 'ISSUE',   label: 'Issues',   icon: <IssueIcon /> },
    { key: 'PROJECT', label: 'Projects', icon: <ProjectIcon /> },
    { key: 'TEAM',    label: 'Teams',    icon: <TeamIcon /> },
  ];

  return (
    <div className={styles.page}>
      <BackButton href="/projects" label="Back" />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Recycle Bin</h1>
          <p className={styles.sub}>Items are permanently deleted after 30 days</p>
        </div>
      </div>

      <div className={styles.filters}>
        {filterOptions.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`${styles.filterBtn} ${filter === key ? styles.filterActive : ''}`}
            onClick={() => setFilter(key)}
          >
            <span className={styles.filterIcon}>{icon}</span>
            {label}
            <span className={styles.filterCount}>
              {key === 'ALL' ? items.length : items.filter(i => i.itemType === key).length}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <div className={styles.state}><span className={styles.spinner} /></div>}
      {!isLoading && filtered.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><EmptyTrashIcon /></span>
          <p>Recycle bin is empty.</p>
        </div>
      )}

      <div className={styles.list}>
        {filtered.map(item => {
          const snap = item.itemSnapshot as any;
          const name = snap?.title ?? snap?.name ?? item.itemId;
          const left = daysLeft(item.expiresAt);
          return (
            <div key={item.id} className={styles.card}>
              <div className={styles.cardLeft}>
                <span className={styles.typeIcon}><TypeIcon type={item.itemType} /></span>
                <div className={styles.info}>
                  <p className={styles.name}>{name}</p>
                  <p className={styles.meta}>
                    {item.itemType} · Deleted by <strong>{item.deletedBy.fullName}</strong>
                    {' '}· {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                  </p>
                  <p className={styles.reason}>Reason: {item.reason}</p>
                  <p className={`${styles.expiry} ${left <= 3 ? styles.expiryUrgent : ''}`}>
                    {left === 0 ? 'Expires today' : `Expires in ${left} day${left !== 1 ? 's' : ''}`}
                    {' '}· {format(new Date(item.expiresAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.restoreBtn}
                  onClick={() => restoreMutation.mutate(item.id)}
                  disabled={restoreMutation.isPending}
                  aria-label={`Restore ${name}`}
                >
                  <RestoreIcon /> Restore
                </button>
                {canHardDelete && (
                  confirmId === item.id ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>Permanently delete?</span>
                      <button className={styles.confirmYes} onClick={() => hardDeleteMutation.mutate(item.id)} disabled={hardDeleteMutation.isPending}>
                        {hardDeleteMutation.isPending ? '…' : 'Yes'}
                      </button>
                      <button className={styles.confirmNo} onClick={() => setConfirmId(null)}>No</button>
                    </div>
                  ) : (
                    <button className={styles.hardDeleteBtn} onClick={() => setConfirmId(item.id)} aria-label={`Permanently delete ${name}`}>
                      <TrashIcon /> Delete forever
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
