'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { sprintsApi } from '@/lib/sprints-api';
import { projectsApi } from '@/lib/projects-api';
import { useAuth } from '@/lib/auth-context';
import { canManageSprints } from '@/lib/permissions';
import { Issue, Sprint } from '@/types';
import { StatusBadge, PriorityBadge, TypeBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { format } from 'date-fns';
import styles from './page.module.css';

export default function SprintDetailPage() {
  const { id: projectId, sprintId } = useParams<{
    id: string;
    sprintId: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = canManageSprints(user);

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);

  /* ── Queries ──────────────────────────────────────────────────────────── */
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const {
    data: sprint,
    isLoading: sprintLoading,
    isError: sprintError,
  } = useQuery({
    queryKey: ['sprint', projectId, sprintId],
    queryFn: () => sprintsApi.get(projectId, sprintId),
  });

  const { data: sprintIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: ['sprintIssues', sprintId],
    queryFn: () => sprintsApi.getIssues(projectId, sprintId),
  });

  // Only fetch backlog when planning panel is open
  const { data: backlogIssues = [], isLoading: backlogLoading } = useQuery({
    queryKey: ['backlog', projectId],
    queryFn: () =>
      import('@/lib/backlog-api').then((m) =>
        m.backlogApi.list(projectId),
      ),
    enabled: showPlanning,
  });

  /* ── Mutations ────────────────────────────────────────────────────────── */
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; startDate?: string; endDate?: string }) =>
      sprintsApi.update(projectId, sprintId, data),
    onSuccess: (updated) => {
      qc.setQueryData(['sprint', projectId, sprintId], updated);
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      setShowEdit(false);
    },
  });

  const startMutation = useMutation({
    mutationFn: () => sprintsApi.start(projectId, sprintId),
    onSuccess: (updated) => {
      qc.setQueryData(['sprint', projectId, sprintId], updated);
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => sprintsApi.complete(projectId, sprintId),
    onSuccess: (updated) => {
      qc.setQueryData(['sprint', projectId, sprintId], updated);
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
    },
  });

  const addIssueMutation = useMutation({
    mutationFn: (issueId: string) =>
      sprintsApi.addIssue(projectId, sprintId, issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprintIssues', sprintId] });
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });

  const removeIssueMutation = useMutation({
    mutationFn: (issueId: string) =>
      sprintsApi.removeIssue(projectId, sprintId, issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprintIssues', sprintId] });
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  function openEdit() {
    setEditName(sprint!.name);
    setEditStart(sprint!.startDate ? sprint!.startDate.slice(0, 10) : '');
    setEditEnd(sprint!.endDate ? sprint!.endDate.slice(0, 10) : '');
    setEditError('');
    setShowEdit(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { setEditError('Name is required'); return; }
    setEditSaving(true); setEditError('');
    try {
      await updateMutation.mutateAsync({
        name: editName.trim(),
        startDate: editStart || undefined,
        endDate: editEnd || undefined,
      });
    } catch (err: any) {
      setEditError(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleStart() {
    try { await startMutation.mutateAsync(); }
    catch (err: any) { alert(err?.response?.data?.message ?? 'Failed to start sprint'); }
  }

  async function handleComplete() {
    if (!confirm(`Complete sprint "${sprint?.name}"? Unfinished issues will return to the backlog.`)) return;
    try { await completeMutation.mutateAsync(); }
    catch (err: any) { alert(err?.response?.data?.message ?? 'Failed to complete sprint'); }
  }

  /* ── Render guards ─────────────────────────────────────────────────────── */
  if (sprintLoading)
    return <div className={styles.center}><span className={styles.spinner} /></div>;
  if (sprintError || !sprint)
    return (
      <div className={styles.center}>
        <p>Sprint not found.</p>
        <button className={styles.backLink} onClick={() => router.push(`/projects/${projectId}/sprints`)}>
          ← Back to sprints
        </button>
      </div>
    );

  const isCompleted = sprint.status === 'COMPLETED';

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.topBar}>
        <nav className={styles.breadcrumb}>
          <button className={styles.breadLink} onClick={() => router.push('/projects')}>Projects</button>
          <span className={styles.sep}>/</span>
          <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}`)}>{project?.name ?? '…'}</button>
          <span className={styles.sep}>/</span>
          <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}/sprints`)}>Sprints</button>
          <span className={styles.sep}>/</span>
          <span className={styles.breadCurrent}>{sprint.name}</span>
        </nav>
        <div className={styles.topActions}>
          {isManager && !isCompleted && (
            <button className={styles.editBtn} onClick={openEdit}>Edit</button>
          )}
          {isManager && sprint.status === 'DRAFT' && (
            <button className={styles.startBtn} onClick={handleStart} disabled={startMutation.isPending}>
              {startMutation.isPending ? 'Starting…' : 'Start sprint'}
            </button>
          )}
          {isManager && sprint.status === 'ACTIVE' && (
            <button className={styles.completeBtn} onClick={handleComplete} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? 'Completing…' : 'Complete sprint'}
            </button>
          )}
        </div>
      </div>

      {/* Sprint header card */}
      <div className={styles.headerCard}>
        <div className={styles.headerLeft}>
          <span className={`${styles.statusPill} ${styles[`pill_${sprint.status.toLowerCase()}`]}`}>
            {sprint.status === 'DRAFT' ? 'Draft' : sprint.status === 'ACTIVE' ? 'Active' : 'Completed'}
          </span>
          <h1 className={styles.sprintName}>{sprint.name}</h1>
          <div className={styles.sprintMeta}>
            <span>{sprintIssues.length} issue{sprintIssues.length !== 1 ? 's' : ''}</span>
            {sprint.startDate && (
              <>
                <span className={styles.metaDot}>·</span>
                <span>
                  {format(new Date(sprint.startDate), 'MMM d, yyyy')}
                  {sprint.endDate && ` → ${format(new Date(sprint.endDate), 'MMM d, yyyy')}`}
                </span>
              </>
            )}
          </div>
        </div>
        {isManager && !isCompleted && (
          <button
            className={styles.planBtn}
            onClick={() => setShowPlanning(!showPlanning)}
          >
            {showPlanning ? 'Close planning' : '+ Add from backlog'}
          </button>
        )}
      </div>

      {/* Planning panel: backlog issues to add */}
      {isManager && showPlanning && (
        <div className={styles.planningPanel}>
          <div className={styles.planningHeader}>
            <h2 className={styles.panelTitle}>Backlog — click an issue to add it to this sprint</h2>
          </div>
          {backlogLoading && (
            <div className={styles.panelState}><span className={styles.spinner} /> Loading backlog…</div>
          )}
          {!backlogLoading && backlogIssues.length === 0 && (
            <p className={styles.panelEmpty}>No backlog issues available.</p>
          )}
          {!backlogLoading && backlogIssues.length > 0 && (
            <div className={styles.issueList}>
              {backlogIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  action={
                    <button
                      className={styles.addIssueBtn}
                      disabled={addIssueMutation.isPending}
                      onClick={() => addIssueMutation.mutate(issue.id)}
                    >
                      + Add
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sprint issues */}
      <div className={styles.issuesSection}>
        <h2 className={styles.issuesSectionTitle}>
          Sprint issues
          <span className={styles.issueCount}>{sprintIssues.length}</span>
        </h2>

        {issuesLoading && (
          <div className={styles.state}><span className={styles.spinner} /></div>
        )}

        {!issuesLoading && sprintIssues.length === 0 && (
          <div className={styles.emptyIssues}>
            {isCompleted
              ? 'This sprint has no issues.'
              : 'No issues in this sprint yet. Use "Add from backlog" to plan it.'}
          </div>
        )}

        {!issuesLoading && sprintIssues.length > 0 && (
          <div className={styles.issueList}>
            {sprintIssues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)}
                action={
                  isManager && !isCompleted ? (
                    <button
                      className={styles.removeIssueBtn}
                      disabled={removeIssueMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeIssueMutation.mutate(issue.id);
                      }}
                    >
                      Remove
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <Modal title="Edit sprint" onClose={() => setShowEdit(false)}>
          <form className={styles.form} onSubmit={handleEdit}>
            <div className={styles.field}>
              <label className={styles.label}>Name <span className={styles.req}>*</span></label>
              <input
                className={styles.input}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.dateRow}>
              <div className={styles.field}>
                <label className={styles.label}>Start date</label>
                <input
                  className={styles.input}
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>End date</label>
                <input
                  className={styles.input}
                  type="date"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>
            </div>
            {editError && <p className={styles.errorMsg}>{editError}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit" className={styles.submitBtn} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ── IssueRow ─────────────────────────────────────────────────────────────── */
function IssueRow({
  issue,
  onClick,
  action,
}: {
  issue: Issue;
  onClick?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`${styles.issueRow} ${onClick ? styles.issueRowClickable : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className={styles.issueTitle}>{issue.title}</span>
      <span><TypeBadge type={issue.type} /></span>
      <span><PriorityBadge priority={issue.priority} /></span>
      <span><StatusBadge status={issue.status} /></span>
      <span className={styles.issueReporter}>{issue.reporter.fullName}</span>
      {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
    </div>
  );
}
