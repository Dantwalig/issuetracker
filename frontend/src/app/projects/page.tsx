'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/projects-api';
import { teamsApi } from '@/lib/teams-api';
import { Project, CreateProjectPayload } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import styles from './page.module.css';

export default function ProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
    enabled: showCreate,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectPayload) => projectsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setName(''); setDescription(''); setTeamId('');
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setCreating(true); setError('');
    try {
      await createMutation.mutateAsync({ name: name.trim(), description: description.trim() || undefined, teamId: teamId || undefined });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Projects</h1>
          <p className={styles.sub}>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            <span>+</span> New project
          </button>
        )}
      </div>

      {isLoading && <div className={styles.state}><span className={styles.spinner} /><span>Loading…</span></div>}
      {!isLoading && projects.length === 0 && (
        <div className={styles.state}><p>No projects yet{!isAdmin ? ' — ask an admin to create one and add you.' : '.'}</p></div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className={styles.grid}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => router.push(`/projects/${p.id}`)} />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="New project" onClose={() => setShowCreate(false)}>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.field}>
              <label className={styles.label}>Name <span className={styles.req}>*</span></label>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backend API" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional…" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Assign to team (optional)</label>
              <select className={styles.select} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">— no team —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {error && <p className={styles.errorMsg}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className={styles.submitBtn} disabled={creating}>{creating ? 'Creating…' : 'Create project'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className={styles.cardTop}>
        <div className={styles.projectIcon}>{project.name[0].toUpperCase()}</div>
        <div className={styles.cardMeta}>
          <h3 className={styles.projectName}>{project.name}</h3>
          {project.team && <span className={styles.teamBadge}>{project.team.name}</span>}
        </div>
      </div>
      {project.description && <p className={styles.projectDesc}>{project.description}</p>}
      <div className={styles.cardFooter}>
        <span>{project.members.length} member{project.members.length !== 1 ? 's' : ''}</span>
        <span>{formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>
      </div>
    </div>
  );
}
