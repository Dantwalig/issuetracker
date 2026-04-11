'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deletionRequestsApi } from '@/lib/deletion-requests-api';
import { BackButton } from '@/components/ui/BackButton';
import { DeletionRequest } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';

function RespondModal({
  req,
  onClose,
}: {
  req: DeletionRequest;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [responseReason, setResponseReason] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: ({ approved }: { approved: boolean }) =>
      deletionRequestsApi.respond(req.id, approved, responseReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletion-requests'] });
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Failed'),
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Review Deletion Request</h3>
        <div className={styles.modalIssue}>
          <p className={styles.issueName}>{req.issue.title}</p>
          <p className={styles.requester}>Requested by <strong>{req.requestedBy.fullName}</strong> · {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</p>
        </div>
        <div className={styles.modalReason}>
          <p className={styles.reasonLabel}>Their reason</p>
          <p className={styles.reasonText}>{req.reason}</p>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Your response (required)</label>
          <textarea
            className={styles.textarea}
            value={responseReason}
            onChange={e => { setResponseReason(e.target.value); setError(''); }}
            placeholder="Explain your decision..."
            rows={3}
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button
            className={styles.rejectBtn}
            onClick={() => mutation.mutate({ approved: false })}
            disabled={mutation.isPending || !responseReason.trim()}
          >
            {mutation.isPending ? '…' : 'Reject'}
          </button>
          <button
            className={styles.approveBtn}
            onClick={() => mutation.mutate({ approved: true })}
            disabled={mutation.isPending || !responseReason.trim()}
          >
            {mutation.isPending ? '…' : 'Approve & Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DeletionRequestsPage() {
  const [selected, setSelected] = useState<DeletionRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery<DeletionRequest[]>({
    queryKey: ['deletion-requests'],
    queryFn: deletionRequestsApi.listPending,
  });

  return (
    <div className={styles.page}>
      <BackButton href="/admin/users" label="Admin" />
      <h1 className={styles.title}>Deletion Requests</h1>
      <p className={styles.sub}>{requests.length} pending request{requests.length !== 1 ? 's' : ''}</p>

      {isLoading && <div className={styles.state}><span className={styles.spinner} /></div>}
      {!isLoading && requests.length === 0 && (
        <div className={styles.empty}>No pending deletion requests.</div>
      )}

      <div className={styles.list}>
        {requests.map(req => (
          <div key={req.id} className={styles.card}>
            <div className={styles.cardInfo}>
              <p className={styles.issueName}>🎯 {req.issue.title}</p>
              <p className={styles.meta}>
                Requested by <strong>{req.requestedBy.fullName}</strong>
                {' '}· {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
              </p>
              <p className={styles.reason}>{req.reason}</p>
            </div>
            <button className={styles.reviewBtn} onClick={() => setSelected(req)}>
              Review →
            </button>
          </div>
        ))}
      </div>

      {selected && <RespondModal req={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
