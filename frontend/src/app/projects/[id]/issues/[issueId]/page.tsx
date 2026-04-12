'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { issuesApi } from '@/lib/issues-api';
import { projectsApi } from '@/lib/projects-api';
import { useAuth } from '@/lib/auth-context';
import { canEditIssue, canDeleteIssue, canUpdateIssueStatus, isAdmin } from '@/lib/permissions';
import { StatusBadge, PriorityBadge, TypeBadge, DeadlineBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { IssueForm } from '@/components/issues/IssueForm';
import { IssueComments } from '@/components/issues/IssueComments';
import { IssueChecklists } from '@/components/issues/IssueChecklists';
import { IssueLabels } from '@/components/issues/IssueLabels';
import { ShareModal } from '@/components/issues/ShareModal';
import { DeleteModal } from '@/components/ui/DeleteModal';
import { BackButton } from '@/components/ui/BackButton';
import { recycleBinApi } from '@/lib/recycle-bin-api';
import { deletionRequestsApi } from '@/lib/deletion-requests-api';
import { IssueUser } from '@/types';
import { format } from 'date-fns';
import { useShortcut } from '@/lib/keyboard-shortcuts';
import styles from './page.module.css';

export default function IssueDetailPage() {
  const { id: projectId, issueId } = useParams<{ id: string; issueId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [showEdit, setShowEdit] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRequestDelete, setShowRequestDelete] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);

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

  async function handleUpdate(data: any) {
    setUpdating(true);
    try { await updateMutation.mutateAsync(data); } finally { setUpdating(false); }
  }

  async function handleRequestDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!requestReason.trim()) { setRequestError('Please provide a reason'); return; }
    setRequestLoading(true);
    try {
      await deletionRequestsApi.request(issueId, requestReason.trim());
      setRequestSuccess('Deletion request submitted. An admin will review it.');
      setRequestError('');
      setRequestReason('');
    } catch (err: any) {
      setRequestError(err?.response?.data?.message ?? 'Failed to submit request');
    } finally {
      setRequestLoading(false);
    }
  }

  if (isLoading) return <div className={styles.center}><span className={styles.spinner} /></div>;
  if (isError || !issue) return (
    <div className={styles.center}>
      <p>Issue not found.</p>
      <button className={styles.backLink} onClick={() => router.push(`/projects/${projectId}/issues`)}>← Back</button>
    </div>
  );

  const userIsAdmin = isAdmin(user);
  const showEditBtn = canEditIssue(user, issue);
  const showStatusOnly = !showEditBtn && canUpdateIssueStatus(user, issue);
  const showAdminDelete = userIsAdmin && canDeleteIssue(user, issue);
  // Members can request deletion of issues they reported
  const showRequestDeleteBtn = !userIsAdmin && issue.reporterId === user?.id;

  const projectMembers: IssueUser[] = (project?.members ?? []).map((m) => m.user);

  // Keyboard shortcuts for issue detail
  useShortcut('issue-detail:edit', {
    key: 'e',
    description: 'Edit issue',
    group: 'Issue Detail',
    action: () => { if (showEditBtn) setShowEdit(true); },
    disabled: !showEditBtn,
  });
  useShortcut('issue-detail:share', {
    key: 's',
    description: 'Share issue',
    group: 'Issue Detail',
    action: () => setShowShare(true),
  });
  useShortcut('issue-detail:back', {
    key: 'Backspace',
    description: 'Back to issues list',
    group: 'Issue Detail',
    action: () => router.push(`/projects/${projectId}/issues`),
  });
  useShortcut('issue-detail:escape', {
    key: 'Escape',
    description: 'Close dialog / cancel',
    group: 'Global',
    action: () => {
      if (showEdit) { setShowEdit(false); return; }
      if (showShare) { setShowShare(false); return; }
      if (showDeleteModal) { setShowDeleteModal(false); return; }
    },
    disabled: !showEdit && !showShare && !showDeleteModal,
  });

  return (
    <div className={styles.page}>
      <BackButton href={`/projects/${projectId}/issues`} label="Back to issues" />

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
          <button className={styles.editBtn} onClick={() => setShowShare(true)}>Share</button>
          {showEditBtn && <button className={styles.editBtn} onClick={() => setShowEdit(true)}>Edit</button>}
          {showStatusOnly && <button className={styles.editBtn} onClick={() => setShowEdit(true)}>Update status</button>}
          {showAdminDelete && (
            <button className={styles.deleteBtn} onClick={() => setShowDeleteModal(true)}>Delete</button>
          )}
          {showRequestDeleteBtn && (
            <button className={styles.deleteBtn} onClick={() => setShowRequestDelete(true)}>
              Request deletion
            </button>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.badgeRow}>
          <TypeBadge type={issue.type} />
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          <DeadlineBadge deadline={issue.deadline} status={issue.status} />
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
          {issue.storyPoints != null && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Story points</span>
              <span className={styles.metaValue}>{issue.storyPoints}</span>
            </div>
          )}
          {issue.deadline && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Deadline</span>
              <span className={styles.metaValue}>{format(new Date(issue.deadline), 'MMM d, yyyy')}</span>
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

        <IssueLabels issueId={issueId} projectId={projectId} />
        <IssueChecklists issueId={issueId} />
        <IssueComments issueId={issueId} projectMembers={projectMembers} />
      </div>

      {/* Admin soft-delete with reason */}
      {showDeleteModal && (
        <DeleteModal
          itemName={issue.title}
          itemType="issue"
          onConfirm={async (reason) => {
            await recycleBinApi.deleteIssue(issueId, reason);
            router.push(`/projects/${projectId}/issues`);
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {/* Member deletion request */}
      {showRequestDelete && (
        <Modal title="Request issue deletion" onClose={() => { setShowRequestDelete(false); setRequestSuccess(''); setRequestError(''); setRequestReason(''); }}>
          <div style={{ padding: '4px 0' }}>
            {requestSuccess ? (
              <div>
                <p style={{ color: 'var(--success, #22c55e)', marginBottom: 16, display:'flex', alignItems:'center' }}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden style={{verticalAlign:'middle',marginRight:4}}><path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>{requestSuccess}</p>
                <button
                  onClick={() => { setShowRequestDelete(false); setRequestSuccess(''); }}
                  style={{ height: 36, padding: '0 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 14 }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestDelete}>
                <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
                  An admin will review your request and notify you of their decision.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
                    Reason for deletion <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-1)', fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                    rows={3}
                    value={requestReason}
                    onChange={e => { setRequestReason(e.target.value); setRequestError(''); }}
                    placeholder="Why should this issue be deleted?"
                    required
                  />
                </div>
                {requestError && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{requestError}</p>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowRequestDelete(false)}
                    style={{ height: 36, padding: '0 14px', background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={requestLoading || !requestReason.trim()}
                    style={{ height: 36, padding: '0 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: requestLoading ? 0.6 : 1 }}>
                    {requestLoading ? 'Submitting…' : 'Submit request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* Share modal */}
      {showShare && (
        <ShareModal
          issue={issue}
          onClose={() => setShowShare(false)}
          onTokenChange={(token) => {
            qc.invalidateQueries({ queryKey: ['issue', projectId, issueId] });
          }}
        />
      )}

      {/* Edit modal */}
      {showEdit && (
        <Modal title={showStatusOnly ? 'Update issue status' : 'Edit issue'} onClose={() => setShowEdit(false)}>
          <IssueForm
            defaultValues={issue}
            projectMembers={projectMembers}
            onSubmit={handleUpdate}
            onCancel={() => setShowEdit(false)}
            loading={updating}
            submitLabel="Save changes"
            statusOnly={showStatusOnly}
          />
        </Modal>
      )}
    </div>
  );
}
