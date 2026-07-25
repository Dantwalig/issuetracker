'use client';

import { useEffect } from 'react';

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error so it shows in the browser console and any monitoring tools
    console.error('[Project Error Boundary]', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '80px 24px',
        textAlign: 'center',
        gap: 16,
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: 'var(--red, #ef4444)' }}
      >
        <path
          d="M12 2L2 20h20L12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 9v5M12 16.5v.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-1)',
            margin: '0 0 6px',
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-2)',
            margin: '0 0 20px',
            maxWidth: 340,
          }}
        >
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '8px 20px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius, 6px)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
