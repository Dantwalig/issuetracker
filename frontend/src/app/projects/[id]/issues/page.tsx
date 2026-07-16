'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { checklistsApi } from '@/lib/checklists-api';
import { useHeader } from '@/lib/header-context';
import { useAuth } from '@/lib/auth-context';
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

type SortKey = 'title' | 'type' | 'status' | 'priority' | 'deadline' | 'storyPoints' | 'assignee' | 'reporter' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_ORDER: Record<string, number> = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };

function sortIssues(issues: Issue[], key: SortKey, dir: SortDir): Issue[] {
  return [...issues].sort((a, b) => {
    let cmp = 0;
    if (key === 'title') cmp = a.title.localeCompare(b.title);
    else if (key === 'type') cmp = a.type.localeCompare(b.type);
    else if (key === 'status') cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    else if (key === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    else if (key === 'deadline') {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      cmp = da - db;
    }
    else if (key === 'storyPoints') cmp = (a.storyPoints ?? -1) - (b.storyPoints ?? -1);
    else if (key === 'assignee') cmp = (a.assignee?.fullName ?? 'zzz').localeCompare(b.assignee?.fullName ?? 'zzz');
    else if (key === 'reporter') cmp = (a.reporter?.fullName ?? '').localeCompare(b.reporter?.fullName ?? '');
    else if (key === 'updatedAt') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function ProjectIssuesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { setBreadcrumbs, setActions } = useHeader();
  const { user } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Read initial states from sessionStorage (locked-in filters)
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'ALL'>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('issues_statusFilter') as IssueStatus) || 'ALL';
    }
    return 'ALL';
  });
  const [assigneeSearch, setAssigneeSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('issues_assigneeSearch') || '';
    }
    return '';
  });
  const [assigneeFilter, setAssigneeFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('issues_assigneeFilter') || 'ALL';
    }
    return 'ALL';
  });
  const [titleSearch, setTitleSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('issues_titleSearch') || '';
    }
    return '';
  });
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('issues_sortKey') as SortKey) || 'updatedAt';
    }
    return 'updatedAt';
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('issues_sortDir') as SortDir) || 'desc';
    }
    return 'desc';
  });

  // Keep sessionStorage in sync
  useEffect(() => {
    sessionStorage.setItem('issues_statusFilter', statusFilter);
    sessionStorage.setItem('issues_assigneeSearch', assigneeSearch);
    sessionStorage.setItem('issues_assigneeFilter', assigneeFilter);
    sessionStorage.setItem('issues_titleSearch', titleSearch);
    sessionStorage.setItem('issues_sortKey', sortKey);
    sessionStorage.setItem('issues_sortDir', sortDir);
  }, [statusFilter, assigneeSearch, assigneeFilter, titleSearch, sortKey, sortDir]);

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

  // Derive project members as IssueUser[] for the assignee dropdown
  const projectMembers: IssueUser[] = (project?.members ?? []).map((m) => m.user);

  // Collect unique assignees from issues (covers past issues too)
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    issues.forEach((i) => {
      if (i.assignee) map.set(i.assignee.id, i.assignee.fullName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [issues]);

  // Filter & sort pipeline
  const sortedIssues = useMemo(() => {
    let result = issues;

    // Status filter
    if (statusFilter !== 'ALL') result = result.filter((i) => i.status === statusFilter);

    // Assignee dropdown filter
    if (assigneeFilter !== 'ALL') {
      if (assigneeFilter === 'UNASSIGNED') result = result.filter((i) => !i.assignee);
      else result = result.filter((i) => i.assignee?.id === assigneeFilter);
    }

    // Assignee text search (searches by name)
    if (assigneeSearch.trim()) {
      const q = assigneeSearch.toLowerCase();
      result = result.filter((i) =>
        (i.assignee?.fullName ?? 'unassigned').toLowerCase().includes(q)
      );
    }

    // Title search
    if (titleSearch.trim()) {
      const q = titleSearch.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }

    return sortIssues(result, sortKey, sortDir);
  }, [issues, statusFilter, assigneeFilter, assigneeSearch, titleSearch, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setStatusFilter('ALL');
    setAssigneeFilter('ALL');
    setAssigneeSearch('');
    setTitleSearch('');
    setSortKey('updatedAt');
    setSortDir('desc');
  }

  const hasActiveFilters = statusFilter !== 'ALL' || assigneeFilter !== 'ALL' || assigneeSearch.trim() || titleSearch.trim();

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

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className={styles.sortIcon}>↕</span>;
    return <span className={styles.sortIconActive}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow} style={{ marginBottom: '12px' }}>
        <p className={styles.sub}>
          {sortedIssues.length} of {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Status filter pills */}
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

      {/* Search & assignee filter row */}
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search issues by title…"
          value={titleSearch}
          onChange={(e) => setTitleSearch(e.target.value)}
        />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by assignee name…"
          value={assigneeSearch}
          onChange={(e) => {
            setAssigneeSearch(e.target.value);
            setAssigneeFilter('ALL');
          }}
        />
        <select
          className={styles.assigneeSelect}
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setAssigneeSearch('');
          }}
        >
          <option value="ALL">All assignees</option>
          <option value="UNASSIGNED">Unassigned</option>
          {assigneeOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button className={styles.clearBtn} onClick={clearFilters}>
            ✕ Clear
          </button>
        )}
        {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
          <button
            className={styles.reportBtn}
            onClick={() => {
              const params = new URLSearchParams();
              if (statusFilter !== 'ALL') params.set('status', statusFilter);
              if (assigneeFilter !== 'ALL') params.set('assigneeId', assigneeFilter);
              if (assigneeSearch.trim()) params.set('assigneeSearch', assigneeSearch);
              if (titleSearch.trim()) params.set('title', titleSearch);
              window.open(`/projects/${projectId}/issues/report?${params.toString()}`, '_blank');
            }}
            title="Open printable report in a new tab"
          >
            🖨️ Print Report
          </button>
        )}
      </div>

      {isLoading && <TableSkeleton />}
      {isError && <div className={styles.stateError}>Failed to load issues.</div>}

      {!isLoading && !isError && sortedIssues.length === 0 && (
        <div className={styles.state}>
          <p>{hasActiveFilters ? 'No issues match your filters.' : 'No issues yet.'}</p>
          {hasActiveFilters ? (
            <button className={styles.inlineCreate} onClick={clearFilters}>
              Clear filters
            </button>
          ) : (
            <button className={styles.inlineCreate} onClick={() => setShowCreate(true)}>
              Create the first one →
            </button>
          )}
        </div>
      )}

      {!isLoading && sortedIssues.length > 0 && (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <button className={styles.thBtn} onClick={() => handleSort('title')}>
              Title <SortIcon col="title" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('type')}>
              Type <SortIcon col="type" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('status')}>
              Status <SortIcon col="status" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('priority')}>
              Priority <SortIcon col="priority" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('deadline')}>
              Deadline <SortIcon col="deadline" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('storyPoints')}>
              SP <SortIcon col="storyPoints" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('assignee')}>
              Assignee <SortIcon col="assignee" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('reporter')}>
              Reporter <SortIcon col="reporter" />
            </button>
            <button className={styles.thBtn} onClick={() => handleSort('updatedAt')}>
              Updated <SortIcon col="updatedAt" />
            </button>
          </div>
          {sortedIssues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              onClick={() => router.push(`/projects/${projectId}/issues/${issue.id}`)}
            />
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
        <span>Title</span>
        <span>Type</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Deadline</span>
        <span>SP</span>
        <span>Assignee</span>
        <span>Reporter</span>
        <span>Updated</span>
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
    <div
      className={styles.tableRow}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className={styles.issueTitle} title={issue.title}>
        {issue.title}
      </span>
      <span>
        <TypeBadge type={issue.type} />
      </span>
      <span>
        <StatusBadge status={issue.status} />
      </span>
      <span>
        <PriorityBadge priority={issue.priority} />
      </span>
      <span>
        <DeadlineBadge deadline={issue.deadline} status={issue.status} />
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
        {issue.storyPoints != null ? issue.storyPoints : '—'}
      </span>
      <span className={styles.assignee} title={issue.assignee?.fullName ?? 'Unassigned'}>
        {issue.assignee?.fullName ?? <span className={styles.unassigned}>Unassigned</span>}
      </span>
      <span className={styles.reporter} title={issue.reporter?.fullName ?? 'System'}>
        {issue.reporter?.fullName ?? '—'}
      </span>
      <span className={styles.date}>
        {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
      </span>
    </div>
  );
}
