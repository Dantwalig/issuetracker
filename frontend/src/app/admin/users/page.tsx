'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { usersApi } from '@/lib/users-api';
import { User, Role } from '@/types';
import styles from './page.module.css';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  role: 'MEMBER' as Role,
};

// ── User Edit Modal ──────────────────────────────────────────────────────────
function UserModal({
  user,
  currentUserId,
  onClose,
}: {
  user: User;
  currentUserId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isSelf = user.id === currentUserId;
  const [selectedRole, setSelectedRole] = useState<Role>(user.role);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  const roleMutation = useMutation({
    mutationFn: () => usersApi.updateRole(user.id, selectedRole),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (err: unknown) => setError(extractMsg(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => usersApi.deactivate(user.id),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (err: unknown) => setError(extractMsg(err)),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => usersApi.reactivate(user.id),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (err: unknown) => setError(extractMsg(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.delete(user.id),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (err: unknown) => setError(extractMsg(err)),
  });

  const busy =
    roleMutation.isPending ||
    deactivateMutation.isPending ||
    reactivateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.modalName}>{user.fullName}</p>
            <p className={styles.modalEmail}>{user.email}</p>
          </div>
          <span className={`${styles.roleBadge} ${user.role === 'ADMIN' ? styles.roleAdmin : styles.roleMember}`}>
            {user.role}
          </span>
        </div>

        <div className={styles.modalBody}>
          {isSelf && (
            <p className={styles.selfNote}>⚠ You cannot edit your own account.</p>
          )}

          {/* Role editor */}
          {!isSelf && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Change role</p>
              <div className={styles.roleRow}>
                <select
                  className={styles.select}
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as Role)}
                  disabled={busy}
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button
                  className={styles.btnPrimary}
                  onClick={() => roleMutation.mutate()}
                  disabled={busy || selectedRole === user.role}
                >
                  {roleMutation.isPending ? 'Saving…' : 'Save role'}
                </button>
              </div>
            </div>
          )}

          {/* Status toggle */}
          {!isSelf && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Account status</p>
              <div className={styles.statusRow}>
                <span className={`${styles.statusDot} ${user.isActive ? styles.dotActive : styles.dotInactive}`} />
                <span className={styles.statusText}>
                  {user.isActive ? 'Active' : 'Deactivated'}
                </span>
                {user.isActive ? (
                  <button
                    className={styles.btnWarn}
                    onClick={() => deactivateMutation.mutate()}
                    disabled={busy}
                  >
                    {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
                  </button>
                ) : (
                  <button
                    className={styles.btnSuccess}
                    onClick={() => reactivateMutation.mutate()}
                    disabled={busy}
                  >
                    {reactivateMutation.isPending ? 'Reactivating…' : 'Reactivate'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Permanent delete */}
          {!isSelf && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Danger zone</p>
              {!confirmDelete ? (
                <button
                  className={styles.btnDanger}
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  Permanently delete user
                </button>
              ) : (
                <div className={styles.confirmBox}>
                  <p className={styles.confirmText}>
                    This will permanently delete <strong>{user.fullName}</strong> and cannot be undone.
                  </p>
                  <div className={styles.confirmActions}>
                    <button
                      className={styles.btnDanger}
                      onClick={() => deleteMutation.mutate()}
                      disabled={busy}
                    >
                      {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete permanently'}
                    </button>
                    <button
                      className={styles.btnGhost}
                      onClick={() => setConfirmDelete(false)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractMsg(err: unknown): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Something went wrong');
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: usersApi.list,
  });

  const mutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess(
        `User "${created.fullName}" created. A welcome email with their temporary password has been sent to ${created.email}.`,
      );
      setFormError('');
      setForm(EMPTY_FORM);
    },
    onError: (err: unknown) => {
      setFormError(extractMsg(err));
      setSuccess('');
    },
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess('');
    setFormError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>User Management</h1>
        <p className={styles.subtitle}>
          Create accounts for teammates and manage their roles and access.
        </p>
      </div>

      {/* ── Create user form ── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Register a new user</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                name="fullName"
                className={styles.input}
                type="text"
                placeholder="Jane Smith"
                value={form.fullName}
                onChange={handleChange}
                required
                minLength={2}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                className={styles.input}
                type="email"
                placeholder="jane@company.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="role">Role</label>
              <select
                id="role"
                name="role"
                className={styles.select}
                value={form.role}
                onChange={handleChange}
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create user & send invite'}
            </button>
            {success && <span className={styles.success}>✓ {success}</span>}
            {formError && <span className={styles.error}>{formError}</span>}
          </div>
        </form>
      </div>

      {/* ── Active users table ── */}
      <div className={styles.tableSection}>
        <h2 className={styles.tableTitle}>
          Active users <span className={styles.count}>{activeUsers.length}</span>
        </h2>
        <div className={styles.tableWrap}>
          {isLoading ? (
            <p className={styles.empty}>Loading users…</p>
          ) : activeUsers.length === 0 ? (
            <p className={styles.empty}>No active users.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((u) => (
                  <tr key={u.id} className={u.id === currentUser?.id ? styles.selfRow : ''}>
                    <td>
                      {u.fullName}
                      {u.id === currentUser?.id && <span className={styles.youTag}> (you)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${u.role === 'ADMIN' ? styles.roleAdmin : styles.roleMember}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className={styles.btnManage}
                        onClick={() => setSelectedUser(u)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Deactivated users table ── */}
      {inactiveUsers.length > 0 && (
        <div className={styles.tableSection}>
          <h2 className={styles.tableTitle}>
            Deactivated users <span className={styles.count}>{inactiveUsers.length}</span>
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inactiveUsers.map((u) => (
                  <tr key={u.id} className={styles.inactiveRow}>
                    <td>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${u.role === 'ADMIN' ? styles.roleAdmin : styles.roleMember}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className={styles.btnManage}
                        onClick={() => setSelectedUser(u)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {selectedUser && currentUser && (
        <UserModal
          user={selectedUser}
          currentUserId={currentUser.id}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
