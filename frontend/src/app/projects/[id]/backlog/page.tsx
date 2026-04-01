'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { backlogApi } from '@/lib/backlog-api';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { Issue } from '@/types';
import { StatusBadge, PriorityBadge, TypeBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { IssueForm } from '@/components/issues/IssueForm';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';

export default function BacklogPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Drag state
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<Issue[] | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const {
    data: backlog = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['backlog', projectId],
    queryFn: () => backlogApi.list(projectId),
    // Keep local order in sync when query refreshes (but not during drag)
    select: (data) => data,
  });

  // Use localOrder while dragging / after reorder, fall back to server data
  const issues = localOrder ?? backlog;

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => backlogApi.reorder(projectId, orderedIds),
    onSuccess: (updated) => {
      qc.setQueryData(['backlog', projectId], updated);
      setLocalOrder(null);
    },
    onError: () => {
      setLocalOrder(null);
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof issuesApi.create>[1]) =>
      issuesApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
      setShowCreate(false);
    },
  });

  async function handleCreate(data: any) {
    setCreating(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setCreating(false);
    }
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIndexRef.current === null || dragIndexRef.current === index) return;
      setDragOverIndex(index);

      const from = dragIndexRef.current;
      const to = index;
      const next = [...issues];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      dragIndexRef.current = to;
      setLocalOrder(next);
    },
    [issues],
  );

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    if (localOrder) {
      reorderMutation.mutate(localOrder.map((i) => i.id));
    }
    dragIndexRef.current = null;
  }, [localOrder, reorderMutation]);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <button
            className={styles.breadLink}
            onClick={() => router.push('/projects')}
          >
            Projects
          </button>
          <span className={styles.sep}>/</span>
          <button
            className={styles.breadLink}
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            {project?.name ?? '…'}
          </button>
          <span className={styles.sep}>/</span>
          <span className={styles.breadCurrent}>Backlog</span>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <span>+</span> New issue
        </button>
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Backlog</h1>
        <p className={styles.sub}>{issues.length} issue{issues.length !== 1 ? 's' : ''}</p>
        {reorderMutation.isPending && (
          <span className={styles.saving}>Saving order…</span>
        )}
      </div>

      {/* States */}
      {isLoading && (
        <div className={styles.state}>
          <span className={styles.spinner} />
          <span>Loading backlog…</span>
        </div>
      )}
      {isError && (
        <div className={styles.stateError}>Failed to load backlog.</div>
      )}

      {!isLoading && !isError && issues.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <BacklogIcon />
          </div>
          <p className={styles.emptyTitle}>Backlog is empty</p>
          <p className={styles.emptyHint}>
            Issues without a sprint appear here. Create one to get started.
          </p>
          <button
            className={styles.createBtn}
            onClick={() => setShowCreate(true)}
          >
            + New issue
          </button>
        </div>
      )}

      {!isLoading && issues.length > 0 && (
        <div className={styles.list}>
          <div className={styles.listHead}>
            <span className={styles.colHandle} />
            <span className={styles.colOrder}>#</span>
            <span className={styles.colTitle}>Title</span>
            <span className={styles.colBadge}>Type</span>
            <span className={styles.colBadge}>Priority</span>
            <span className={styles.colBadge}>Status</span>
            <span className={styles.colMeta}>Reporter</span>
            <span className={styles.colMeta}>Updated</span>
          </div>

          {issues.map((issue, index) => (
            <BacklogRow
              key={issue.id}
              issue={issue}
              index={index}
              isDragOver={dragOverIndex === index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onClick={() =>
                router.push(`/projects/${projectId}/issues/${issue.id}`)
              }
            />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="New issue" onClose={() => setShowCreate(false)}>
          <IssueForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            loading={creating}
            submitLabel="Add to backlog"
          />
        </Modal>
      )}
    </div>
  );
}

// ── BacklogRow ────────────────────────────────────────────────────────────────

interface RowProps {
  issue: Issue;
  index: number;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function BacklogRow({
  issue,
  index,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onClick,
}: RowProps) {
  return (
    <div
      className={`${styles.row} ${isDragOver ? styles.rowDragOver : ''}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Backlog item: ${issue.title}`}
    >
      <span className={styles.handle} title="Drag to reorder">
        <DragIcon />
      </span>
      <span className={styles.orderNum}>{index + 1}</span>
      <span className={styles.title}>{issue.title}</span>
      <span><TypeBadge type={issue.type} /></span>
      <span><PriorityBadge priority={issue.priority} /></span>
      <span><StatusBadge status={issue.status} /></span>
      <span className={styles.meta}>{issue.reporter.fullName}</span>
      <span className={styles.date}>
        {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
      </span>
    </div>
  );
}

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="4.5" cy="3" r="1.2" fill="currentColor" />
      <circle cx="9.5" cy="3" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="7" r="1.2" fill="currentColor" />
      <circle cx="9.5" cy="7" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="11" r="1.2" fill="currentColor" />
      <circle cx="9.5" cy="11" r="1.2" fill="currentColor" />
    </svg>
  );
}

function BacklogIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="6" y="8" width="28" height="5" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="17" width="28" height="5" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="26" width="18" height="5" rx="2.5" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
    </svg>
  );
}
