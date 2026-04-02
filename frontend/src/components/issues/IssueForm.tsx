'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { IssueUser, Issue, IssueType, IssueStatus, IssuePriority } from '@/types';
import styles from './IssueForm.module.css';

type IssueFormData = {
  title: string;
  description?: string;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string;
};

interface Props {
  defaultValues?: Partial<Issue>;
  /** Project members to populate the assignee dropdown — scoped to this project only */
  projectMembers?: IssueUser[];
  onSubmit: (data: IssueFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel?: string;
  /** When true, only the Status field is rendered (for assignee-only updates) */
  statusOnly?: boolean;
}

export function IssueForm({
  defaultValues,
  projectMembers = [],
  onSubmit,
  onCancel,
  loading,
  submitLabel = 'Create issue',
  statusOnly = false,
}: Props) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<IssueFormData>({
    defaultValues: {
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      type: defaultValues?.type ?? 'TASK',
      status: defaultValues?.status ?? 'TODO',
      priority: defaultValues?.priority ?? 'MEDIUM',
      assigneeId: defaultValues?.assigneeId ?? '',
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        title: defaultValues.title ?? '',
        description: defaultValues.description ?? '',
        type: defaultValues.type ?? 'TASK',
        status: defaultValues.status ?? 'TODO',
        priority: defaultValues.priority ?? 'MEDIUM',
        assigneeId: defaultValues.assigneeId ?? '',
      });
    }
  }, [defaultValues, reset]);

  // Sanitize form data before passing upstream: convert empty assigneeId string
  // to undefined so the API receives a proper null/absent field rather than "".
  function sanitize(data: IssueFormData): IssueFormData {
    return {
      ...data,
      assigneeId: data.assigneeId?.trim() || undefined,
    };
  }

  // Status-only mode: rendered for assignees who may only change status
  if (statusOnly) {
    return (
      <form className={styles.form} onSubmit={handleSubmit((d) => onSubmit(sanitize(d)))}>
        <div className={styles.field}>
          <label className={styles.label}>Status</label>
          <select className={styles.select} {...register('status')}>
            {(['TODO', 'IN_PROGRESS', 'DONE'] as IssueStatus[]).map((s) => (
              <option key={s} value={s}>
                {s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit((d) => onSubmit(sanitize(d)))}>
      <div className={styles.field}>
        <label className={styles.label}>
          Title <span className={styles.req}>*</span>
        </label>
        <input
          className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
          placeholder="Short, descriptive title…"
          {...register('title', {
            required: 'Title is required',
            minLength: { value: 3, message: 'Min 3 characters' },
          })}
        />
        {errors.title && <span className={styles.errorMsg}>{errors.title.message}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Description</label>
        <textarea
          className={styles.textarea}
          placeholder="Optional — provide context, steps to reproduce, acceptance criteria…"
          rows={4}
          {...register('description')}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          <select className={styles.select} {...register('type')}>
            {(['TASK', 'BUG', 'STORY'] as IssueType[]).map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Priority</label>
          <select className={styles.select} {...register('priority')}>
            {(['LOW', 'MEDIUM', 'HIGH'] as IssuePriority[]).map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Status</label>
          <select className={styles.select} {...register('status')}>
            {(['TODO', 'IN_PROGRESS', 'DONE'] as IssueStatus[]).map((s) => (
              <option key={s} value={s}>
                {s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Assignee</label>
        <select className={styles.select} {...register('assigneeId')}>
          <option value="">— unassigned —</option>
          {projectMembers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName} ({u.email})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
