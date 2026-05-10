'use client';

import { useState, useRef } from 'react';
import { shareApi } from '@/lib/share-api';
import { Issue } from '@/types';
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
  // We render a hidden summary card in the DOM then use the Canvas API to
  // draw it as a PNG — no external library needed.

  async function handleExport() {
    setExporting(true);
    try {
      const canvas = document.createElement('canvas');
      const W = 800;
      const PADDING = 40;
      const LINE = 22;
      const ctx = canvas.getContext('2d')!;

      // ── Helpers ─────────────────────────────────────────────────────────
      const wrapText = (
        text: string,
        maxWidth: number,
        fontSize: number,
        bold = false,
      ): string[] => {
        ctx.font = `${bold ? '600' : '400'} ${fontSize}px "DM Sans", system-ui, sans-serif`;
        const words = text.split(' ');
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        return lines;
      };

      const badge = (
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        bg: string,
        fg: string,
      ) => {
        ctx.font = '500 12px "DM Sans", system-ui, sans-serif';
        const tw = ctx.measureText(text).width;
        const bw = tw + 16;
        const bh = 22;
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(x, y - 15, bw, bh, 4);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.fillText(text, x + 8, y);
        return bw + 8;
      };

      // ── Measure content height ───────────────────────────────────────────
      const titleLines = wrapText(
        issue.title,
        W - PADDING * 2,
        22,
        true,
      );
      const descLines = issue.description
        ? wrapText(issue.description, W - PADDING * 2, 13)
        : [];

      const H =
        PADDING + // top pad
        32 + // project name row
        16 + // gap
        titleLines.length * 28 + // title
        16 + // gap
        30 + // badge row
        (descLines.length ? 20 + descLines.length * LINE + 16 : 0) + // description
        80 + // meta grid (2 rows × 40)
        PADDING; // bottom pad

      canvas.width = W;
      canvas.height = H;
      ctx.clearRect(0, 0, W, H);

      // ── Background ──────────────────────────────────────────────────────
      ctx.fillStyle = '#161b27';
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 12);
      ctx.fill();

      // ── Border ──────────────────────────────────────────────────────────
      ctx.strokeStyle = '#2a3044';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, W - 1, H - 1, 12);
      ctx.stroke();

      let y = PADDING;

      // ── Project name ─────────────────────────────────────────────────────
      ctx.font = '500 13px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = '#5a6480';
      ctx.fillText(issue.project?.name ?? 'Trackr', PADDING, y + 14);
      y += 32;

      // ── Title ────────────────────────────────────────────────────────────
      ctx.font = '600 22px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = '#e8edf5';
      for (const line of titleLines) {
        ctx.fillText(line, PADDING, y + 22);
        y += 28;
      }
      y += 16;

      // ── Badges ───────────────────────────────────────────────────────────
      const statusColors: Record<string, [string, string]> = {
        TODO: ['#1e2535', '#8a95aa'],
        IN_PROGRESS: ['#0f1e45', '#4f7ef8'],
        DONE: ['#0d2e1c', '#34c97e'],
      };
      const priorityColors: Record<string, [string, string]> = {
        LOW: ['#1e2535', '#5a6480'],
        MEDIUM: ['#2e2008', '#f5b223'],
        HIGH: ['#2e0e0e', '#f05252'],
      };
      const typeColors: Record<string, [string, string]> = {
        TASK: ['#1a2e5a', '#4f7ef8'],
        BUG: ['#2e0e0e', '#f05252'],
        STORY: ['#1e1040', '#9b7cf8'],
      };

      let bx = PADDING;
      const [tbg, tfg] = typeColors[issue.type] ?? ['#1e2535', '#8a95aa'];
      bx += badge(ctx, issue.type, bx, y + 15, tbg, tfg);
      const [sbg, sfg] = statusColors[issue.status] ?? ['#1e2535', '#8a95aa'];
      bx += badge(
        ctx,
        issue.status.replace('_', ' '),
        bx,
        y + 15,
        sbg,
        sfg,
      );
      const [pbg, pfg] = priorityColors[issue.priority] ?? ['#1e2535', '#8a95aa'];
      badge(ctx, issue.priority, bx, y + 15, pbg, pfg);
      y += 30;

      // ── Description ───────────────────────────────────────────────────────
      if (descLines.length) {
        y += 20;
        ctx.font = '400 13px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = '#8a95aa';
        for (const line of descLines) {
          ctx.fillText(line, PADDING, y + 14);
          y += LINE;
        }
        y += 16;
      }

      // ── Separator ─────────────────────────────────────────────────────────
      ctx.strokeStyle = '#2a3044';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(W - PADDING, y);
      ctx.stroke();
      y += 20;

      // ── Meta grid ─────────────────────────────────────────────────────────
      const meta: [string, string][] = [
        ['Reporter', issue.reporter?.fullName ?? '—'],
        ['Assignee', issue.assignee?.fullName ?? 'Unassigned'],
        ['Story Points', issue.storyPoints != null ? String(issue.storyPoints) : '—'],
        ['Deadline', issue.deadline ? new Date(issue.deadline).toLocaleDateString() : '—'],
      ];

      const colW = (W - PADDING * 2) / 2;
      for (let i = 0; i < meta.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const mx = PADDING + col * colW;
        const my = y + row * 40;

        ctx.font = '500 11px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = '#5a6480';
        ctx.fillText(meta[i][0].toUpperCase(), mx, my + 12);

        ctx.font = '400 14px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = '#e8edf5';
        ctx.fillText(meta[i][1], mx, my + 28);
      }

      // ── Watermark ─────────────────────────────────────────────────────────
      ctx.font = '400 11px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = '#3a4460';
      ctx.textAlign = 'right';
      ctx.fillText('Trackr', W - PADDING, H - 14);
      ctx.textAlign = 'left';

      // ── Download ─────────────────────────────────────────────────────────
      const slug = issue.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `trackr-${slug}.png`;
      link.click();
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

      {/* Hidden card ref for future use */}
      <div ref={cardRef} style={{ display: 'none' }} />
    </div>
  );
}
