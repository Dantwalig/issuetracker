'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { checklistsApi } from '@/lib/checklists-api';
import { useHeader } from '@/lib/header-context';
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

type SortField = 'title' | 'type' | 'status' | 'priority' | 'deadline' | 'storyPoints' | 'assignee' | 'reporter' | 'updatedAt';

export default function ProjectIssuesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { setBreadcrumbs, setActions } = useHeader();

  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'ALL'>('ALL');
  const [creating, setCreating] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: issues = [], isLoading, isError } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issuesApi.listByProject(projectId),
  });

  const projectName = project?.name ?? '…';

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Projects', href: '/projects' },
      { label: projectName, href: `/projects/${projectId}` },
      { label: 'Issues' },
    ]);
    setActions(
      <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
        <span>+</span> New issue
      </button>
    );
    return () => {
      setBreadcrumbs([]);
      setActions(null);
    };
  }, [setBreadcrumbs, setActions, projectId, projectName]);


  const createMutation = useMutation({
    mutationFn: (data: Omit<Parameters<typeof issuesApi.create>[1], never>) =>
      issuesApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      setShowCreate(false);
    },
  });

  const filtered = statusFilter === 'ALL' ? issues : issues.filter((i) => i.status === statusFilter);

  // Client-side sorting
  const sortedIssues = [...filtered].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    if (sortField === 'assignee') {
      valA = a.assignee?.fullName ?? '';
      valB = b.assignee?.fullName ?? '';
    } else if (sortField === 'reporter') {
      valA = a.reporter?.fullName ?? '';
      valB = b.reporter?.fullName ?? '';
    }

    if (valA == null) return sortOrder === 'asc' ? 1 : -1;
    if (valB == null) return sortOrder === 'asc' ? -1 : 1;

    if (typeof valA === 'string') {
      return sortOrder === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    } else {
      return sortOrder === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    }
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }

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

  async function handleCreate(data: any, checklists?: any[]) {
    setCreating(true);
    try {
      const created = await createMutation.mutateAsync(data);
      if (checklists && checklists.length > 0) {
        for (const list of checklists) {
          const createdList = await checklistsApi.create(created.id, list.title);
          for (const item of list.items) {
            await checklistsApi.addItem(createdList.id, item);
          }
        }
      }
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
    } finally {
      setCreating(false);
    }
  }

  const renderHeader = (label: string, field: SortField) => {
    const isCurrent = sortField === field;
    return (
      <span
        className={`${styles.sortableHeader} ${isCurrent ? styles.activeSort : ''}`}
        onClick={() => toggleSort(field)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggleSort(field)}
      >
        {label} {isCurrent && (sortOrder === 'asc' ? '↑' : '↓')}
      </span>
    );
  };

  return (
    <div className={styles.page}>


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

      {isLoading && <TableSkeleton />}
      {isError && <div className={styles.stateError}>Failed to load issues.</div>}

      {!isLoading && !isError && sortedIssues.length === 0 && (
        <div className={styles.state}>
          <p>No issues {statusFilter !== 'ALL' ? `with status "${statusFilter}"` : ''}.</p>
          <button className={styles.inlineCreate} onClick={() => setShowCreate(true)}>Create the first one →</button>
        </div>
      )}

      {!isLoading && sortedIssues.length > 0 && (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            {renderHeader('Title', 'title')}
            {renderHeader('Type', 'type')}
            {renderHeader('Status', 'status')}
            {renderHeader('Priority', 'priority')}
            {renderHeader('Deadline', 'deadline')}
            {renderHeader('SP', 'storyPoints')}
            {renderHeader('Assignee', 'assignee')}
            {renderHeader('Reporter', 'reporter')}
            {renderHeader('Updated', 'updatedAt')}
          </div>
          {sortedIssues.map((issue) => (
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

function TableSkeleton() {
  return (
    <div className={styles.table}>
      <div className={styles.tableHead}>
        <span>Title</span><span>Type</span><span>Status</span><span>Priority</span><span>Deadline</span><span>SP</span><span>Assignee</span><span>Reporter</span><span>Updated</span>
      </div>
      {[...Array(5)].map((_, idx) => (
        <div key={idx} className={`${styles.tableRow} ${styles.skeletonRow}`}>
          <div className={styles.skeletonLine} style={{ width: '70%' }} />
          <div className={styles.skeletonBadge} />
          <div className={styles.skeletonBadge} />
          <div className={styles.skeletonBadge} />
          <div className={styles.skeletonBadge} />
          <div className={styles.skeletonLine} style={{ width: '20px' }} />
          <div className={styles.skeletonLine} style={{ width: '80px' }} />
          <div className={styles.skeletonLine} style={{ width: '80px' }} />
          <div className={styles.skeletonLine} style={{ width: '90px' }} />
        </div>
      ))}
    </div>
  );
}

function IssueRow({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  return (
    <div className={styles.tableRow} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <span className={styles.issueTitle} title={issue.title}>{issue.title}</span>
      <span><TypeBadge type={issue.type} /></span>
      <span><StatusBadge status={issue.status} /></span>
      <span><PriorityBadge priority={issue.priority} /></span>
      <span><DeadlineBadge deadline={issue.deadline} status={issue.status} /></span>
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{issue.storyPoints != null ? issue.storyPoints : '—'}</span>
      <span className={styles.assignee} title={issue.assignee?.fullName ?? 'Unassigned'}>
        {issue.assignee?.fullName ?? '—'}
      </span>
      <span className={styles.reporter} title={issue.reporter?.fullName ?? 'System'}>
        {issue.reporter?.fullName ?? '—'}
      </span>
      <span className={styles.date}>{formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}</span>
    </div>
  );
}

