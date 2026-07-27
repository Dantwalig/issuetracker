'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Slim progress bar shown at the very top of the viewport whenever any
 * react-query request (fetch or mutation) is in flight. This gives the
 * user instant feedback that an action was received, even before the
 * specific UI for that action (button spinner, skeleton, etc.) appears.
 */
export function GlobalProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating > 0;

  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let growTimer: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      // Small delay avoids flicker for near-instant requests.
      showTimer = setTimeout(() => {
        setVisible(true);
        setWidth(15);
        growTimer = setTimeout(() => setWidth(70), 120);
      }, 80);
    } else {
      setWidth(100);
      hideTimer = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 250);
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      if (growTimer) clearTimeout(growTimer);
    };
  }, [active]);

  if (!visible && width === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'linear-gradient(90deg, var(--accent), var(--purple))',
          transition: active
            ? 'width 0.6s ease-out'
            : 'width 0.25s ease-in, opacity 0.25s ease-in',
          opacity: visible ? 1 : 0,
          boxShadow: '0 0 8px var(--accent)',
        }}
      />
    </div>
  );
}
