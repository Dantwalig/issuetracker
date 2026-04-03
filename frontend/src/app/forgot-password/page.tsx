'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <span className={styles.logoMark} />
          <span className={styles.logoText}>Trackr</span>
        </div>

        <h1 className={styles.heading}>Reset your password</h1>

        {submitted ? (
          <>
            <p className={styles.sub}>
              If that email is registered, a reset link is on its way. Check
              your inbox (and spam folder just in case).
            </p>
            <Link
              href="/login"
              className={styles.btn}
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: 8,
                textDecoration: 'none',
              }}
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className={styles.sub}>
              Enter the email address linked to your account and we&apos;ll
              send you a link to reset your password.
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button
                className={styles.btn}
                type="submit"
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className={styles.hint}>
              <Link href="/login">← Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
