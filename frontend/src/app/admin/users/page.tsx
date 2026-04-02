'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/users-api';
import { User } from '@/types';
import styles from './page.module.css';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  role: 'MEMBER' as 'ADMIN' | 'MEMBER',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: usersApi.list,
  });

  const mutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess(`User "${created.fullName}" created successfully.`);
      setFormError('');
      setForm(EMPTY_FORM);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create user.'));
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>User Management</h1>
        <p className={styles.subtitle}>
          Create accounts for teammates. Users cannot register themselves.
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
              <label className={styles.label} htmlFor="password">Temporary password</label>
              <input
                id="password"
                name="password"
                className={styles.input}
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
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
            <button
              className={styles.btnPrimary}
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Creating…' : 'Create user'}
            </button>
            {success && <span className={styles.success}>✓ {success}</span>}
            {formError && <span className={styles.error}>{formError}</span>}
          </div>
        </form>
      </div>

      {/* ── Users table ── */}
      <div className={styles.tableWrap}>
        {isLoading ? (
          <p className={styles.empty}>Loading users…</p>
        ) : users.length === 0 ? (
          <p className={styles.empty}>No users yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>
                    <span
                      className={`${styles.roleBadge} ${
                        u.role === 'ADMIN' ? styles.roleAdmin : styles.roleMember
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
