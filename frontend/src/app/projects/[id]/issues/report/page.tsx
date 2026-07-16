'use client';

import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { checklistsApi } from '@/lib/checklists-api';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { StatusBadge, PriorityBadge, TypeBadge, DeadlineBadge } from '@/components/ui/Badge';
import { Issue, IssueStatus } from '@/types';
import { format } from 'date-fns';
import styles from './page.module.css';

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

export default function IssuesReportPage() {
  return (
    <Suspense fallback={<div className={styles.center}><span className={styles.spinner} /><span>Loading report layout…</span></div>}>
      <IssuesReportContent />
    </Suspense>
  );
}

function IssuesReportContent() {
  const { id: projectId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const statusFilter = searchParams.get('status') || 'ALL';
  const assigneeFilter = searchParams.get('assigneeId') || 'ALL';
  const assigneeSearch = searchParams.get('assigneeSearch') || '';
  const titleSearch = searchParams.get('title') || '';
  const sortKey = (searchParams.get('sortKey') || 'updatedAt') as SortKey;
  const sortDir = (searchParams.get('sortDir') || 'desc') as SortDir;

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: issues = [], isLoading, isError } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issuesApi.listByProject(projectId),
  });

  const filteredIssues = useMemo(() => {
    let result = issues;

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((i) => i.status === statusFilter);
    }

    // Assignee dropdown filter
    if (assigneeFilter !== 'ALL') {
      if (assigneeFilter === 'UNASSIGNED') {
        result = result.filter((i) => !i.assignee);
      } else {
        result = result.filter((i) => i.assignee?.id === assigneeFilter);
      }
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

  if (isLoading) {
    return (
      <div className={styles.center}>
        <span className={styles.spinner} />
        <span>Loading project report data…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.center}>
        <span>Failed to load project issues for report.</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.reportHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.heading}>Project Tasks Report</h1>
          <button className={styles.printBtn} onClick={() => window.print()}>
            🖨️ Print / Save as PDF
          </button>
        </div>
        <div className={styles.metaInfo}>
          <div><strong>Project Name:</strong> {project?.name ?? '…'}</div>
          <div><strong>Generated:</strong> {format(new Date(), 'MMMM d, yyyy · HH:mm')}</div>
          <div><strong>Total Issues Shown:</strong> {filteredIssues.length} of {issues.length}</div>
          {statusFilter !== 'ALL' && <div><strong>Status Filter:</strong> {statusFilter}</div>}
          {assigneeFilter !== 'ALL' && <div><strong>Assignee Filter ID:</strong> {assigneeFilter}</div>}
          {assigneeSearch && <div><strong>Assignee Search Query:</strong> "{assigneeSearch}"</div>}
          {titleSearch && <div><strong>Title Search Query:</strong> "{titleSearch}"</div>}
        </div>
      </header>

      <div className={styles.issuesList}>
        {filteredIssues.map((issue) => (
          <article key={issue.id} className={styles.issueCard}>
            <div className={styles.issueHeader}>
              <h2 className={styles.issueTitle}>{issue.title}</h2>
              <div className={styles.badgeRow}>
                <TypeBadge type={issue.type} />
                <StatusBadge status={issue.status} />
                <PriorityBadge priority={issue.priority} />
                <DeadlineBadge deadline={issue.deadline} status={issue.status} />
              </div>
            </div>

            <div className={styles.peopleGrid}>
              <div className={styles.peopleItem}>
                <strong>Assignee:</strong> {issue.assignee?.fullName ?? 'Unassigned'}
              </div>
              <div className={styles.peopleItem}>
                <strong>Reporter:</strong> {issue.reporter?.fullName ?? 'System'}
              </div>
              {issue.storyPoints != null && (
                <div className={styles.peopleItem}>
                  <strong>Story Points:</strong> {issue.storyPoints} SP
                </div>
              )}
              {issue.deadline && (
                <div className={styles.peopleItem}>
                  <strong>Deadline:</strong> {format(new Date(issue.deadline), 'MMM d, yyyy')}
                </div>
              )}
            </div>

            <div className={styles.descriptionSection}>
              <h3 className={styles.sectionTitle}>Task Description</h3>
              {issue.description ? (
                <MarkdownRenderer content={issue.description} className={styles.descriptionContent} />
              ) : (
                <p className={styles.noDesc}>No description provided for this task.</p>
              )}
            </div>

            <IssueChecklistPrint issueId={issue.id} />
          </article>
        ))}

        {filteredIssues.length === 0 && (
          <div className={styles.center}>
            <span>No issues found matching the active filter criteria.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function IssueChecklistPrint({ issueId }: { issueId: string }) {
  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ['checklists', issueId],
    queryFn: () => checklistsApi.list(issueId),
  });

  if (isLoading || checklists.length === 0) return null;

  return (
    <div className={styles.checklistSection}>
      <h3 className={styles.sectionTitle}>Checklists</h3>
      {checklists.map((list) => (
        <div key={list.id} className={styles.checklist}>
          <div className={styles.checklistTitle}>{list.title}</div>
          <ul className={styles.itemsList}>
            {list.items.map((item) => (
              <li key={item.id} className={styles.checkItem}>
                <span className={item.isChecked ? styles.checkedBox : styles.uncheckedBox}>
                  {item.isChecked ? '☑' : '☐'}
                </span>
                <span className={item.isChecked ? styles.checkedText : ''}>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
