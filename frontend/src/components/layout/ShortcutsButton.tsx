'use client';

import { useState } from 'react';
import { useShortcut } from '@/lib/keyboard-shortcuts';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import styles from './ShortcutsButton.module.css';

export function ShortcutsButton() {
  const [open, setOpen] = useState(false);

  // Register the global '?' shortcut to open/close this modal
  useShortcut('global:help', {
    key: '?',
    description: 'Show keyboard shortcuts',
    group: 'Global',
    action: () => setOpen((v) => !v),
  });

  useShortcut('global:help-escape', {
    key: 'Escape',
    description: 'Close dialog / cancel',
    group: 'Global',
    action: () => setOpen(false),
    disabled: !open,
  });

  return (
    <>
      <button
        className={styles.btn}
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <rect x="0.5" y="0.5" width="14" height="14" rx="2.5" stroke="currentColor" strokeOpacity="0.5"/>
          <path d="M3 5.5h1.5M6.5 5.5h1.5M10 5.5h1.5M3 8h1.5M6.5 8h1.5M10 8h1.5M4.5 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className={styles.label}>?</span>
      </button>

      {open && <KeyboardShortcutsModal onClose={() => setOpen(false)} />}
    </>
  );
}
