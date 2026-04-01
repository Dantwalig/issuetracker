'use client';

import { useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { boardApi, BoardColumns } from '@/lib/board-api';
import { projectsApi } from '@/lib/projects-api';
import { Issue, IssueStatus } from '@/types';
import { PriorityBadge, TypeBadge } from '@/components/ui/Badge';
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
      // Merge the updated issue back into the server cache
      qc.setQueryData(['board', projectId], (prev: typeof board) => {
        if (!prev) return prev;
        const next: BoardColumns = { TODO: [], IN_PROGRESS: [], DONE: [] };
        for (const col of COLUMNS) {
          next[col.key] = prev.columns[col.key]
            .filter((i) => i.id !== updated.id)
            .concat(prev.columns[col.key].find((i) => i.id === updated.id) ? [] : []);
        }
        // Place updated issue in its new column
        for (const col of COLUMNS) {
          next[col.key] = prev.columns[col.key].filter((i) => i.id !== updated.id);
        }
        next[updated.status as IssueStatus].push(updated);
        return { ...prev, columns: next };
      });
      setOptimisticColumns(null);
    },
    onError: () => {
      // Roll back optimistic update
      setOptimisticColumns(null);
      qc.invalidateQueries({ queryKey: ['board', projectId] });
    },
  });

  // Track which column the drag is currently over
  const dragIssueRef = useRef<{ issue: Issue; fromStatus: IssueStatus } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<IssueStatus | null>(null);

  const handleDragStart = useCallback(
    (issue: Issue, fromStatus: IssueStatus) => {
      dragIssueRef.current = { issue, fromStatus };
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
    [board, statusMutation],
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
  onDragStart: (issue: Issue, status: IssueStatus) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function IssueCard({ issue, status, onDragStart, onDragEnd, onClick }: CardProps) {
  return (
    <div
      className={styles.card}
      draggable
      onDragStart={() => onDragStart(issue, status)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <p className={styles.cardTitle}>{issue.title}</p>

      <div className={styles.cardMeta}>
        <TypeBadge type={issue.type} />
        <PriorityBadge priority={issue.priority} />
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
