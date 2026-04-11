'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { usersApi } from '@/lib/users-api';
import { messagesApi, DirectMessage, Conversation, DMUser } from '@/lib/messages-api';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import styles from './page.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ user, size = 38 }: { user: DMUser; size?: number }) {
  const cls = size < 32 ? styles.msgAvatar : size < 36 ? styles.chatHeaderAvatar : size === 38 ? styles.convAvatar : styles.pickerAvatar;
  const imgCls = size < 32 ? styles.msgAvatarImg : size < 36 ? styles.chatHeaderAvatarImg : size === 38 ? styles.convAvatarImg : styles.pickerAvatarImg;
  return (
    <div className={cls} style={{ width: size, height: size, minWidth: size }}>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt={user.fullName} className={imgCls} />
        : initials(user.fullName)}
    </div>
  );
}

function dateSepLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

// ── New conversation picker ───────────────────────────────────────────────────

function NewConvPicker({
  currentUserId,
  onSelect,
  onClose,
}: {
  currentUserId: string;
  onSelect: (user: DMUser) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const filtered = users.filter(
    (u) =>
      u.id !== currentUserId &&
      u.isActive &&
      (u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.picker}>
        <div className={styles.pickerHeader}>
          <p className={styles.pickerTitle}>New conversation</p>
          <button className={styles.pickerClose} onClick={onClose}>×</button>
        </div>
        <input
          className={styles.pickerSearch}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.pickerList}>
          {filtered.length === 0 && (
            <p className={styles.pickerEmpty}>No users found</p>
          )}
          {filtered.map((u) => (
            <div key={u.id} className={styles.pickerItem} onClick={() => onSelect(u as unknown as DMUser)}>
              <div className={styles.pickerAvatar}>
                {(u as any).avatarUrl
                  ? <img src={(u as any).avatarUrl} alt={u.fullName} className={styles.pickerAvatarImg} />
                  : initials(u.fullName)}
              </div>
              <div>
                <p className={styles.pickerName}>{u.fullName}</p>
                <p className={styles.pickerEmail}>{u.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tick component ────────────────────────────────────────────────────────────

function Tick({ msg, partnerId }: { msg: DirectMessage; partnerId: string }) {
  // ✓  sent, ✓✓ delivered (partner has fetched), blue ✓✓ read
  const isRead = msg.isRead;
  return (
    <span className={`${styles.msgTick} ${isRead ? styles.msgTickRead : ''}`}>
      {isRead ? '✓✓' : '✓'}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Conversation list (poll every 5s) ──────────────────────────────────────
  const { data: conversations = [], isLoading: convLoading } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: messagesApi.listConversations,
    refetchInterval: 5000,
  });

  // ── Active conversation messages (poll every 5s when open) ────────────────
  const { data: messages = [] } = useQuery({
    queryKey: ['dm-messages', activePartnerId],
    queryFn: () => messagesApi.getConversation(activePartnerId!),
    enabled: !!activePartnerId,
    refetchInterval: 5000,
  });

  // Derive active partner user object
  const activePartner: DMUser | null =
    activePartnerId
      ? (conversations.find((c) => c.partner.id === activePartnerId)?.partner ??
         // might be new conversation not yet in list
         null)
      : null;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Invalidate conversation list when messages change (to update last message + unread count)
  useEffect(() => {
    if (activePartnerId) {
      qc.invalidateQueries({ queryKey: ['dm-conversations'] });
    }
  }, [messages.length, activePartnerId]);

  // ── Send mutation ─────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (body: string) => messagesApi.send(activePartnerId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-messages', activePartnerId] });
      qc.invalidateQueries({ queryKey: ['dm-conversations'] });
      setDraft('');
      textareaRef.current?.focus();
    },
  });

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (msgId: string) => messagesApi.delete(msgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-messages', activePartnerId] });
      qc.invalidateQueries({ queryKey: ['dm-conversations'] });
    },
  });

  function handleSend() {
    const body = draft.trim();
    if (!body || !activePartnerId || sendMutation.isPending) return;
    sendMutation.mutate(body);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSelectPartner(partnerId: string, partnerData?: DMUser) {
    setActivePartnerId(partnerId);
    setShowPicker(false);
  }

  function handlePickUser(u: DMUser) {
    setActivePartnerId(u.id);
    setShowPicker(false);
    // If not in conversations list yet, set partner display name via query cache
    if (!conversations.find((c) => c.partner.id === u.id)) {
      qc.setQueryData(['dm-messages', u.id], []);
    }
  }

  // ── Group messages by date for separators ─────────────────────────────────
  function renderMessages() {
    if (messages.length === 0) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💬</span>
          <span>No messages yet. Say hello!</span>
        </div>
      );
    }

    const nodes: React.ReactNode[] = [];
    let lastDate: Date | null = null;
    let lastSenderId: string | null = null;

    messages.forEach((msg, idx) => {
      const msgDate = new Date(msg.createdAt);
      const isMine = msg.senderId === user?.id;

      // Date separator
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        nodes.push(
          <div key={`sep-${msg.id}`} className={styles.dateSep}>
            {dateSepLabel(msgDate)}
          </div>,
        );
        lastDate = msgDate;
        lastSenderId = null; // reset grouping on date change
      }

      const isFirst = lastSenderId !== msg.senderId;
      lastSenderId = msg.senderId;
      const isLast = idx === messages.length - 1 || messages[idx + 1].senderId !== msg.senderId;

      const sender = isMine ? null : activePartner;

      nodes.push(
        <div key={msg.id} className={`${styles.msgGroup} ${isMine ? styles.msgGroupMine : styles.msgGroupTheirs}`}>
          <div className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`}>
            {/* Avatar shown on last message in a group for theirs */}
            {!isMine && (
              <div style={{ width: 26, flexShrink: 0 }}>
                {isLast && sender && <Avatar user={sender} size={26} />}
              </div>
            )}

            <div>
              <div
                className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${isFirst ? (isMine ? styles.bubbleFirst : styles.bubbleFirst) : ''}`}
              >
                {msg.body}
              </div>
              {isLast && (
                <div className={styles.msgMeta} style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <span className={styles.msgTime}>{format(msgDate, 'HH:mm')}</span>
                  {isMine && <Tick msg={msg} partnerId={activePartnerId!} />}
                </div>
              )}
            </div>

            {isMine && (
              <button
                className={styles.deleteBtn}
                title="Delete message"
                onClick={() => deleteMutation.mutate(msg.id)}
              >
                ✕
              </button>
            )}
          </div>
        </div>,
      );
    });

    return nodes;
  }

  if (!user) return null;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Messages</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>Direct messages with your teammates</p>
      </div>

      <div className={styles.shell}>
        {/* ── Conversation list ─── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <p className={styles.sidebarTitle}>Conversations</p>
            <button className={styles.newBtn} onClick={() => setShowPicker(true)}>
              <PlusIcon /> New
            </button>
          </div>

          <div className={styles.convList}>
            {convLoading && <span className={styles.spinner} style={{ margin: '24px auto', display: 'block' }} />}
            {!convLoading && conversations.length === 0 && (
              <p className={styles.convEmpty}>
                No conversations yet.<br />Click <strong>New</strong> to start one.
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.partner.id}
                className={`${styles.convItem} ${activePartnerId === conv.partner.id ? styles.convItemActive : ''}`}
                onClick={() => handleSelectPartner(conv.partner.id)}
              >
                <Avatar user={conv.partner} size={38} />
                <div className={styles.convInfo}>
                  <p className={styles.convName}>{conv.partner.fullName}</p>
                  <p className={styles.convLast}>
                    {conv.lastMessage.senderId === user.id ? 'You: ' : ''}
                    {conv.lastMessage.body}
                  </p>
                </div>
                <div className={styles.convMeta}>
                  <span className={styles.convTime}>
                    {format(new Date(conv.lastMessage.createdAt), isToday(new Date(conv.lastMessage.createdAt)) ? 'HH:mm' : 'MMM d')}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className={styles.convUnread}>{conv.unreadCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Chat area ─── */}
        <div className={styles.chatArea}>
          {!activePartnerId ? (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon}>💬</span>
              <span className={styles.placeholderText}>Select a conversation or start a new one</span>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className={styles.chatHeader}>
                {activePartner && <Avatar user={activePartner} size={34} />}
                <div>
                  <p className={styles.chatHeaderName}>{activePartner?.fullName ?? '…'}</p>
                  <p className={styles.chatHeaderEmail}>{activePartner?.email ?? ''}</p>
                </div>
              </div>

              {/* Messages */}
              <div className={styles.messages}>
                {renderMessages()}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div className={styles.compose}>
                <textarea
                  ref={textareaRef}
                  className={styles.composeInput}
                  placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={!draft.trim() || sendMutation.isPending}
                  title="Send"
                >
                  <SendIcon />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showPicker && (
        <NewConvPicker
          currentUserId={user.id}
          onSelect={handlePickUser}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 8l12-6-6 12V9L2 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" />
    </svg>
  );
}
