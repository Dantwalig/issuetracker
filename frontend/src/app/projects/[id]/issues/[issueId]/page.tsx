'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { useAuth } from '@/lib/auth-context';
import { canEditIssue, canDeleteIssue, canUpdateIssueStatus } from '@/lib/permissions';
import { StatusBadge, PriorityBadge, TypeBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { IssueForm } from '@/components/issues/IssueForm';
import { IssueComments } from '@/components/issues/IssueComments';
import { format } from 'date-fns';
import styles from './page.module.css';

export default function IssueDetailPage() {
  const { id: projectId, issueId } = useParams<{ id: string; issueId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [showEdit, setShowEdit] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: issue, isLoading, isError } = useQuery({
    queryKey: ['issue', projectId, issueId],
    queryFn: () => issuesApi.get(projectId, issueId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => issuesApi.update(projectId, issueId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', projectId, issueId] });
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      setShowEdit(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => issuesApi.delete(projectId, issueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      router.push(`/projects/${projectId}/issues`);
    },
  });

  async function handleUpdate(data: any) {
    setUpdating(true);
    try { await updateMutation.mutateAsync(data); } finally { setUpdating(false); }
  }

  if (isLoading) return <div className={styles.center}><span className={styles.spinner} /></div>;
  if (isError || !issue) return (
    <div className={styles.center}>
      <p>Issue not found.</p>
      <button className={styles.backLink} onClick={() => router.push(`/projects/${projectId}/issues`)}>← Back</button>
    </div>
  );

  const showEditBtn = canEditIssue(user, issue);
  const showDeleteBtn = canDeleteIssue(user, issue);
  // Assignee-only: show a quick status update button (not full edit form)
  const showStatusOnly = !showEditBtn && canUpdateIssueStatus(user, issue);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <nav className={styles.breadcrumb}>
          <button className={styles.breadLink} onClick={() => router.push('/projects')}>Projects</button>
          <span className={styles.sep}>/</span>
          <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}`)}>{project?.name ?? '…'}</button>
          <span className={styles.sep}>/</span>
          <button className={styles.breadLink} onClick={() => router.push(`/projects/${projectId}/issues`)}>Issues</button>
          <span className={styles.sep}>/</span>
          <span className={styles.breadCurrent}>{issue.id.slice(0, 8)}</span>
        </nav>
        <div className={styles.topActions}>
          {showEditBtn && (
            <button className={styles.editBtn} onClick={() => setShowEdit(true)}>Edit</button>
          )}
          {showStatusOnly && (
            <button className={styles.editBtn} onClick={() => setShowEdit(true)}>Update status</button>
          )}
          {showDeleteBtn && (
            <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.badgeRow}>
          <TypeBadge type={issue.type} />
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
        </div>
        <h1 className={styles.title}>{issue.title}</h1>
        {issue.description
          ? <p className={styles.description}>{issue.description}</p>
          : <p className={styles.noDesc}>No description provided.</p>}
        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Project</span>
            <span className={styles.metaValue}>{issue.project.name}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Reporter</span>
            <span className={styles.metaValue}>{issue.reporter.fullName}</span>
          </div>
          {issue.assignee && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Assignee</span>
              <span className={styles.metaValue}>{issue.assignee.fullName}</span>
            </div>
          )}
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Created</span>
            <span className={styles.metaValue}>{format(new Date(issue.createdAt), 'MMM d, yyyy')}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Updated</span>
            <span className={styles.metaValue}>{format(new Date(issue.updatedAt), 'MMM d, yyyy · HH:mm')}</span>
          </div>
        </div>

        <IssueComments issueId={issueId} />
      </div>

      {showEdit && (
        <Modal title={showStatusOnly ? 'Update issue status' : 'Edit issue'} onClose={() => setShowEdit(false)}>
          <IssueForm
            defaultValues={issue}
            onSubmit={handleUpdate}
            onCancel={() => setShowEdit(false)}
            loading={updating}
            submitLabel="Save changes"
            statusOnly={showStatusOnly}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete issue" onClose={() => setConfirmDelete(false)} width={420}>
          <div className={styles.confirmBody}>
            <p>Delete <strong>&quot;{issue.title}&quot;</strong>? This cannot be undone.</p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelConfirm} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className={styles.confirmDelete} onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete issue'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
