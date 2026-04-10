'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/lib/comments-api';
import { useAuth } from '@/lib/auth-context';
import { canEditComment, canDeleteComment } from '@/lib/permissions';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import styles from './IssueComments.module.css';

interface Props {
  issueId: string;
}

export function IssueComments({ issueId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newBody, setNewBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', issueId],
    queryFn: () => commentsApi.list(issueId),
  });

  const createMutation = useMutation({
    mutationFn: (body: string) => commentsApi.create(issueId, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', issueId] });
      setNewBody('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      commentsApi.update(issueId, id, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', issueId] });
      setEditingId(null);
      setEditBody('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => commentsApi.delete(issueId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', issueId] });
    },
  });

  function startEdit(id: string, body: string) {
    setEditingId(id);
    setEditBody(body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody('');
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newBody.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  }

  function handleUpdate(e: React.FormEvent, id: string) {
    e.preventDefault();
    const trimmed = editBody.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id, body: trimmed });
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        Comments
        {comments.length > 0 && (
          <span className={styles.count}>{comments.length}</span>
        )}
      </h2>

      {isLoading ? (
        <div className={styles.loading}>
          <span className={styles.spinner} />
        </div>
      ) : (
        <div className={styles.list}>
          {comments.length === 0 && (
            <p className={styles.empty}>No comments yet. Be the first to comment.</p>
          )}
          {comments.map((comment) => {
            const canEdit = canEditComment(user, comment);
            const canDelete = canDeleteComment(user, comment);
            const isEditing = editingId === comment.id;
            const initials = comment.author.fullName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div key={comment.id} className={styles.comment}>
                <div className={styles.avatar}>{initials}</div>
                <div className={styles.body}>
                  <div className={styles.meta}>
                    <span className={styles.author}>{comment.author.fullName}</span>
                    <span className={styles.timestamp}>
                      {format(new Date(comment.createdAt), 'MMM d, yyyy · HH:mm')}
                      {comment.updatedAt !== comment.createdAt && (
                        <span className={styles.edited}> (edited)</span>
                      )}
                    </span>
                  </div>

                  {isEditing ? (
                    <form onSubmit={(e) => handleUpdate(e, comment.id)} className={styles.editForm}>
                      <textarea
                        className={styles.textarea}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className={styles.editActions}>
                        <button
                          type="submit"
                          className={styles.saveBtn}
                          disabled={!editBody.trim() || updateMutation.isPending}
                        >
                          {updateMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className={styles.text}>
                        <ReactMarkdown>{comment.body}</ReactMarkdown>
                      </div>
                      {(canEdit || canDelete) && (
                        <div className={styles.actions}>
                          {canEdit && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => startEdit(comment.id, comment.body)}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className={`${styles.actionBtn} ${styles.deleteBtn}`}
                              onClick={() => deleteMutation.mutate(comment.id)}
                              disabled={deleteMutation.isPending}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleCreate} className={styles.addForm}>
        <textarea
          className={styles.textarea}
          placeholder="Add a comment…"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={3}
        />
        <div className={styles.addActions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!newBody.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>
    </section>
  );
}
