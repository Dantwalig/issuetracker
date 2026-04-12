'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { boardApi, BoardColumns } from '@/lib/board-api';
import { projectsApi } from '@/lib/projects-api';
import { useAuth } from '@/lib/auth-context';
import { canUpdateIssueStatus } from '@/lib/permissions';
import { Issue, IssueStatus } from '@/types';
import { PriorityBadge, TypeBadge, DeadlineBadge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';

const COLUMNS: { key: IssueStatus; label: string }[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DONE', label: 'Done' },
];

export default function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  // dragError is shown when a user tries to move a card they don't have permission to update
  const [dragError, setDragError] = useState<string | null>(null);
  const dragErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss the error banner after 5 seconds
  useEffect(() => {
    if (!dragError) return;
    if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
    dragErrorTimerRef.current = setTimeout(() => setDragError(null), 5000);
    return () => {
      if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
    };
  }, [dragError]);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const {
    data: board,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['board', projectId],
    queryFn: () => boardApi.getBoard(projectId),
  });

  // Optimistic columns — mirrors server state locally during drag
  const [optimisticColumns, setOptimisticColumns] = useState<BoardColumns | null>(null);
  const columns = optimisticColumns ?? board?.columns ?? { TODO: [], IN_PROGRESS: [], DONE: [] };

  const statusMutation = useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: IssueStatus }) =>
      boardApi.updateStatus(projectId, issueId, status),
    onSuccess: (updated) => {
      setDragError(null);
      // Remove the issue from whichever column it was in, then place it in the
      // correct column based on the server-confirmed status.
      qc.setQueryData(['board', projectId], (prev: typeof board) => {
        if (!prev) return prev;
        const next: BoardColumns = { TODO: [], IN_PROGRESS: [], DONE: [] };
        for (const col of COLUMNS) {
          next[col.key] = prev.columns[col.key].filter((i) => i.id !== updated.id);
        }
        next[updated.status as IssueStatus].push(updated);
        return { ...prev, columns: next };
      });
      setOptimisticColumns(null);
    },
    onError: (error: any) => {
      // Roll back optimistic update
      setOptimisticColumns(null);
      qc.invalidateQueries({ queryKey: ['board', projectId] });
      const msg =
        error?.response?.data?.message ?? 'You do not have permission to update this issue';
      setDragError(typeof msg === 'string' ? msg : msg[0] ?? 'Update failed');
    },
  });

  // Track which column the drag is currently over
  const dragIssueRef = useRef<{ issue: Issue; fromStatus: IssueStatus } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<IssueStatus | null>(null);

  const handleDragStart = useCallback(
    (issue: Issue, fromStatus: IssueStatus) => {
      dragIssueRef.current = { issue, fromStatus };
      setDragError(null);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, toStatus: IssueStatus) => {
      e.preventDefault();
      setDragOverCol(toStatus);
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverCol(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toStatus: IssueStatus) => {
      e.preventDefault();
      setDragOverCol(null);
      const drag = dragIssueRef.current;
      if (!drag || drag.fromStatus === toStatus) {
        dragIssueRef.current = null;
        return;
      }

      // Check permission before attempting the update
      if (!canUpdateIssueStatus(user, drag.issue)) {
        dragIssueRef.current = null;
        setDragError('You can only move issues you reported or are assigned to');
        return;
      }

      // Apply optimistic update immediately
      const currentCols = board?.columns ?? { TODO: [], IN_PROGRESS: [], DONE: [] };
      const next: BoardColumns = {
        TODO: [...currentCols.TODO],
        IN_PROGRESS: [...currentCols.IN_PROGRESS],
        DONE: [...currentCols.DONE],
      };
      next[drag.fromStatus] = next[drag.fromStatus].filter((i) => i.id !== drag.issue.id);
      next[toStatus] = [...next[toStatus], { ...drag.issue, status: toStatus }];
      setOptimisticColumns(next);

      statusMutation.mutate({ issueId: drag.issue.id, status: toStatus });
      dragIssueRef.current = null;
    },
    [board, statusMutation, user],
  );

  const handleDragEnd = useCallback(() => {
    setDragOverCol(null);
    dragIssueRef.current = null;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.state}>
          <span className={styles.spinner} />
          <span>Loading board…</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <div className={styles.stateError}>Failed to load board.</div>
      </div>
    );
  }

  if (!board?.sprint) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.breadcrumb}>
            <button className={styles.breadLink} onClick={() => router.push('/projects')}>
              Projects
            </button>
            <span className={styles.sep}>/</span>
            <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}`)}>
              {project?.name ?? '…'}
            </button>
            <span className={styles.sep}>/</span>
            <span className={styles.breadCurrent}>Board</span>
          </div>
        </div>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <BoardIcon />
          </div>
          <p className={styles.emptyTitle}>No active sprint</p>
          <p className={styles.emptyHint}>
            Start a sprint from the Sprints tab to see its board here.
          </p>
          <button
            className={styles.sprintsBtn}
            onClick={() => router.push(`/projects/${projectId}/sprints`)}
          >
            Go to Sprints
          </button>
        </div>
      </div>
    );
  }

  const totalIssues = COLUMNS.reduce((n, c) => n + columns[c.key].length, 0);
  const doneCount = columns.DONE.length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <button className={styles.breadLink} onClick={() => router.push('/projects')}>
            Projects
          </button>
          <span className={styles.sep}>/</span>
          <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}`)}>
            {project?.name ?? '…'}
          </button>
          <span className={styles.sep}>/</span>
          <span className={styles.breadCurrent}>Board</span>
        </div>
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.heading}>{board.sprint.name}</h1>
        <span className={styles.sprintMeta}>
          {doneCount}/{totalIssues} done
        </span>
        {board.sprint.endDate && (
          <span className={styles.endDate}>
            Ends {formatDistanceToNow(new Date(board.sprint.endDate), { addSuffix: true })}
          </span>
        )}
        {statusMutation.isPending && (
          <span className={styles.saving}>Saving…</span>
        )}
      </div>

      {dragError && (
        <div className={styles.dragError} role="alert">
          {dragError}
          <button
            className={styles.dragErrorClose}
            onClick={() => setDragError(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.board}>
        {COLUMNS.map(({ key, label }) => (
          <Column
            key={key}
            status={key}
            label={label}
            issues={columns[key]}
            isDragOver={dragOverCol === key}
            onDragOver={(e) => handleDragOver(e, key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, key)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onIssueClick={(issue) =>
              router.push(`/projects/${projectId}/issues/${issue.id}`)
            }
            currentUser={user}
          />
        ))}
      </div>
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────────────────

interface ColumnProps {
  status: IssueStatus;
  label: string;
  issues: Issue[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (issue: Issue, status: IssueStatus) => void;
  onDragEnd: () => void;
  onIssueClick: (issue: Issue) => void;
  currentUser: ReturnType<typeof useAuth>['user'];
}

function Column({
  status,
  label,
  issues,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onIssueClick,
  currentUser,
}: ColumnProps) {
  return (
    <div
      className={`${styles.column} ${isDragOver ? styles.columnDragOver : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={styles.columnHeader}>
        <div className={styles.columnTitle}>
          <span className={`${styles.columnDot} ${styles[`dot${status}`]}`} />
          <span>{label}</span>
        </div>
        <span className={styles.columnCount}>{issues.length}</span>
      </div>

      <div className={styles.cardList}>
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            status={status}
            canDrag={canUpdateIssueStatus(currentUser, issue)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onIssueClick(issue)}
          />
        ))}
        {issues.length === 0 && (
          <div className={`${styles.columnEmpty} ${isDragOver ? styles.columnEmptyActive : ''}`}>
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ── Issue card ─────────────────────────────────────────────────────────────

interface CardProps {
  issue: Issue;
  status: IssueStatus;
  canDrag: boolean;
  onDragStart: (issue: Issue, status: IssueStatus) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function IssueCard({ issue, status, canDrag, onDragStart, onDragEnd, onClick }: CardProps) {
  return (
    <div
      className={`${styles.card} ${!canDrag ? styles.cardReadOnly : ''}`}
      draggable={canDrag}
      onDragStart={canDrag ? () => onDragStart(issue, status) : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p className={styles.cardTitle} style={{ margin: 0, flex: 1 }}>{issue.title}</p>
        {issue.storyPoints != null && (
          <span style={{
            flexShrink: 0, minWidth: 22, height: 22,
            background: 'var(--accent-dim)', color: 'var(--accent)',
            borderRadius: '50%', fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--accent)',
          }} title="Story points">
            {issue.storyPoints}
          </span>
        )}
      </div>

      <div className={styles.cardMeta}>
        <TypeBadge type={issue.type} />
        <PriorityBadge priority={issue.priority} />
        <DeadlineBadge deadline={issue.deadline} status={issue.status} />
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.cardReporter} title={issue.reporter.fullName}>
          <span className={styles.avatar}>{issue.reporter.fullName[0].toUpperCase()}</span>
          {issue.assignee && (
            <>
              <span className={styles.arrowRight}>→</span>
              <span className={styles.avatar} title={issue.assignee.fullName}>
                {issue.assignee.fullName[0].toUpperCase()}
              </span>
            </>
          )}
        </span>
        <span className={styles.cardDate}>
          {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function BoardIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="8" width="9" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="16" y="8" width="9" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="28" y="8" width="9" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
