'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { Issue, IssueStatus, IssueUser } from '@/types';
import { StatusBadge, PriorityBadge, TypeBadge, DeadlineBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { IssueForm } from '@/components/issues/IssueForm';
import { formatDistanceToNow } from 'date-fns';
import { useShortcut } from '@/lib/keyboard-shortcuts';
import styles from './page.module.css';

const STATUS_FILTERS: { label: string; value: IssueStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Todo', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
];

export default function ProjectIssuesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'ALL'>('ALL');
  const [creating, setCreating] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: issues = [], isLoading, isError } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issuesApi.listByProject(projectId),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Parameters<typeof issuesApi.create>[1], never>) =>
      issuesApi.create(projectId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issues', projectId] }); setShowCreate(false); },
  });

  const filtered = statusFilter === 'ALL' ? issues : issues.filter((i) => i.status === statusFilter);

  // Derive project members as IssueUser[] for the assignee dropdown
  const projectMembers: IssueUser[] = (project?.members ?? []).map((m) => m.user);

  // Keyboard shortcuts
  useShortcut('issues:create', {
    key: 'n',
    description: 'Create new issue',
    group: 'Issues',
    action: () => setShowCreate(true),
  });
  useShortcut('issues:create-escape', {
    key: 'Escape',
    description: 'Close dialog / cancel',
    group: 'Global',
    action: () => setShowCreate(false),
    disabled: !showCreate,
  });
  useShortcut('issues:filter-all', {
    key: 'a',
    description: 'Show all issues',
    group: 'Issues',
    action: () => setStatusFilter('ALL'),
  });
  useShortcut('issues:filter-todo', {
    key: '1',
    description: 'Filter: To Do',
    group: 'Issues',
    action: () => setStatusFilter('TODO'),
  });
  useShortcut('issues:filter-progress', {
    key: '2',
    description: 'Filter: In Progress',
    group: 'Issues',
    action: () => setStatusFilter('IN_PROGRESS'),
  });
  useShortcut('issues:filter-done', {
    key: '3',
    description: 'Filter: Done',
    group: 'Issues',
    action: () => setStatusFilter('DONE'),
  });

  async function handleCreate(data: any) {
    setCreating(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <button className={styles.breadLink} onClick={() => router.push('/projects')}>Projects</button>
          <span className={styles.sep}>/</span>
          <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}`)}>{project?.name ?? '…'}</button>
          <span className={styles.sep}>/</span>
          <span className={styles.breadCurrent}>Issues</span>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <span>+</span> New issue
        </button>
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Issues</h1>
        <p className={styles.sub}>{issues.length} total</p>
      </div>

      <div className={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${statusFilter === f.value ? styles.filterActive : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
            <span className={styles.filterCount}>
              {f.value === 'ALL' ? issues.length : issues.filter((i) => i.status === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <div className={styles.state}><span className={styles.spinner} /><span>Loading issues…</span></div>}
      {isError && <div className={styles.stateError}>Failed to load issues.</div>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className={styles.state}>
          <p>No issues {statusFilter !== 'ALL' ? `with status "${statusFilter}"` : ''}.</p>
          <button className={styles.inlineCreate} onClick={() => setShowCreate(true)}>Create the first one →</button>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Title</span><span>Type</span><span>Status</span><span>Priority</span><span>Deadline</span><span>SP</span><span>Reporter</span><span>Updated</span>
          </div>
          {filtered.map((issue) => (
            <IssueRow key={issue.id} issue={issue}
              onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)} />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="New issue" onClose={() => setShowCreate(false)}>
          <IssueForm
            projectMembers={projectMembers}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            loading={creating}
            submitLabel="Create issue"
          />
        </Modal>
      )}
    </div>
  );
}

function IssueRow({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  return (
    <div className={styles.tableRow} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <span className={styles.issueTitle}>{issue.title}</span>
      <span><TypeBadge type={issue.type} /></span>
      <span><StatusBadge status={issue.status} /></span>
      <span><PriorityBadge priority={issue.priority} /></span>
      <span><DeadlineBadge deadline={issue.deadline} status={issue.status} /></span>
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{issue.storyPoints != null ? issue.storyPoints : '—'}</span>
      <span className={styles.reporter}>{issue.reporter?.fullName}</span>
      <span className={styles.date}>{formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}</span>
    </div>
  );
}
