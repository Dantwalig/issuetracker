'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { teamsApi } from '@/lib/teams-api';
import { usersApi } from '@/lib/users-api';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-context';
import { format } from 'date-fns';
import styles from './page.module.css';
import { DeleteModal } from '@/components/ui/DeleteModal';
import { recycleBinApi } from '@/lib/recycle-bin-api';
import { BackButton } from '@/components/ui/BackButton';

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN';
  const [showDelete, setShowDelete] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: team, isLoading, isError } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamsApi.get(id),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: showAddMember,
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.addMember(id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team', id] }); setShowAddMember(false); setSelectedUserId(''); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', id] }),
  });

  const promoteTeamLeadMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.promoteToTeamLead(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', id] }),
  });

  const revokeTeamLeadMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.revokeTeamLead(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', id] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => teamsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team', id] }); qc.invalidateQueries({ queryKey: ['teams'] }); setShowEdit(false); },
  });

  function openEdit() {
    setEditName(team!.name);
    setEditDesc(team!.description ?? '');
    setEditError('');
    setShowEdit(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { setEditError('Name is required'); return; }
    setSaving(true);
    setEditError('');
    try {
      await updateMutation.mutateAsync({ name: editName.trim(), description: editDesc.trim() || undefined });
    } catch (err: any) {
      setEditError(err?.response?.data?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  const memberIds = new Set(team?.members.map((m) => m.user.id));
  const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  if (isLoading) return <div className={styles.center}><span className={styles.spinner} /></div>;
  if (isError || !team) return <div className={styles.center}><p>Team not found.</p><button onClick={() => router.push('/teams')}>← Back</button></div>;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <BackButton href="/teams" label="All teams" />
        <div className={styles.topBarActions}>
          {isAdmin && <button className={styles.editBtn} onClick={openEdit}>Edit</button>}
          {isAdmin && (
            <button className={styles.deleteBtn} onClick={() => setShowDelete(true)}>Delete</button>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.teamHeader}>
          <div className={styles.teamAvatar}>{team.name[0].toUpperCase()}</div>
          <div>
            <h1 className={styles.teamName}>{team.name}</h1>
            {team.description && <p className={styles.teamDesc}>{team.description}</p>}
            <p className={styles.teamMeta}>Created {format(new Date(team.createdAt), 'MMM d, yyyy')}</p>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Members ({team.members.length})</h2>
            {isAdmin && (
              <button className={styles.addBtn} onClick={() => setShowAddMember(true)}>+ Add member</button>
            )}
          </div>
          <div className={styles.memberList}>
            {team.members.length === 0 && <p className={styles.empty}>No members yet.</p>}
            {team.members.map((m) => (
              <div key={m.user?.id} className={styles.memberRow}>
                <div className={styles.memberAvatar}>{m.user?.fullName?.[0]?.toUpperCase()}</div>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.user?.fullName}</span>
                  <span className={styles.memberEmail}>{m.user?.email}</span>
                </div>
                <span className={styles.memberRole}>{m.user?.role}</span>
                {m.scopedRole === 'TEAM_LEAD' && (
                  <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--accent, #6366f1)', color: '#fff', borderRadius: 4, padding: '2px 7px', marginLeft: 4 }}>
                    Team Lead
                  </span>
                )}
                {isAdmin && m.scopedRole !== 'TEAM_LEAD' && (
                  <button
                    className={styles.removeBtn}
                    style={{ background: 'none', border: '1px solid var(--accent, #6366f1)', color: 'var(--accent, #6366f1)', marginLeft: 4 }}
                    onClick={() => promoteTeamLeadMutation.mutate(m.user?.id)}
                    disabled={promoteTeamLeadMutation.isPending}
                  >Make Lead</button>
                )}
                {isAdmin && m.scopedRole === 'TEAM_LEAD' && (
                  <button
                    className={styles.removeBtn}
                    style={{ background: 'none', border: '1px solid #f59e0b', color: '#f59e0b', marginLeft: 4 }}
                    onClick={() => revokeTeamLeadMutation.mutate(m.user?.id)}
                    disabled={revokeTeamLeadMutation.isPending}
                  >Revoke Lead</button>
                )}
                {isAdmin && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeMemberMutation.mutate(m.user?.id)}
                    disabled={removeMemberMutation.isPending}
                  >Remove</button>
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
              {addableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
              ))}
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
        <Modal title="Edit team" onClose={() => setShowEdit(false)}>
          <form className={styles.addForm} onSubmit={handleEdit}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input className={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
            {editError && <p className={styles.errorMsg}>{editError}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="submit" className={styles.submitBtn} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showDelete && team && (
        <DeleteModal
          itemName={team.name}
          itemType="team"
          onConfirm={async (reason) => {
            await recycleBinApi.deleteTeam(id, reason);
            router.push('/teams');
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
