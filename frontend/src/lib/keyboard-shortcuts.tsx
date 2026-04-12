'use client';

import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';

export interface Shortcut {
  key: string;          // e.g. 'n', 'Escape', '?'
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  group: string;
  action: () => void;
  disabled?: boolean;
}

interface ShortcutRegistration {
  id: string;
  shortcut: Shortcut;
}

interface KeyboardShortcutsContextValue {
  register: (id: string, shortcut: Shortcut) => void;
  unregister: (id: string) => void;
  shortcuts: ShortcutRegistration[];
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

/** Returns true if the event target is an input-like element where we should NOT fire shortcuts */
function isInputFocused(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  if (!target) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}

function modifiersMatch(e: KeyboardEvent, s: Shortcut): boolean {
  const ctrl = s.ctrl ?? false;
  const meta = s.meta ?? false;
  const shift = s.shift ?? false;
  const alt = s.alt ?? false;
  return (
    e.ctrlKey === ctrl &&
    e.metaKey === meta &&
    e.shiftKey === shift &&
    e.altKey === alt
  );
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const shortcutsRef = useRef<ShortcutRegistration[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutRegistration[]>([]);
  const [paused, setPaused] = useState(false);

  const register = useCallback((id: string, shortcut: Shortcut) => {
    shortcutsRef.current = [
      ...shortcutsRef.current.filter((s) => s.id !== id),
      { id, shortcut },
    ];
    setShortcuts([...shortcutsRef.current]);
  }, []);

  const unregister = useCallback((id: string) => {
    shortcutsRef.current = shortcutsRef.current.filter((s) => s.id !== id);
    setShortcuts([...shortcutsRef.current]);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (paused) return;

      for (const { shortcut } of shortcutsRef.current) {
        if (shortcut.disabled) continue;

        // Allow Escape and ? even when input is focused
        const allowInInput = e.key === 'Escape' || e.key === '?';
        if (!allowInInput && isInputFocused(e)) continue;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          modifiersMatch(e, shortcut)
        ) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paused]);

  return (
    <KeyboardShortcutsContext.Provider value={{ register, unregister, shortcuts, paused, setPaused }}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) throw new Error('useKeyboardShortcuts must be used inside KeyboardShortcutsProvider');
  return ctx;
}

/**
 * Register a keyboard shortcut. Automatically unregisters on unmount.
 * Pass `disabled: true` to temporarily disable without unregistering.
 */
export function useShortcut(id: string, shortcut: Shortcut) {
  const { register, unregister } = useKeyboardShortcuts();

  useEffect(() => {
    register(id, shortcut);
    return () => unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, shortcut.key, shortcut.disabled, shortcut.action]);
}
