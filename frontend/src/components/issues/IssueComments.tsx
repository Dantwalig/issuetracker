'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '@/lib/comments-api';
import { useAuth } from '@/lib/auth-context';
import { canEditComment, canDeleteComment } from '@/lib/permissions';
import { format } from 'date-fns';
import { IssueUser, CommentAttachment } from '@/types';
import styles from './IssueComments.module.css';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_FILES = 3;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

interface PendingFile {
  fileName: string;
  fileData: string; // base64
  mimeType: string;
  fileSize: number;
}

interface Props {
  issueId: string;
  projectMembers?: IssueUser[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the data URL prefix, keep only base64 payload
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Render comment body with @mention spans highlighted
function CommentBody({
  body,
  mentions,
}: {
  body: string;
  mentions: { user: IssueUser }[];
}) {
  if (!mentions.length) {
    return <p className={styles.text}>{body}</p>;
  }

  let rendered = body;
  const parts: React.ReactNode[] = [];
  let remaining = body;

  for (const m of mentions) {
    const tag = `@${m.user?.fullName}`;
    const idx = remaining.indexOf(tag);
    if (idx === -1) continue;
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <span key={m.user?.id} className={styles.mention}>
        {tag}
      </span>,
    );
    remaining = remaining.slice(idx + tag.length);
  }
  if (remaining) parts.push(remaining);

  return <p className={styles.text}>{parts.length ? parts : rendered}</p>;
}

// Attachment viewer
function AttachmentList({ attachments }: { attachments: CommentAttachment[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!attachments.length) return null;

  return (
    <>
      <div className={styles.attachments}>
        {attachments.map((att) => {
          const isImage = att.mimeType.startsWith('image/');
          const src = `data:${att.mimeType};base64,${att.fileUrl}`;

          if (isImage) {
            return (
              <div key={att.id} className={styles.attachment}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={att.fileName}
                  className={styles.attachmentImage}
                  onClick={() => setLightbox(src)}
                  title={`${att.fileName} (${formatBytes(att.fileSize)})`}
                />
              </div>
            );
          }

          // PDF
          return (
            <div key={att.id} className={styles.attachment}>
              <a
                href={src}
                download={att.fileName}
                className={styles.attachmentPdf}
                title={`Download ${att.fileName}`}
              >
                <span className={styles.attachmentPdfIcon}>📄</span>
                <span className={styles.attachmentName}>{att.fileName}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                  {formatBytes(att.fileSize)}
                </span>
              </a>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="preview" className={styles.lightboxImg} />
        </div>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function IssueComments({ issueId, projectMembers = [] }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // New comment state
  const [newBody, setNewBody] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', issueId],
    queryFn: () => commentsApi.list(issueId),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () =>
      commentsApi.create(issueId, {
        body: newBody.trim(),
        attachments: pendingFiles,
        mentionedUserIds: mentionedIds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', issueId] });
      setNewBody('');
      setPendingFiles([]);
      setMentionedIds([]);
      setFileError('');
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', issueId] }),
  });

  // ── File attachment logic ─────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError('');
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_FILES - pendingFiles.length;
    if (remaining <= 0) {
      setFileError(`Maximum ${MAX_FILES} files per comment.`);
      return;
    }

    const toAdd = files.slice(0, remaining);
    const results: PendingFile[] = [];

    for (const file of toAdd) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFileError('Only JPEG, PNG, GIF, WEBP, or PDF files are allowed.');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`"${file.name}" exceeds the 2 MB limit.`);
        continue;
      }
      const b64 = await toBase64(file);
      results.push({
        fileName: file.name,
        fileData: b64,
        mimeType: file.type,
        fileSize: file.size,
      });
    }

    setPendingFiles((prev) => [...prev, ...results]);
    // reset so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setFileError('');
  }

  // ── @mention logic ────────────────────────────────────────────────────────

  // Filter project members matching current @query (exclude self)
  const mentionSuggestions = mentionQuery
    ? projectMembers.filter(
        (m) =>
          m.id !== user?.id &&
          m.fullName.toLowerCase().includes(mentionQuery.toLowerCase()),
      )
    : [];

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setNewBody(val);

      // Detect @mention trigger: find last '@' before cursor
      const cursor = e.target.selectionStart ?? val.length;
      const beforeCursor = val.slice(0, cursor);
      const atIdx = beforeCursor.lastIndexOf('@');

      if (atIdx !== -1) {
        const query = beforeCursor.slice(atIdx + 1);
        // Only open if no space in query (still typing the name)
        if (!query.includes(' ') || query.split(' ').length <= 2) {
          setMentionQuery(query);
          setMentionOpen(true);
          return;
        }
      }
      setMentionOpen(false);
      setMentionQuery('');
    },
    [],
  );

  function insertMention(member: IssueUser) {
    const cursor = textareaRef.current?.selectionStart ?? newBody.length;
    const beforeCursor = newBody.slice(0, cursor);
    const atIdx = beforeCursor.lastIndexOf('@');
    const after = newBody.slice(cursor);

    const newText =
      beforeCursor.slice(0, atIdx) + `@${member.fullName} ` + after;
    setNewBody(newText);

    // Track mentioned IDs (deduplicated)
    setMentionedIds((prev) =>
      prev.includes(member.id) ? prev : [...prev, member.id],
    );

    setMentionOpen(false);
    setMentionQuery('');

    // Re-focus textarea after selection
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  // Close mention dropdown on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMentionOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBody.trim()) return;
    createMutation.mutate();
  }

  function handleUpdate(e: React.FormEvent, id: string) {
    e.preventDefault();
    const trimmed = editBody.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id, body: trimmed });
  }

