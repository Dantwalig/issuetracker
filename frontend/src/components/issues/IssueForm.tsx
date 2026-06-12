'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { IssueUser, Issue, IssueType, IssueStatus, IssuePriority } from '@/types';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import styles from './IssueForm.module.css';

export interface FormChecklist {
  id: string;
  title: string;
  items: string[];
}

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
  onSubmit: (data: IssueFormData, checklists?: FormChecklist[]) => Promise<void>;
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
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<IssueFormData>({
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

  const [showPreview, setShowPreview] = useState(false);
  const description = watch('description');

  // Checklists local state
  const isEditMode = !!defaultValues;
  const [checklists, setChecklists] = useState<FormChecklist[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newItemTextMap, setNewItemTextMap] = useState<Record<string, string>>({});

  function addChecklist() {
    const title = newChecklistTitle.trim();
    if (!title) return;
    const newId = Math.random().toString(36).substring(2, 9);
    setChecklists([...checklists, { id: newId, title, items: [] }]);
    setNewChecklistTitle('');
  }

  function removeChecklist(id: string) {
    setChecklists(checklists.filter((c) => c.id !== id));
  }

  function addChecklistItem(listId: string) {
    const text = newItemTextMap[listId]?.trim();
    if (!text) return;
    setChecklists(
      checklists.map((c) => {
        if (c.id === listId) {
          return { ...c, items: [...c.items, text] };
        }
        return c;
      })
    );
    setNewItemTextMap({ ...newItemTextMap, [listId]: '' });
  }

  function removeChecklistItem(listId: string, itemIdx: number) {
    setChecklists(
      checklists.map((c) => {
        if (c.id === listId) {
          const nextItems = [...c.items];
          nextItems.splice(itemIdx, 1);
          return { ...c, items: nextItems };
        }
        return c;
      })
    );
  }

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
    <form className={styles.form} onSubmit={handleSubmit(d => onSubmit(sanitize(d), checklists))}>
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
        <div className={styles.labelRow}>
          <label className={styles.label}>Description</label>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${!showPreview ? styles.activeTab : ''}`}
              onClick={() => setShowPreview(false)}
            >
              Write
            </button>
            <button
              type="button"
              className={`${styles.tab} ${showPreview ? styles.activeTab : ''}`}
              onClick={() => setShowPreview(true)}
            >
              Preview
            </button>
          </div>
        </div>
        {showPreview ? (
          <div className={styles.preview}>
            {description?.trim() ? (
              <MarkdownRenderer content={description} />
            ) : (
              <p className={styles.previewEmpty}>Nothing to preview</p>
            )}
          </div>
        ) : (
          <textarea className={styles.textarea} placeholder="Optional context…" rows={3} {...register('description')} />
        )}
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

      {!isEditMode && (
        <div className={styles.checklistsSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Checklists</span>
          </div>
          <div className={styles.addChecklistRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="Checklist title (e.g. Definition of Done)…"
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addChecklist();
                }
              }}
            />
            <button
              type="button"
              className={styles.addChecklistBtn}
              onClick={addChecklist}
            >
              Add Checklist
            </button>
          </div>

          <div className={styles.checklistContainer}>
            {checklists.map((list) => (
              <div key={list.id} className={styles.checklistCard}>
                <div className={styles.checklistHeader}>
                  <span className={styles.checklistTitle}>{list.title}</span>
                  <button
                    type="button"
                    className={styles.deleteChecklistBtn}
                    onClick={() => removeChecklist(list.id)}
                  >
                    Remove
                  </button>
                </div>

                <div className={styles.itemsList}>
                  {list.items.map((item, idx) => (
                    <div key={idx} className={styles.itemRow}>
                      <span>{item}</span>
                      <button
                        type="button"
                        className={styles.deleteItemBtn}
                        onClick={() => removeChecklistItem(list.id, idx)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className={styles.addItemRow}>
                  <input
                    type="text"
                    className={styles.miniInput}
                    placeholder="Add item…"
                    value={newItemTextMap[list.id] ?? ''}
                    onChange={(e) =>
                      setNewItemTextMap({ ...newItemTextMap, [list.id]: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addChecklistItem(list.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => addChecklistItem(list.id)}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}

