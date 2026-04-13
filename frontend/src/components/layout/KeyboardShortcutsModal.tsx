'use client';

import { useEffect, useRef } from 'react';
import { useKeyboardShortcuts } from '@/lib/keyboard-shortcuts';
import styles from './KeyboardShortcutsModal.module.css';

interface Props {
  onClose: () => void;
}

function formatKey(shortcut: {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}) {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.meta) parts.push('⌘');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');

  const key = shortcut.key;
  const display =
    key === 'Escape' ? 'Esc' :
    key === 'Enter' ? '↵' :
    key === 'ArrowUp' ? '↑' :
    key === 'ArrowDown' ? '↓' :
    key === 'ArrowLeft' ? '←' :
    key === 'ArrowRight' ? '→' :
    key === ' ' ? 'Space' :
    key === '?' ? '?' :
    key.toUpperCase();

  parts.push(display);
  return parts;
}

export function KeyboardShortcutsModal({ onClose }: Props) {
  const { shortcuts } = useKeyboardShortcuts();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Group shortcuts by their group property
  const groups: Record<string, typeof shortcuts> = {};
  for (const s of shortcuts) {
    if (s.shortcut.disabled) continue;
    const g = s.shortcut.group;
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }

  // Close on click outside
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-label="Keyboard shortcuts">
        <div className={styles.header}>
          <h2 className={styles.title}>Keyboard Shortcuts</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className={styles.group}>
              <h3 className={styles.groupTitle}>{group}</h3>
              <div className={styles.rows}>
                {items.map(({ id, shortcut }) => (
                  <div key={id} className={styles.row}>
                    <span className={styles.description}>{shortcut.description}</span>
                    <span className={styles.keys}>
                      {formatKey(shortcut).map((k, i) => (
                        <kbd key={i} className={styles.key}>{k}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groups).length === 0 && (
            <p className={styles.empty}>No shortcuts available on this page.</p>
          )}
        </div>

        <div className={styles.footer}>
          Press <kbd className={styles.key}>Esc</kbd> or <kbd className={styles.key}>?</kbd> to close
        </div>
      </div>
    </div>
  );
}
