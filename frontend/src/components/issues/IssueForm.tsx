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
  storyPoints?: number;
  deadline?: string | null;
  assigneeId?: string;
};

interface Props {
  defaultValues?: Partial<Issue>;
  projectMembers?: IssueUser[];
  onSubmit: (data: IssueFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel?: string;
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
      storyPoints: defaultValues?.storyPoints ?? undefined,
      deadline: defaultValues?.deadline ? defaultValues.deadline.slice(0, 10) : '',
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
        storyPoints: defaultValues.storyPoints ?? undefined,
        deadline: defaultValues.deadline ? defaultValues.deadline.slice(0, 10) : '',
        assigneeId: defaultValues.assigneeId ?? '',
      });
    }
  }, [defaultValues, reset]);

  function sanitize(data: IssueFormData): IssueFormData {
    return {
      ...data,
      assigneeId: data.assigneeId?.trim() || undefined,
      storyPoints: data.storyPoints ? Number(data.storyPoints) : undefined,
      deadline: data.deadline || null,
    };
  }

  if (statusOnly) {
    return (
      <form className={styles.form} onSubmit={handleSubmit(d => onSubmit(sanitize(d)))}>
        <div className={styles.field}>
          <label className={styles.label}>Status</label>
          <select className={styles.select} {...register('status')}>
            {(['TODO', 'IN_PROGRESS', 'DONE'] as IssueStatus[]).map(s => (
              <option key={s} value={s}>
                {s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(d => onSubmit(sanitize(d)))}>
      <div className={styles.field}>
        <label className={styles.label}>Title <span className={styles.req}>*</span></label>
        <input
          className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
          placeholder="Short, descriptive title…"
          {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'Min 3 characters' } })}
        />
        {errors.title && <span className={styles.errorMsg}>{errors.title.message}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Description</label>
        <textarea className={styles.textarea} placeholder="Optional context…" rows={3} {...register('description')} />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Type</label>
          <select className={styles.select} {...register('type')}>
            {(['TASK', 'BUG', 'STORY'] as IssueType[]).map(t => (
              <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Priority</label>
          <select className={styles.select} {...register('priority')}>
            {(['LOW', 'MEDIUM', 'HIGH'] as IssuePriority[]).map(p => (
              <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Status</label>
          <select className={styles.select} {...register('status')}>
            {(['TODO', 'IN_PROGRESS', 'DONE'] as IssueStatus[]).map(s => (
              <option key={s} value={s}>
                {s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Story points</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            placeholder="e.g. 3"
            {...register('storyPoints', { min: 1 })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Deadline</label>
          <input className={styles.input} type="date" {...register('deadline')} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Assignee</label>
        <select className={styles.select} {...register('assigneeId')}>
          <option value="">— unassigned —</option>
          {projectMembers.map(u => (
            <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
