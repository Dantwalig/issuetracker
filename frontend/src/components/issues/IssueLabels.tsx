'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labelsApi, Label } from '@/lib/labels-api';
import styles from './IssueLabels.module.css';

interface Props {
  issueId: string;
  projectId: string;
}

export function IssueLabels({ issueId, projectId }: Props) {
  const qc = useQueryClient();
  const [showManager, setShowManager] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [creating, setCreating] = useState(false);

  const { data: projectLabels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
  });

  const { data: issueLabels = [] } = useQuery({
    queryKey: ['issue-labels', issueId],
    queryFn: () => labelsApi.getIssueLabels(issueId),
  });

  const assignedIds = new Set(issueLabels.map((il) => il.labelId));

  const toggleMutation = useMutation({
    mutationFn: ({ labelId, assigned }: { labelId: string; assigned: boolean }) =>
      assigned
        ? labelsApi.removeFromIssue(issueId, labelId)
        : labelsApi.addToIssue(issueId, labelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-labels', issueId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      labelsApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labels', projectId] });
      setNewName('');
      setNewColor('#6366f1');
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) => labelsApi.remove(projectId, labelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labels', projectId] });
      qc.invalidateQueries({ queryKey: ['issue-labels', issueId] });
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createMutation.mutateAsync({ name: newName.trim(), color: newColor });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.sectionLabel}>Labels</span>
        <button className={styles.manageBtn} onClick={() => setShowManager((v) => !v)}>
          {showManager ? 'Done' : 'Manage'}
        </button>
      </div>

      {/* Current labels on this issue */}
      <div className={styles.chips}>
        {issueLabels.length === 0 && !showManager && (
          <span className={styles.empty}>No labels</span>
        )}
        {issueLabels.map((il) => (
          <span
            key={il.labelId}
            className={styles.chip}
            style={{ backgroundColor: il.label.color + '22', borderColor: il.label.color, color: il.label.color }}
          >
            {il.label.name}
          </span>
        ))}
      </div>

      {/* Label manager panel */}
      {showManager && (
        <div className={styles.panel}>
          <p className={styles.panelTitle}>Project labels — click to toggle on this issue</p>
          <div className={styles.labelList}>
            {projectLabels.map((label) => {
              const assigned = assignedIds.has(label.id);
              return (
                <div key={label.id} className={styles.labelRow}>
                  <button
                    className={`${styles.labelToggle} ${assigned ? styles.assigned : ''}`}
                    onClick={() => toggleMutation.mutate({ labelId: label.id, assigned })}
                    disabled={toggleMutation.isPending}
                  >
                    <span
                      className={styles.dot}
                      style={{ backgroundColor: label.color }}
                    />
                    <span className={styles.labelName}>{label.name}</span>
                    {assigned && <span className={styles.checkmark}>✓</span>}
                  </button>
                  <button
                    className={styles.deleteLabel}
                    onClick={() => deleteLabelMutation.mutate(label.id)}
                    title="Delete label from project"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {projectLabels.length === 0 && (
              <p className={styles.noLabels}>No labels yet. Create one below.</p>
            )}
          </div>

          <form onSubmit={handleCreate} className={styles.createForm}>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className={styles.colorPicker}
              title="Pick label color"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New label name…"
              className={styles.nameInput}
              maxLength={50}
            />
            <button type="submit" className={styles.createBtn} disabled={creating || !newName.trim()}>
              {creating ? '…' : 'Add'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
