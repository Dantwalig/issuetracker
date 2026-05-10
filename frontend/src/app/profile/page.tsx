'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { profileApi } from '@/lib/profile-api';
import { BackButton } from '@/components/ui/BackButton';
import api from '@/lib/api';
import styles from './page.module.css';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarBase64, setAvatarBase64] = useState<string | undefined>();
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  const profileMutation = useMutation({
    mutationFn: () => profileApi.update({ fullName: fullName.trim() || undefined, avatarUrl: avatarBase64 }),
    onSuccess: async () => {
      await refreshUser();
      setProfileSuccess('Profile updated successfully.');
      setProfileError('');
      setAvatarBase64(undefined);
    },
    onError: (err: any) => {
      setProfileError(err?.response?.data?.message ?? 'Failed to update profile');
      setProfileSuccess('');
    },
  });

  const pwMutation = useMutation({
    mutationFn: () => api.patch('/auth/change-password', { currentPassword: currentPw, newPassword: newPw }),
    onSuccess: () => {
      setPwSuccess('Password changed successfully.');
      setPwError('');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: (err: any) => {
      setPwError(err?.response?.data?.message ?? 'Failed to change password');
      setPwSuccess('');
    },
  });

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setProfileError('Only JPG and PNG files are allowed');
      e.target.value = '';
      return;
    }
    if (file.size > 500 * 1024) {
      setProfileError('Avatar must be under 500KB');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = ev.target?.result as string;
      setAvatarPreview(b64);
      setAvatarBase64(b64);
      setProfileError('');
    };
    reader.readAsDataURL(file);
  }

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters'); return; }
    pwMutation.mutate();
  }

  return (
    <div className={styles.page}>
      <BackButton href="/projects" label="Back" />
      <h1 className={styles.title}>Profile Settings</h1>

      {/* ── Profile card ── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Profile Information</h2>

        <div className={styles.avatarRow}>
          <div className={styles.avatarWrap} onClick={() => fileRef.current?.click()}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarInitial}>{user?.fullName?.[0]?.toUpperCase() ?? '?'}</span>
            )}
            <div className={styles.avatarOverlay}><CameraIcon /></div>
          </div>
          <div className={styles.avatarInfo}>
            <p className={styles.avatarLabel}>Profile photo</p>
            <p className={styles.avatarHint}>Click the avatar to upload. Max 500KB. JPG or PNG.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={handleAvatarChange} />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Full name</label>
          <input
            className={styles.input}
            value={fullName}
            onChange={e => { setFullName(e.target.value); setProfileSuccess(''); setProfileError(''); }}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input className={`${styles.input} ${styles.inputDisabled}`} value={user?.email ?? ''} disabled />
          <p className={styles.hint}>Email cannot be changed. Contact a superadmin.</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Role</label>
          <input className={`${styles.input} ${styles.inputDisabled}`} value={user?.role ?? ''} disabled />
        </div>

        {profileSuccess && <p className={styles.success}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden style={{verticalAlign:'middle',marginRight:4}}>
              <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>{profileSuccess}</p>}
        {profileError && <p className={styles.error}>{profileError}</p>}

        <button
          className={styles.saveBtn}
          onClick={() => profileMutation.mutate()}
          disabled={profileMutation.isPending}
        >
          {profileMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* ── Password card ── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Change Password</h2>
        <form onSubmit={handlePwSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Current password</label>
            <input className={styles.input} type="password" value={currentPw}
              onChange={e => { setCurrentPw(e.target.value); setPwError(''); setPwSuccess(''); }} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>New password</label>
            <input className={styles.input} type="password" value={newPw}
              onChange={e => { setNewPw(e.target.value); setPwError(''); setPwSuccess(''); }} required minLength={6} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Confirm new password</label>
            <input className={styles.input} type="password" value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setPwError(''); setPwSuccess(''); }} required />
          </div>
          {pwSuccess && <p className={styles.success}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden style={{verticalAlign:'middle',marginRight:4}}>
              <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>{pwSuccess}</p>}
          {pwError && <p className={styles.error}>{pwError}</p>}
          <button type="submit" className={styles.saveBtn} disabled={pwMutation.isPending}>
            {pwMutation.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 5.5A1.5 1.5 0 0 1 2.5 4h1l1-2h7l1 2h1A1.5 1.5 0 0 1 15 5.5v7A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-7Z"
        stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
