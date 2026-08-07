'use client';

import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { shareApi } from '@/lib/share-api';
import { Issue } from '@/types';
import { ExportCard } from './ExportCard';
import styles from './ShareModal.module.css';

interface Props {
  issue: Issue & { shareToken?: string | null };
  onClose: () => void;
  /** Called after token generated/revoked so parent can refetch the issue */
  onTokenChange: (token: string | null) => void;
}

export function ShareModal({ issue, onClose, onTokenChange }: Props) {
  const [token, setToken] = useState<string | null>(issue.shareToken ?? null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${token}`
    : null;

  // ── Link actions ────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { shareToken } = await shareApi.generate(issue.id);
      setToken(shareToken);
      onTokenChange(shareToken);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    if (!confirm('Revoke the share link? Anyone with the current link will lose access.'))
      return;
    setRevoking(true);
    try {
      await shareApi.revoke(issue.id);
      setToken(null);
      onTokenChange(null);
    } finally {
      setRevoking(false);
    }
  }

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Image export ────────────────────────────────────────────────────────

  async function handleExport() {
    if (!cardRef.current) return;
    
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2, // High resolution
        skipFonts: false,
      });
      
      const slug = issue.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40);
        
      const link = document.createElement('a');
      link.download = `trackr-${slug}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert('Failed to export image. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Share card</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* Public link section */}
          <p className={styles.description}>
            Anyone with a Trackr account can view this card via the link below. The link
            remains active until you revoke it.
          </p>

          {shareUrl ? (
            <>
              <div className={styles.linkRow}>
                <input
                  className={styles.linkInput}
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  className={`${styles.copyBtn} ${copied ? styles.copySuccess : ''}`}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Copied' : 'Copy link'}
                </button>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.revokeBtn}
                  onClick={handleRevoke}
                  disabled={revoking}
                >
                  {revoking ? 'Revoking…' : 'Revoke link'}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.actions}>
              <button
                className={styles.generateBtn}
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Generating…' : 'Generate share link'}
              </button>
            </div>
          )}

          <div className={styles.divider} />

          {/* Image export section */}
          <div className={styles.exportSection}>
            <span className={styles.exportLabel}>Export</span>
            <button
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <span className={styles.spinner} />
              ) : (
                <span>🖼</span>
              )}
              {exporting ? 'Exporting…' : 'Download as PNG'}
            </button>
          </div>
        </div>
      </div>

      {/* Off-screen card used by html-to-image */}
      <ExportCard ref={cardRef} issue={issue} />
    </div>
  );
}
