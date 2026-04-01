'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { projectsApi } from '@/lib/projects-api';
import { teamsApi } from '@/lib/teams-api';
import { usersApi } from '@/lib/users-api';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-context';
import { format } from 'date-fns';
import styles from './page.module.css';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: showAddMember,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
    enabled: showEdit,
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.addMember(id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); setShowAddMember(false); setSelectedUserId(''); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; teamId?: string }) => projectsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); qc.invalidateQueries({ queryKey: ['projects'] }); setShowEdit(false); },
  });

  function openEdit() {
    setEditName(project!.name);
    setEditDesc(project!.description ?? '');
    setEditTeamId(project!.teamId ?? '');
    setEditError('');
    setShowEdit(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { setEditError('Name is required'); return; }
    setSaving(true); setEditError('');
    try {
      await updateMutation.mutateAsync({ name: editName.trim(), description: editDesc.trim() || undefined, teamId: editTeamId || undefined });
    } catch (err: any) {
      setEditError(err?.response?.data?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  const memberIds = new Set(project?.members.map((m) => m.user.id));
  const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  if (isLoading) return <div className={styles.center}><span className={styles.spinner} /></div>;
  if (isError || !project) return <div className={styles.center}><p>Project not found.</p><button onClick={() => router.push('/projects')}>← Back</button></div>;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.push('/projects')}>← All projects</button>
        <div className={styles.topActions}>
          {isAdmin && <button className={styles.editBtn} onClick={openEdit}>Edit</button>}
          <button className={styles.issuesBtn} onClick={() => router.push(`/projects/${id}/issues`)}>
            View issues →
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.projectHeader}>
          <div className={styles.projectIcon}>{project.name[0].toUpperCase()}</div>
          <div>
            <h1 className={styles.projectName}>{project.name}</h1>
            {project.description && <p className={styles.projectDesc}>{project.description}</p>}
            <div className={styles.projectMeta}>
              {project.team && (
                <span className={styles.teamChip} onClick={() => router.push(`/teams/${project.teamId}`)} role="button">
                  {project.team.name}
                </span>
              )}
              <span className={styles.metaText}>Created {format(new Date(project.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Members ({project.members.length})</h2>
            {isAdmin && (
              <button className={styles.addBtn} onClick={() => setShowAddMember(true)}>+ Add member</button>
            )}
          </div>
          <div className={styles.memberList}>
            {project.members.length === 0 && <p className={styles.empty}>No members yet.</p>}
            {project.members.map((m) => (
              <div key={m.user.id} className={styles.memberRow}>
                <div className={styles.memberAvatar}>{m.user.fullName[0].toUpperCase()}</div>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.user.fullName}</span>
                  <span className={styles.memberEmail}>{m.user.email}</span>
                </div>
                <span className={styles.memberRole}>{m.user.role}</span>
                {isAdmin && (
                  <button className={styles.removeBtn} onClick={() => removeMemberMutation.mutate(m.user.id)} disabled={removeMemberMutation.isPending}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddMember && (
        <Modal title="Add member" onClose={() => setShowAddMember(false)}>
          <div className={styles.addForm}>
            <label className={styles.label}>Select user</label>
            <select className={styles.select} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">— choose a user —</option>
              {addableUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
            </select>
            {addableUsers.length === 0 && <p className={styles.empty}>All users are already members.</p>}
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={() => setShowAddMember(false)}>Cancel</button>
              <button className={styles.submitBtn} disabled={!selectedUserId || addMemberMutation.isPending}
                onClick={() => addMemberMutation.mutate(selectedUserId)}>
                {addMemberMutation.isPending ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="Edit project" onClose={() => setShowEdit(false)}>
          <form className={styles.addForm} onSubmit={handleEdit}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input className={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Team (optional)</label>
              <select className={styles.select} value={editTeamId} onChange={(e) => setEditTeamId(e.target.value)}>
                <option value="">— no team —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {editError && <p className={styles.errorMsg}>{editError}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit" className={styles.submitBtn} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
