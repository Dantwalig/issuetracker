'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/lib/teams-api';
import { Team, CreateTeamPayload } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import styles from './page.module.css';

export default function TeamsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTeamPayload) => teamsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setShowCreate(false);
      setName('');
      setDescription('');
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setCreating(true);
    setError('');
    try {
      await createMutation.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create team');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Teams</h1>
          <p className={styles.sub}>{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            <span>+</span> New team
          </button>
        )}
      </div>

      {isLoading && (
        <div className={styles.state}><span className={styles.spinner} /><span>Loading…</span></div>
      )}

      {!isLoading && teams.length === 0 && (
        <div className={styles.state}><p>No teams yet.</p></div>
      )}

      {!isLoading && teams.length > 0 && (
        <div className={styles.grid}>
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} onClick={() => router.push(`/teams/${team.id}`)} />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="New team" onClose={() => setShowCreate(false)}>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.field}>
              <label className={styles.label}>Name <span className={styles.req}>*</span></label>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional description…" />
            </div>
            {error && <p className={styles.errorMsg}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className={styles.submitBtn} disabled={creating}>{creating ? 'Creating…' : 'Create team'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TeamCard({ team, onClick }: { team: Team; onClick: () => void }) {
  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className={styles.cardHeader}>
        <span className={styles.teamAvatar}>{team.name[0].toUpperCase()}</span>
        <div>
          <h3 className={styles.teamName}>{team.name}</h3>
          <p className={styles.memberCount}>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {team.description && <p className={styles.teamDesc}>{team.description}</p>}
      <p className={styles.teamDate}>Created {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true })}</p>
    </div>
  );
}
