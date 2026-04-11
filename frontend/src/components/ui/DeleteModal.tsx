'use client';
import { useState } from 'react';
import { Modal } from './Modal';
import styles from './DeleteModal.module.css';

interface Props {
  itemName: string;
  itemType: string;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export function DeleteModal({ itemName, itemType, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Please provide a reason for deletion'); return; }
    setLoading(true);
    try {
      await onConfirm(reason.trim());
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to delete');
      setLoading(false);
    }
  }

  return (
    <Modal title={`Delete ${itemType}`} onClose={onCancel}>
      <div className={styles.body}>
        <p className={styles.warning}>
          You are about to delete <strong>"{itemName}"</strong>. 
          This will move it to the recycle bin for 30 days before permanent deletion.
        </p>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>
              Reason for deletion <span className={styles.req}>*</span>
            </label>
            <textarea
              className={styles.textarea}
              placeholder="Explain why this is being deleted..."
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              rows={3}
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className={styles.deleteBtn} disabled={loading || !reason.trim()}>
              {loading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
