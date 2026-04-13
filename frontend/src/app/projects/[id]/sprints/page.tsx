'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { sprintsApi } from '@/lib/sprints-api';
import { projectsApi } from '@/lib/projects-api';
import { useAuth } from '@/lib/auth-context';
import { canManageSprints } from '@/lib/permissions';
import { Sprint, SprintStatus } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { format } from 'date-fns';
import styles from './page.module.css';

const STATUS_LABEL: Record<SprintStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

export default function SprintsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const isManager = canManageSprints(user, project);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    data: sprints = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      sprintsApi.create(projectId, {
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      setShowCreate(false);
      setName('');
      setStartDate('');
      setEndDate('');
    },
  });

  const startMutation = useMutation({
    mutationFn: (sprintId: string) => sprintsApi.start(projectId, sprintId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', projectId] }),
  });

  const completeMutation = useMutation({
    mutationFn: (sprintId: string) => sprintsApi.complete(projectId, sprintId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError('Name is required'); return; }
    setFormError('');
    setSaving(true);
    try {
      await createMutation.mutateAsync();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Failed to create sprint');
    } finally {
      setSaving(false);
    }
  }

  async function handleStart(sprint: Sprint) {
    try {
      await startMutation.mutateAsync(sprint.id);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to start sprint');
    }
  }

  async function handleComplete(sprint: Sprint) {
    if (!confirm(`Complete sprint "${sprint.name}"? Unfinished issues will return to the backlog.`)) return;
    try {
      await completeMutation.mutateAsync(sprint.id);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to complete sprint');
    }
  }

  const draft = sprints.filter((s) => s.status === 'DRAFT');
  const active = sprints.filter((s) => s.status === 'ACTIVE');
  const completed = sprints.filter((s) => s.status === 'COMPLETED');

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
          <span className={styles.breadCurrent}>Sprints</span>
        </div>
        {isManager && (
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            + New sprint
          </button>
        )}
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Sprints</h1>
        <p className={styles.sub}>{sprints.length} total</p>
      </div>

      {isLoading && (
        <div className={styles.state}>
          <span className={styles.spinner} />
          <span>Loading sprints…</span>
        </div>
      )}
      {isError && (
        <div className={styles.stateError}>Failed to load sprints.</div>
      )}

      {!isLoading && !isError && sprints.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><SprintIcon /></div>
          <p className={styles.emptyTitle}>No sprints yet</p>
          <p className={styles.emptyHint}>Create a sprint and move issues from the backlog into it.</p>
          {isManager && (
            <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
              + New sprint
            </button>
          )}
        </div>
      )}

      {!isLoading && sprints.length > 0 && (
        <div className={styles.sections}>
          {active.length > 0 && (
            <SprintSection
              title="Active"
              sprints={active}
              projectId={projectId}
              onStart={handleStart}
              onComplete={handleComplete}
              startPending={startMutation.isPending}
              completePending={completeMutation.isPending}
              onOpen={(s) => router.push(`/projects/${projectId}/sprints/${s.id}`)}
              isManager={isManager}
            />
          )}
          {draft.length > 0 && (
            <SprintSection
              title="Draft"
              sprints={draft}
              projectId={projectId}
              onStart={handleStart}
              onComplete={handleComplete}
              startPending={startMutation.isPending}
              completePending={completeMutation.isPending}
              onOpen={(s) => router.push(`/projects/${projectId}/sprints/${s.id}`)}
              isManager={isManager}
            />
          )}
          {completed.length > 0 && (
            <SprintSection
              title="Completed"
              sprints={completed}
              projectId={projectId}
              onStart={handleStart}
              onComplete={handleComplete}
              startPending={startMutation.isPending}
              completePending={completeMutation.isPending}
              onOpen={(s) => router.push(`/projects/${projectId}/sprints/${s.id}`)}
              isManager={isManager}
            />
          )}
        </div>
      )}

      {showCreate && (
        <Modal title="New sprint" onClose={() => { setShowCreate(false); setFormError(''); }}>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.field}>
              <label className={styles.label}>Name <span className={styles.req}>*</span></label>
              <input
                className={styles.input}
                placeholder="e.g. Sprint 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.dateRow}>
              <div className={styles.field}>
                <label className={styles.label}>Start date</label>
                <input
                  className={styles.input}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>End date</label>
                <input
                  className={styles.input}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className={styles.errorMsg}>{formError}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={saving}>
                {saving ? 'Creating…' : 'Create sprint'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── SprintSection ──────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  sprints: Sprint[];
  projectId: string;
  onStart: (s: Sprint) => void;
  onComplete: (s: Sprint) => void;
  startPending: boolean;
  completePending: boolean;
  onOpen: (s: Sprint) => void;
  isManager: boolean;
}

function SprintSection({
  title,
  sprints,
  onStart,
  onComplete,
  startPending,
  completePending,
  onOpen,
  isManager,
}: SectionProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sprintList}>
        {sprints.map((sprint) => (
          <SprintCard
            key={sprint.id}
            sprint={sprint}
            onStart={onStart}
            onComplete={onComplete}
            startPending={startPending}
            completePending={completePending}
            onOpen={onOpen}
            isManager={isManager}
          />
        ))}
      </div>
    </div>
  );
}

// ── SprintCard ─────────────────────────────────────────────────────────────

interface CardProps {
  sprint: Sprint;
  onStart: (s: Sprint) => void;
  onComplete: (s: Sprint) => void;
  startPending: boolean;
  completePending: boolean;
  onOpen: (s: Sprint) => void;
  isManager: boolean;
}

function SprintCard({ sprint, onStart, onComplete, startPending, completePending, onOpen, isManager }: CardProps) {
  return (
    <div className={`${styles.card} ${styles[`card_${sprint.status.toLowerCase()}`]}`}>
      <div className={styles.cardMain}>
        <div className={styles.cardLeft}>
          <span className={`${styles.statusDot} ${styles[`dot_${sprint.status.toLowerCase()}`]}`} />
          <div>
            <button className={styles.cardName} onClick={() => onOpen(sprint)}>
              {sprint.name}
            </button>
            <div className={styles.cardMeta}>
              <span>{sprint._count.issues} issue{sprint._count.issues !== 1 ? 's' : ''}</span>
              {sprint.startDate && (
                <>
                  <span className={styles.metaDot}>·</span>
                  <span>
                    {format(new Date(sprint.startDate), 'MMM d')}
                    {sprint.endDate && ` → ${format(new Date(sprint.endDate), 'MMM d, yyyy')}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cardActions}>
          {isManager && sprint.status === 'DRAFT' && (
            <button
              className={styles.actionBtn}
              onClick={() => onStart(sprint)}
              disabled={startPending}
            >
              Start sprint
            </button>
          )}
          {isManager && sprint.status === 'ACTIVE' && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => onComplete(sprint)}
              disabled={completePending}
            >
              Complete
            </button>
          )}
          <button className={styles.openBtn} onClick={() => onOpen(sprint)}>
            Open →
          </button>
        </div>
      </div>
    </div>
  );
}

function SprintIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M8 20a12 12 0 0 1 20.5-8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M32 20a12 12 0 0 1-20.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M28 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 24l-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
