'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recycleBinApi } from '@/lib/recycle-bin-api';
import { BackButton } from '@/components/ui/BackButton';
import { DeletedItem, DeletedItemType } from '@/types';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import styles from './page.module.css';

function typeIcon(t: DeletedItemType) {
  if (t === 'ISSUE') return '🎯';
  if (t === 'PROJECT') return '📁';
  return '👥';
}

function daysLeft(expiresAt: string) {
  return Math.max(0, differenceInDays(new Date(expiresAt), new Date()));
}

export default function RecycleBinPage() {
  const qc = useQueryClient();
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
        {(['ALL', 'ISSUE', 'PROJECT', 'TEAM'] as const).map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'ALL' ? '🔔 All' : f === 'ISSUE' ? '🎯 Issues' : f === 'PROJECT' ? '📁 Projects' : '👥 Teams'}
            <span className={styles.filterCount}>
              {f === 'ALL' ? items.length : items.filter(i => i.itemType === f).length}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <div className={styles.state}><span className={styles.spinner} /></div>}
      {!isLoading && filtered.length === 0 && (
        <div className={styles.empty}>
          <p style={{ fontSize: 32, margin: '0 0 12px' }}>🗑️</p>
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
                <span className={styles.typeIcon}>{typeIcon(item.itemType)}</span>
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
                >
                  ↩ Restore
                </button>
                {confirmId === item.id ? (
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmText}>Permanently delete?</span>
                    <button className={styles.confirmYes} onClick={() => hardDeleteMutation.mutate(item.id)} disabled={hardDeleteMutation.isPending}>
                      {hardDeleteMutation.isPending ? '…' : 'Yes'}
                    </button>
                    <button className={styles.confirmNo} onClick={() => setConfirmId(null)}>No</button>
                  </div>
                ) : (
                  <button className={styles.hardDeleteBtn} onClick={() => setConfirmId(item.id)}>
                    🗑 Delete forever
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
