'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checklistsApi, Checklist, ChecklistItem } from '@/lib/checklists-api';
import styles from './IssueChecklists.module.css';

interface Props {
  issueId: string;
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function Progress({ items }: { items: ChecklistItem[] }) {
  if (!items.length) return null;
  const done = items.filter((i) => i.isChecked).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <div className={styles.progress}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.progressText}>
        {done}/{items.length}
      </span>
    </div>
  );
}

// ── Single checklist ──────────────────────────────────────────────────────────
function ChecklistCard({
  checklist,
  issueId,
}: {
  checklist: Checklist;
  issueId: string;
}) {
  const qc = useQueryClient();
  const qk = ['checklists', issueId];

  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(checklist.title);

  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemText, setEditItemText] = useState('');

  const addItemInputRef = useRef<HTMLInputElement>(null);

  // ── Mutations ──────────────────────────────────────────────────────────
  const updateChecklist = useMutation({
    mutationFn: (title: string) =>
      checklistsApi.update(issueId, checklist.id, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const deleteChecklist = useMutation({
    mutationFn: () => checklistsApi.delete(issueId, checklist.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const addItem = useMutation({
    mutationFn: (text: string) => checklistsApi.addItem(checklist.id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setNewItemText('');
      // Keep the add-item form open for rapid entry
      setTimeout(() => addItemInputRef.current?.focus(), 50);
    },
  });

  const toggleItem = useMutation({
    mutationFn: ({ id, isChecked }: { id: string; isChecked: boolean }) =>
      checklistsApi.updateItem(checklist.id, id, { isChecked }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      checklistsApi.updateItem(checklist.id, id, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setEditItemId(null);
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => checklistsApi.deleteItem(checklist.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  function commitTitleEdit() {
    const t = titleVal.trim();
    if (t && t !== checklist.title) {
      updateChecklist.mutate(t);
    } else {
      setTitleVal(checklist.title);
    }
    setEditTitle(false);
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const t = newItemText.trim();
    if (!t) return;
    addItem.mutate(t);
  }

  function startEditItem(item: ChecklistItem) {
    setEditItemId(item.id);
    setEditItemText(item.text);
  }

  function commitItemEdit(item: ChecklistItem) {
    const t = editItemText.trim();
    if (t && t !== item.text) {
      updateItem.mutate({ id: item.id, text: t });
    } else {
      setEditItemId(null);
    }
  }

  return (
    <div className={styles.checklist}>
      {/* Header */}
      <div className={styles.checklistHeader}>
        {editTitle ? (
          <input
            className={styles.checklistTitleInput}
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={commitTitleEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitleEdit();
              if (e.key === 'Escape') {
                setTitleVal(checklist.title);
                setEditTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <span className={styles.checklistTitle}>
            ☑ {checklist.title}
            <Progress items={checklist.items} />
          </span>
        )}

        {!editTitle && (
          <button
            className={styles.iconBtn}
            title="Rename checklist"
            onClick={() => setEditTitle(true)}
          >
            ✏️
          </button>
        )}
        <button
          className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
          title="Delete checklist"
          onClick={() => deleteChecklist.mutate()}
          disabled={deleteChecklist.isPending}
        >
          🗑
        </button>
      </div>

      {/* Items */}
      <div className={styles.items}>
        {checklist.items.length === 0 && (
          <p className={styles.emptyItems}>No items yet.</p>
        )}

        {checklist.items.map((item) => (
          <div key={item.id} className={styles.item}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={item.isChecked}
              onChange={(e) =>
                toggleItem.mutate({ id: item.id, isChecked: e.target.checked })
              }
            />

            {editItemId === item.id ? (
              <input
                className={styles.itemTextInput}
                value={editItemText}
                onChange={(e) => setEditItemText(e.target.value)}
                onBlur={() => commitItemEdit(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitItemEdit(item);
                  if (e.key === 'Escape') setEditItemId(null);
                }}
                autoFocus
              />
            ) : (
              <span
                className={`${styles.itemText} ${item.isChecked ? styles.itemTextDone : ''}`}
                onDoubleClick={() => startEditItem(item)}
                title="Double-click to edit"
              >
                {item.text}
              </span>
            )}

            <div className={styles.itemActions}>
              <button
                className={styles.iconBtn}
                title="Edit"
                onClick={() => startEditItem(item)}
              >
                ✏️
              </button>
              <button
                className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                title="Delete item"
                onClick={() => deleteItem.mutate(item.id)}
                disabled={deleteItem.isPending}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add item */}
      <div className={styles.addItemRow}>
        {addingItem ? (
          <form className={styles.addItemForm} onSubmit={handleAddItem}>
            <input
              ref={addItemInputRef}
              className={styles.addItemInput}
              placeholder="Add an item…"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setAddingItem(false);
                  setNewItemText('');
                }
              }}
              autoFocus
            />
            <button
              type="submit"
              className={styles.addItemConfirm}
              disabled={!newItemText.trim() || addItem.isPending}
            >
              Add
            </button>
            <button
              type="button"
              className={styles.addItemCancel}
              onClick={() => {
                setAddingItem(false);
                setNewItemText('');
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            className={styles.addItemBtn}
            onClick={() => setAddingItem(true)}
          >
            + Add item
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function IssueChecklists({ issueId }: Props) {
  const qc = useQueryClient();
  const qk = ['checklists', issueId];

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: qk,
    queryFn: () => checklistsApi.list(issueId),
  });

  const createChecklist = useMutation({
    mutationFn: (title: string) => checklistsApi.create(issueId, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      setNewTitle('');
      setShowNewForm(false);
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const t = newTitle.trim();
    if (!t) return;
    createChecklist.mutate(t);
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Checklists</h2>
        {!showNewForm && (
          <button
            className={styles.addChecklistBtn}
            onClick={() => setShowNewForm(true)}
          >
            + Add checklist
          </button>
        )}
      </div>

      {/* New checklist form */}
      {showNewForm && (
        <form className={styles.newChecklistForm} onSubmit={handleCreate}>
          <input
            className={styles.newChecklistInput}
            placeholder="Checklist title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowNewForm(false);
                setNewTitle('');
              }
            }}
          />
          <button
            type="submit"
            className={styles.confirmBtn}
            disabled={!newTitle.trim() || createChecklist.isPending}
          >
            {createChecklist.isPending ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => {
              setShowNewForm(false);
              setNewTitle('');
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {isLoading ? null : (
        <div className={styles.checklists}>
          {checklists.map((cl) => (
            <ChecklistCard key={cl.id} checklist={cl} issueId={issueId} />
          ))}
        </div>
      )}
    </section>
  );
}
