'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import styles from '../change-password/change-password.module.css';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: unknown) {
      const msg = (
        err as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg.join(', ')
          : (msg ?? 'Reset failed. The link may have expired.'),
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className={styles.sub}>
        This link is invalid or missing a token.{' '}
        <Link href="/forgot-password">Request a new one.</Link>
      </p>
    );
  }

  if (done) {
    return (
      <p className={styles.sub}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden style={{verticalAlign:'middle',marginRight:4}}><path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Password updated successfully! Redirecting you to sign in…
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          className={styles.input}
          type="password"
          placeholder="Min. 6 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          className={styles.input}
          type="password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.btn} type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <span className={styles.logoMark} />
          <span className={styles.logoText}>Trackr</span>
        </div>

        <h1 className={styles.heading}>Choose a new password</h1>
        <p className={styles.sub}>
          Your reset link is valid for 1 hour. Choose a password you
          haven&apos;t used before.
        </p>

        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>

        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            color: 'var(--text-3)',
            textAlign: 'center',
          }}
        >
          <Link href="/login" style={{ color: 'var(--text-2)' }}>
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
