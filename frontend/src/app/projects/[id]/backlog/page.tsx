'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { backlogApi } from '@/lib/backlog-api';
import { sprintsApi } from '@/lib/sprints-api';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { useAuth } from '@/lib/auth-context';
import { canManageSprints } from '@/lib/permissions';
import { Issue } from '@/types';
import { StatusBadge, PriorityBadge, TypeBadge, DeadlineBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { IssueForm } from '@/components/issues/IssueForm';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';

export default function BacklogPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = canManageSprints(user);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const dragIndexRef = useRef<number | null>(null);
  const pendingOrderRef = useRef<Issue[] | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<Issue[] | null>(null);

  // Keep ref in sync so dragEnd can read the latest order without depending on state
  useEffect(() => { pendingOrderRef.current = localOrder; }, [localOrder]);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: backlog = [], isLoading, isError } = useQuery({
    queryKey: ['backlog', projectId],
    queryFn: () => backlogApi.list(projectId),
  });

  // Fetch sprints to find the active one (for the "Add to sprint" shortcut)
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
  });
  const activeSprint = sprints.find((s) => s.status === 'ACTIVE') ?? null;

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

  const addToSprintMutation = useMutation({
    mutationFn: ({ issueId, sprintId }: { issueId: string; sprintId: string }) =>
      sprintsApi.addIssue(projectId, sprintId, issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['sprintIssues', activeSprint?.id ?? ''] });
    },
  });

  async function handleCreate(data: any) {
    setCreating(true);
    try { await createMutation.mutateAsync(data); }
    finally { setCreating(false); }
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
    // Snapshot the current order into the ref so we can mutate it in-flight
    pendingOrderRef.current = [...(localOrder ?? backlog)];
  }, [localOrder, backlog]);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIndexRef.current === null || dragIndexRef.current === index) return;
      setDragOverIndex(index);
      const from = dragIndexRef.current;
      // Mutate the ref array directly — no setState, no re-render mid-drag
      const current = pendingOrderRef.current ?? [...(localOrder ?? backlog)];
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      dragIndexRef.current = index;
      pendingOrderRef.current = next;
    },
    [localOrder, backlog],
  );

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    dragIndexRef.current = null;
    const final = pendingOrderRef.current;
    if (final) {
      // Commit the final order to state (one re-render) then fire the mutation
      setLocalOrder(final);
      reorderMutation.mutate(final.map((i) => i.id));
    }
  }, [reorderMutation]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <button className={styles.breadLink} onClick={() => router.push('/projects')}>Projects</button>
          <span className={styles.sep}>/</span>
          <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}`)}>
            {project?.name ?? '…'}
          </button>
          <span className={styles.sep}>/</span>
          <span className={styles.breadCurrent}>Backlog</span>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          + New issue
        </button>
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Backlog</h1>
        <p className={styles.sub}>
          {issues.length} issue{issues.length !== 1 ? 's' : ''}
          {issues.some(i => i.storyPoints != null) && (
            <> · {issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0)} SP total</>
          )}
        </p>
        {reorderMutation.isPending && <span className={styles.saving}>Saving order…</span>}
        {activeSprint && (
          <span className={styles.activeSprintHint}>
            Active sprint: <strong>{activeSprint.name}</strong>
          </span>
        )}
      </div>

      {isLoading && (
        <div className={styles.state}>
          <span className={styles.spinner} /><span>Loading backlog…</span>
        </div>
      )}
      {isError && <div className={styles.stateError}>Failed to load backlog.</div>}

      {!isLoading && !isError && issues.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><BacklogIcon /></div>
          <p className={styles.emptyTitle}>Backlog is empty</p>
          <p className={styles.emptyHint}>Issues without a sprint appear here.</p>
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>+ New issue</button>
        </div>
      )}

      {!isLoading && issues.length > 0 && (
        <div className={styles.list}>
          <div className={styles.listHead}>
            <span />
            <span className={styles.colOrder}>#</span>
            <span>Title</span>
            <span>Type</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Reporter</span>
            <span>Updated</span>
            {activeSprint && isManager && <span>Sprint</span>}
          </div>

          {issues.map((issue, index) => (
            <BacklogRow
              key={issue.id}
              issue={issue}
              index={index}
              isDragOver={dragOverIndex === index}
              activeSprint={activeSprint}
              addingToSprint={addToSprintMutation.isPending}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)}
              onAddToSprint={() =>
                activeSprint && addToSprintMutation.mutate({ issueId: issue.id, sprintId: activeSprint.id })
              }
              isManager={isManager}
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

interface RowProps {
  issue: Issue;
  index: number;
  isDragOver: boolean;
  activeSprint: { id: string; name: string } | null;
  addingToSprint: boolean;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onAddToSprint: () => void;
  isManager: boolean;
}

function BacklogRow({
  issue, index, isDragOver, activeSprint, addingToSprint,
  onDragStart, onDragOver, onDragEnd, onClick, onAddToSprint, isManager,
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
    >
      <span className={styles.handle} title="Drag to reorder"><DragIcon /></span>
      <span className={styles.orderNum}>{index + 1}</span>
      <span className={styles.title}>{issue.title}</span>
      <DeadlineBadge deadline={issue.deadline} status={issue.status} />
      {issue.storyPoints != null && (
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 99, padding: '1px 7px' }}>
          {issue.storyPoints} SP
        </span>
      )}
      <span><TypeBadge type={issue.type} /></span>
      <span><PriorityBadge priority={issue.priority} /></span>
      <span><StatusBadge status={issue.status} /></span>
      <span className={styles.meta}>{issue.reporter?.fullName}</span>
      <span className={styles.date}>{formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}</span>
      {activeSprint && isManager && (
        <span onClick={(e) => e.stopPropagation()}>
          <button
            className={styles.sprintBtn}
            disabled={addingToSprint}
            onClick={onAddToSprint}
            title={`Add to ${activeSprint.name}`}
          >
            → Sprint
          </button>
        </span>
      )}
      {activeSprint && !isManager && <span />}
    </div>
  );
}

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="4.5" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="9.5" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="4.5" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="9.5" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="4.5" cy="11" r="1.2" fill="currentColor"/>
      <circle cx="9.5" cy="11" r="1.2" fill="currentColor"/>
    </svg>
  );
}

function BacklogIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="6" y="8" width="28" height="5" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="6" y="17" width="28" height="5" rx="2.5" stroke="currentColor" strokeWidth="2"/>
      <rect x="6" y="26" width="18" height="5" rx="2.5" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2"/>
    </svg>
  );
}