  function startEdit(id: string, body: string) {
    setEditingId(id);
    setEditBody(body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody('');
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
            <p className={styles.empty}>
              No comments yet. Be the first to comment.
            </p>
          )}

          {comments.map((comment) => {
            const canEdit = canEditComment(user, comment);
            const canDelete = canDeleteComment(user, comment);
            const isEditing = editingId === comment.id;
            const ini = initials(comment.author.fullName);

            return (
              <div key={comment.id} className={styles.comment}>
                <div className={styles.avatar}>{ini}</div>
                <div className={styles.body}>
                  <div className={styles.meta}>
                    <span className={styles.author}>
                      {comment.author.fullName}
                    </span>
                    <span className={styles.timestamp}>
                      {format(
                        new Date(comment.createdAt),
                        'MMM d, yyyy · HH:mm',
                      )}
                      {comment.updatedAt !== comment.createdAt && (
                        <span className={styles.edited}> (edited)</span>
                      )}
                    </span>
                  </div>

                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleUpdate(e, comment.id)}
                      className={styles.editForm}
                    >
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
                          disabled={
                            !editBody.trim() || updateMutation.isPending
                          }
                        >
                          {updateMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <CommentBody
                        body={comment.body}
                        mentions={comment.mentions ?? []}
                      />
                      <AttachmentList
                        attachments={comment.attachments ?? []}
                      />
                      {(canEdit || canDelete) && (
                        <div className={styles.actions}>
                          {canEdit && (
                            <button
                              className={styles.actionBtn}
                              onClick={() =>
                                startEdit(comment.id, comment.body)
                              }
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className={`${styles.actionBtn} ${styles.deleteBtn}`}
                              onClick={() =>
                                deleteMutation.mutate(comment.id)
                              }
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

      {/* New comment form */}
      <form onSubmit={handleCreate} className={styles.addForm}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={pendingFiles.length >= MAX_FILES}
            title="Attach image or PDF (max 2 MB each, 3 files)"
          >
            📎 Attach
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
            multiple
            className={styles.fileInput}
            onChange={handleFileChange}
          />
          {fileError && (
            <span style={{ fontSize: 12, color: 'var(--red)' }}>
              {fileError}
            </span>
          )}
        </div>

        {/* Pending attachments */}
        {pendingFiles.length > 0 && (
          <div className={styles.pendingAttachments}>
            {pendingFiles.map((f, i) => (
              <div key={i} className={styles.pendingItem}>
                <span className={styles.pendingName} title={f.fileName}>
                  {f.mimeType === 'application/pdf' ? '📄' : '🖼️'}{' '}
                  {f.fileName}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                  {formatBytes(f.fileSize)}
                </span>
                <button
                  type="button"
                  className={styles.pendingRemove}
                  onClick={() => removeFile(i)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea with @mention dropdown */}
        <div className={styles.mentionWrap}>
          {mentionOpen && mentionSuggestions.length > 0 && (
            <div className={styles.mentionDropdown}>
              {mentionSuggestions.map((m) => (
                <div
                  key={m.id}
                  className={styles.mentionItem}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent textarea blur
                    insertMention(m);
                  }}
                >
                  <div className={styles.mentionAvatar}>
                    {initials(m.fullName)}
                  </div>
                  <div>
                    <div className={styles.mentionName}>{m.fullName}</div>
                    <div className={styles.mentionEmail}>{m.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="Add a comment… (type @ to mention someone)"
            value={newBody}
            onChange={handleTextareaChange}
            onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
            rows={3}
          />
        </div>

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
