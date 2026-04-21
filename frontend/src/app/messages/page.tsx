'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { usersApi } from '@/lib/users-api';
import {
  messagesApi, groupsApi,
  DirectMessage, DMUser,
  GroupChat, GroupMessage, GroupMember, GroupInviteRequest,
} from '@/lib/messages-api';
import { format, isToday, isYesterday, isSameDay, differenceInMinutes } from 'date-fns';
import { useShortcut } from '@/lib/keyboard-shortcuts';
import styles from './page.module.css';

function initials(name: string) {
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ user, size = 38 }: { user: DMUser; size?: number }) {
  return (
    <div style={{
      width: size, height: size, minWidth: size,
      borderRadius: '50%', background: 'var(--bg-3)',
      border: '1px solid var(--border)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size < 32 ? 10 : 14, fontWeight: 600,
      color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden',
    }}>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt={user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(user.fullName)}
    </div>
  );
}

function GroupAvatar({ members, size = 38 }: { members: GroupMember[]; size?: number }) {
  const visible = members.slice(0, 2);
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      {visible.map((m, i) => (
        <div key={m.id} style={{
          position: 'absolute',
          width: size * 0.65, height: size * 0.65,
          borderRadius: '50%', background: 'var(--bg-3)',
          border: '2px solid var(--bg-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.2, fontWeight: 600, color: 'var(--text-2)',
          overflow: 'hidden',
          top: i === 0 ? 0 : 'auto', bottom: i === 1 ? 0 : 'auto',
          left: i === 0 ? 0 : 'auto', right: i === 1 ? 0 : 'auto',
          zIndex: i,
        }}>
          {m.user.avatarUrl
            ? <img src={m.user.avatarUrl} alt={m.user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(m.user.fullName)}
        </div>
      ))}
    </div>
  );
}

function dateSepLabel(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function roleBadge(role?: string) {
  const map: Record<string, string> = { SUPERADMIN: 'SA', ADMIN: 'A', TEAM_LEAD: 'TL' };
  if (!role || !map[role]) return null;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'var(--accent-dim)', color: 'var(--accent)', marginLeft: 4 }}>
      {map[role]}
    </span>
  );
}

// ── New Conversation Picker ───────────────────────────────────────────────────

function NewConvPicker({ currentUserId, onSelectDM, onCreateGroup, onClose }: {
  currentUserId: string;
  onSelectDM: (user: DMUser) => void;
  onCreateGroup: (name: string, members: DMUser[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DMUser[]>([]);
  const [groupName, setGroupName] = useState('');
  const [showGroupName, setShowGroupName] = useState(false);
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const filtered = users.filter((u) =>
    u.id !== currentUserId && u.isActive &&
    !selected.find((s) => s.id === u.id) &&
    (u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  function toggleSelect(u: any) {
    setSelected((prev) => prev.find((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u as DMUser]);
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.picker}>
        <div className={styles.pickerHeader}>
          <p className={styles.pickerTitle}>{showGroupName ? 'Name your group' : 'New conversation'}</p>
          <button className={styles.pickerClose} onClick={onClose}>×</button>
        </div>
        {showGroupName ? (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              Group with: {selected.map((s) => s.fullName).join(', ')}
            </p>
            <input
              className={styles.pickerSearch} style={{ margin: 0, width: '100%' }}
              placeholder="Group name…" value={groupName}
              onChange={(e) => setGroupName(e.target.value)} autoFocus
              onKeyDown={(e) => e.key === 'Enter' && groupName.trim() && onCreateGroup(groupName.trim(), selected)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowGroupName(false)} style={{ padding: '7px 14px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>Back</button>
              <button onClick={() => groupName.trim() && onCreateGroup(groupName.trim(), selected)} disabled={!groupName.trim()} style={{ padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: 13, opacity: groupName.trim() ? 1 : 0.4 }}>Create Group</button>
            </div>
          </div>
        ) : (
          <>
            {selected.length > 0 && (
              <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid var(--border)' }}>
                {selected.map((u) => (
                  <span key={u.id} onClick={() => toggleSelect(u)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 99, fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
                    {u.fullName} ×
                  </span>
                ))}
              </div>
            )}
            <input className={styles.pickerSearch} placeholder={selected.length > 0 ? 'Add more people…' : 'Search by name or email…'} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            <div className={styles.pickerList}>
              {filtered.length === 0 && <p className={styles.pickerEmpty}>No users found</p>}
              {filtered.map((u) => (
                <div key={u.id} className={styles.pickerItem} onClick={() => toggleSelect(u)}>
                  <div className={styles.pickerAvatar}>
                    {(u as any).avatarUrl ? <img src={(u as any).avatarUrl} alt={u.fullName} className={styles.pickerAvatarImg} /> : initials(u.fullName)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className={styles.pickerName}>{u.fullName}{roleBadge((u as any).role)}</p>
                    <p className={styles.pickerEmail}>{u.email}</p>
                  </div>
                  {selected.find((s) => s.id === u.id) && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </div>
              ))}
            </div>
            {selected.length > 0 && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => selected.length === 1 ? onSelectDM(selected[0]) : setShowGroupName(true)} style={{ width: '100%', padding: '9px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {selected.length === 1 ? `Message ${selected[0].fullName}` : `Start group with ${selected.length} people`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Add Member Modal ──────────────────────────────────────────────────────────

function AddMemberModal({ group, currentUserId, onClose, onRequest }: {
  group: GroupChat; currentUserId: string;
  onClose: () => void; onRequest: (inviteeId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DMUser | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const memberIds = new Set(group.members.map((m) => m.userId));
  const filtered = users.filter((u) => !memberIds.has(u.id) && u.isActive && (u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())));
  const otherMembers = group.members.filter((m) => m.userId !== currentUserId);

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.picker}>
        <div className={styles.pickerHeader}>
          <p className={styles.pickerTitle}>Add member to group</p>
          <button className={styles.pickerClose} onClick={onClose}>×</button>
        </div>
        {showConfirm && selected ? (
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 6px' }}>⚠️ Everyone must agree</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                Adding <strong>{selected.fullName}</strong> requires approval from all {otherMembers.length} other member{otherMembers.length !== 1 ? 's' : ''}.
                Once added, they will see <strong>all previous messages</strong>. To keep history private, create a new group instead.
              </p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
              Approval needed from: {otherMembers.map((m) => m.user.fullName).join(', ')}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: '8px 16px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button
                onClick={() => { onRequest(selected.id); onClose(); }}
                title="Send approval request to the rest of the people in this conversation?"
                style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >Send Request</button>
            </div>
          </div>
        ) : (
          <>
            <input className={styles.pickerSearch} placeholder="Search for someone to add…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            <div className={styles.pickerList}>
              {filtered.length === 0 && <p className={styles.pickerEmpty}>No eligible users found</p>}
              {filtered.map((u) => (
                <div key={u.id} className={styles.pickerItem} style={{ background: selected?.id === u.id ? 'var(--accent-dim)' : undefined }} onClick={() => setSelected(u as unknown as DMUser)}>
                  <div className={styles.pickerAvatar}>
                    {(u as any).avatarUrl ? <img src={(u as any).avatarUrl} alt={u.fullName} className={styles.pickerAvatarImg} /> : initials(u.fullName)}
                  </div>
                  <div>
                    <p className={styles.pickerName}>{u.fullName}{roleBadge((u as any).role)}</p>
                    <p className={styles.pickerEmail}>{u.email}</p>
                  </div>
                  {selected?.id === u.id && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </div>
              ))}
            </div>
            {selected && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setShowConfirm(true)} style={{ width: '100%', padding: '9px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Add {selected.fullName} →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Pending invite banner ─────────────────────────────────────────────────────

function PendingInviteBanner({ request, currentUserId, onRespond, onCancel }: {
  request: GroupInviteRequest; currentUserId: string;
  onRespond: (requestId: string, decision: 'approve' | 'reject', reason?: string) => void;
  onCancel: (requestId: string) => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const myApproval = request.approvals.find((a) => a.member?.user?.id === currentUserId);
  const isInitiator = request.initiatorId === currentUserId;
  const alreadyResponded = myApproval?.status !== 'PENDING';

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 8, flexShrink: 0 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px' }}>
        📨 Add request: <strong>{request.invitee.fullName}</strong>
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 8px' }}>
        By {request.initiator.fullName} · {request.approvals.filter((a) => a.status === 'APPROVED').length}/{request.approvals.length} approved
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {request.approvals.map((a) => (
          <span key={a.id} style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 99,
            background: a.status === 'APPROVED' ? 'rgba(22,163,74,0.1)' : a.status === 'REJECTED' ? 'var(--red-dim)' : 'var(--bg-3)',
            color: a.status === 'APPROVED' ? 'rgb(22,163,74)' : a.status === 'REJECTED' ? 'var(--red)' : 'var(--text-3)',
          }}>
            {a.member?.user?.fullName ?? '…'} {a.status === 'APPROVED' ? '✓' : a.status === 'REJECTED' ? '✕' : '…'}
            {a.reason ? ` — "${a.reason}"` : ''}
          </span>
        ))}
      </div>
      {isInitiator ? (
        <button onClick={() => onCancel(request.id)} style={{ fontSize: 12, padding: '5px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel request</button>
      ) : !alreadyResponded ? (
        showRejectBox ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input placeholder="Reason for rejection (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus style={{ padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-1)', fontSize: 12, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowRejectBox(false)} style={{ fontSize: 12, padding: '5px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', cursor: 'pointer' }}>Back</button>
              <button onClick={() => onRespond(request.id, 'reject', rejectReason)} style={{ fontSize: 12, padding: '5px 10px', background: 'var(--red)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>Confirm Reject</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onRespond(request.id, 'approve')} style={{ fontSize: 12, padding: '5px 10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>Approve</button>
            <button onClick={() => setShowRejectBox(true)} style={{ fontSize: 12, padding: '5px 10px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: 'var(--red)', cursor: 'pointer' }}>Reject</button>
          </div>
        )
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>You {myApproval?.status === 'APPROVED' ? 'approved ✓' : 'rejected ✕'}{myApproval?.reason ? ` — "${myApproval.reason}"` : ''}</span>
      )}
    </div>
  );
}

// ── Edit inline ───────────────────────────────────────────────────────────────

function EditBox({ body, onSave, onCancel }: { body: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(body);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <textarea value={val} onChange={(e) => setVal(e.target.value)} autoFocus style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--text-1)', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, minWidth: 160 }} rows={2}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(val.trim()); } if (e.key === 'Escape') onCancel(); }} />
      <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
        <button onClick={() => onSave(val.trim())} style={{ padding: '3px 8px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Save</button>
        <button onClick={onCancel} style={{ padding: '3px 8px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ id, body, isMine, isFirst, isLast, time, editedAt, senderName, senderUser, showTick, isRead, canEdit, isEditing, onEdit, onEditSave, onEditCancel, onDelete }: {
  id: string; body: string; isMine: boolean; isFirst: boolean; isLast: boolean; time: string; editedAt?: string | null;
  senderName: string | null; senderUser: DMUser | null; showTick: boolean; isRead: boolean; canEdit: boolean;
  isEditing: boolean; onEdit: () => void; onEditSave: (v: string) => void; onEditCancel: () => void; onDelete: () => void;
}) {
  return (
    <div className={`${styles.msgGroup} ${isMine ? styles.msgGroupMine : styles.msgGroupTheirs}`}>
      {!isMine && isFirst && senderName && (
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 32, marginBottom: 2 }}>{senderName}</span>
      )}
      <div className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`} style={{ position: 'relative' }}>
        {!isMine && <div style={{ width: 26, flexShrink: 0 }}>{isLast && senderUser && <Avatar user={senderUser} size={26} />}</div>}
        <div>
          {isEditing
            ? <EditBox body={body} onSave={onEditSave} onCancel={onEditCancel} />
            : (
              <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${isFirst ? styles.bubbleFirst : ''}`}>
                {body}
                {editedAt && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>(edited)</span>}
              </div>
            )}
          {isLast && !isEditing && (
            <div className={styles.msgMeta} style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <span className={styles.msgTime}>{time}</span>
              {showTick && <span className={`${styles.msgTick} ${isRead ? styles.msgTickRead : ''}`}>{isRead ? '✓✓' : '✓'}</span>}
            </div>
          )}
        </div>
        {isMine && !isEditing && (
          <div className={styles.msgRowActions}>
            {canEdit && <button className={styles.deleteBtn} title="Edit message" onClick={onEdit} style={{ fontSize: 13 }}>✎</button>}
            <button className={styles.deleteBtn} title="Delete message" onClick={onDelete}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type ActiveChat = { kind: 'dm'; partnerId: string } | { kind: 'group'; groupId: string };

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dmPartnerId = activeChat?.kind === 'dm' ? activeChat.partnerId : null;
  const groupId = activeChat?.kind === 'group' ? activeChat.groupId : null;

  const { data: conversations = [], isLoading: convLoading } = useQuery({ queryKey: ['dm-conversations'], queryFn: messagesApi.listConversations, refetchInterval: 5000 });
  const { data: groups = [], isLoading: groupsLoading } = useQuery({ queryKey: ['group-chats'], queryFn: groupsApi.list, refetchInterval: 5000 });
  const { data: dmMessages = [] } = useQuery({ queryKey: ['dm-messages', dmPartnerId], queryFn: () => messagesApi.getConversation(dmPartnerId!), enabled: !!dmPartnerId, refetchInterval: 5000 });
  const { data: groupMessages = [] } = useQuery({ queryKey: ['group-messages', groupId], queryFn: () => groupsApi.getMessages(groupId!), enabled: !!groupId, refetchInterval: 5000 });
  const { data: pendingInvites = [] } = useQuery({ queryKey: ['group-invites', groupId], queryFn: () => groupsApi.getPendingInvites(groupId!), enabled: !!groupId, refetchInterval: 8000 });

  const activePartner = dmPartnerId ? (conversations.find((c) => c.partner.id === dmPartnerId)?.partner ?? null) : null;
  const activeGroup = groupId ? (groups.find((g) => g.id === groupId) ?? null) : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [dmMessages, groupMessages]);
  useEffect(() => { if (dmPartnerId) qc.invalidateQueries({ queryKey: ['dm-conversations'] }); }, [dmMessages.length, dmPartnerId]);

  useShortcut('messages:new', { key: 'n', description: 'New conversation', group: 'Messages', action: () => setShowPicker(true), disabled: showPicker });
  useShortcut('messages:escape', { key: 'Escape', description: 'Close / deselect', group: 'Global', action: () => { if (showPicker) { setShowPicker(false); return; } setActiveChat(null); }, disabled: !showPicker && !activeChat });
  useShortcut('messages:focus', { key: 'r', description: 'Focus reply box', group: 'Messages', action: () => textareaRef.current?.focus(), disabled: !activeChat });

  const sendDM = useMutation({ mutationFn: (b: string) => messagesApi.send(dmPartnerId!, b), onSuccess: () => { qc.invalidateQueries({ queryKey: ['dm-messages', dmPartnerId] }); qc.invalidateQueries({ queryKey: ['dm-conversations'] }); setDraft(''); } });
  const sendGroup = useMutation({ mutationFn: (b: string) => groupsApi.sendMessage(groupId!, b), onSuccess: () => { qc.invalidateQueries({ queryKey: ['group-messages', groupId] }); qc.invalidateQueries({ queryKey: ['group-chats'] }); setDraft(''); } });
  const editDM = useMutation({ mutationFn: ({ id, body }: { id: string; body: string }) => messagesApi.edit(id, body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['dm-messages', dmPartnerId] }); setEditingId(null); } });
  const editGroup = useMutation({ mutationFn: ({ id, body }: { id: string; body: string }) => groupsApi.editMessage(id, body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['group-messages', groupId] }); setEditingId(null); } });
  const deleteDM = useMutation({ mutationFn: (id: string) => messagesApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['dm-messages', dmPartnerId] }); qc.invalidateQueries({ queryKey: ['dm-conversations'] }); } });
  const deleteGroup = useMutation({ mutationFn: (id: string) => groupsApi.deleteMessage(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['group-messages', groupId] }) });
  const createGroup = useMutation({ mutationFn: ({ name, memberIds }: { name: string; memberIds: string[] }) => groupsApi.create(name, memberIds), onSuccess: (g) => { qc.invalidateQueries({ queryKey: ['group-chats'] }); setActiveChat({ kind: 'group', groupId: g.id }); setShowPicker(false); } });
  const invite = useMutation({ mutationFn: (inviteeId: string) => groupsApi.requestInvite(groupId!, inviteeId), onSuccess: () => qc.invalidateQueries({ queryKey: ['group-invites', groupId] }) });
  const respondInvite = useMutation({ mutationFn: ({ requestId, decision, reason }: { requestId: string; decision: 'approve' | 'reject'; reason?: string }) => groupsApi.respondToInvite(requestId, decision, reason), onSuccess: () => { qc.invalidateQueries({ queryKey: ['group-invites', groupId] }); qc.invalidateQueries({ queryKey: ['group-chats'] }); } });
  const cancelInvite = useMutation({ mutationFn: (id: string) => groupsApi.cancelInvite(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['group-invites', groupId] }) });

  function handleSend() {
    const b = draft.trim();
    if (!b || !activeChat) return;
    if (activeChat.kind === 'dm') sendDM.mutate(b);
    else sendGroup.mutate(b);
  }

  function handleKD(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function renderMessages(msgs: any[], isDM: boolean) {
    if (msgs.length === 0) return (
      <div className={styles.empty}><span className={styles.emptyIcon}>💬</span><span>No messages yet. Say hello!</span></div>
    );
    const nodes: React.ReactNode[] = [];
    let lastDate: Date | null = null;
    let lastSender: string | null = null;
    msgs.forEach((msg, idx) => {
      const msgDate = new Date(msg.createdAt);
      const isMine = msg.senderId === user?.id;
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        nodes.push(<div key={`sep-${msg.id}`} className={styles.dateSep}>{dateSepLabel(msgDate)}</div>);
        lastDate = msgDate; lastSender = null;
      }
      const isFirst = lastSender !== msg.senderId;
      lastSender = msg.senderId;
      const isLast = idx === msgs.length - 1 || msgs[idx + 1].senderId !== msg.senderId;
      const canEdit = isMine && differenceInMinutes(new Date(), msgDate) < 15;
      const senderUser = !isMine ? (isDM ? activePartner : msg.sender) : null;
      nodes.push(
        <Bubble
          key={msg.id} id={msg.id} body={msg.body} isMine={isMine}
          isFirst={isFirst} isLast={isLast} time={format(msgDate, 'HH:mm')}
          editedAt={msg.editedAt}
          senderName={!isDM && !isMine && isFirst ? msg.sender.fullName : null}
          senderUser={senderUser} showTick={isDM && isMine} isRead={isDM ? (msg as DirectMessage).isRead : false}
          canEdit={canEdit} isEditing={editingId === msg.id}
          onEdit={() => setEditingId(msg.id)}
          onEditSave={(body) => isDM ? editDM.mutate({ id: msg.id, body }) : editGroup.mutate({ id: msg.id, body })}
          onEditCancel={() => setEditingId(null)}
          onDelete={() => isDM ? deleteDM.mutate(msg.id) : deleteGroup.mutate(msg.id)}
        />
      );
    });
    return nodes;
  }

  if (!user) return null;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Messages</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', margin: 0 }}>Direct messages and group chats with your teammates</p>
      </div>

      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <p className={styles.sidebarTitle}>Conversations</p>
            <button className={styles.newBtn} onClick={() => setShowPicker(true)}><PlusIcon /> New</button>
          </div>
          <div className={styles.convList}>
            {(convLoading || groupsLoading) && <span className={styles.spinner} style={{ margin: '24px auto', display: 'block' }} />}

            {/* Groups first */}
            {groups.map((g) => {
              const lastMsg = g.messages[0];
              const isActive = activeChat?.kind === 'group' && activeChat.groupId === g.id;
              return (
                <div key={g.id} className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`} onClick={() => setActiveChat({ kind: 'group', groupId: g.id })}>
                  <GroupAvatar members={g.members.filter((m) => m.userId !== user.id)} size={38} />
                  <div className={styles.convInfo}>
                    <p className={styles.convName}>{g.name} <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 4, fontWeight: 400 }}>{g.members.length}</span></p>
                    <p className={styles.convLast}>{lastMsg ? `${lastMsg.sender.id === user.id ? 'You' : lastMsg.sender.fullName}: ${lastMsg.body}` : 'No messages yet'}</p>
                  </div>
                  {lastMsg && <div className={styles.convMeta}><span className={styles.convTime}>{format(new Date(lastMsg.createdAt), isToday(new Date(lastMsg.createdAt)) ? 'HH:mm' : 'MMM d')}</span></div>}
                </div>
              );
            })}

            {/* DMs */}
            {conversations.map((conv) => {
              const isActive = activeChat?.kind === 'dm' && activeChat.partnerId === conv.partner.id;
              return (
                <div key={conv.partner.id} className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`} onClick={() => setActiveChat({ kind: 'dm', partnerId: conv.partner.id })}>
                  <Avatar user={conv.partner} size={38} />
                  <div className={styles.convInfo}>
                    <p className={styles.convName}>{conv.partner.fullName}</p>
                    <p className={styles.convLast}>{conv.lastMessage.senderId === user.id ? 'You: ' : ''}{conv.lastMessage.body}</p>
                  </div>
                  <div className={styles.convMeta}>
                    <span className={styles.convTime}>{format(new Date(conv.lastMessage.createdAt), isToday(new Date(conv.lastMessage.createdAt)) ? 'HH:mm' : 'MMM d')}</span>
                    {conv.unreadCount > 0 && <span className={styles.convUnread}>{conv.unreadCount}</span>}
                  </div>
                </div>
              );
            })}

            {!convLoading && !groupsLoading && conversations.length === 0 && groups.length === 0 && (
              <p className={styles.convEmpty}>No conversations yet.<br />Click <strong>New</strong> to start one.</p>
            )}
          </div>
        </aside>

        <div className={styles.chatArea}>
          {!activeChat ? (
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon}>💬</span>
              <span className={styles.placeholderText}>Select a conversation or start a new one</span>
            </div>
          ) : activeChat.kind === 'dm' ? (
            <>
              <div className={styles.chatHeader}>
                {activePartner && <Avatar user={activePartner} size={34} />}
                <div>
                  <p className={styles.chatHeaderName}>{activePartner?.fullName ?? '…'}</p>
                  <p className={styles.chatHeaderEmail}>{activePartner?.email ?? ''}</p>
                </div>
              </div>
              <div className={styles.messages}>{renderMessages(dmMessages, true)}<div ref={bottomRef} /></div>
              <div className={styles.compose}>
                <textarea ref={textareaRef} className={styles.composeInput} placeholder="Write a message… (Enter to send, Shift+Enter for new line)" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKD} rows={1} />
                <button className={styles.sendBtn} onClick={handleSend} disabled={!draft.trim() || sendDM.isPending} title="Send"><SendIcon /></button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.chatHeader}>
                {activeGroup && <GroupAvatar members={activeGroup.members.filter((m) => m.userId !== user.id)} size={34} />}
                <div style={{ flex: 1 }}>
                  <p className={styles.chatHeaderName}>{activeGroup?.name ?? '…'}</p>
                  <p className={styles.chatHeaderEmail} style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {activeGroup?.members.map((m) => (
                      <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {m.user.fullName}
                        {m.role === 'ADMIN' && <span style={{ fontSize: 9, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '0 3px', borderRadius: 3, fontWeight: 700 }}>Admin</span>}
                        {m !== activeGroup.members[activeGroup.members.length - 1] && ','}
                      </span>
                    ))}
                  </p>
                </div>
                {/* Member avatars + add button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {activeGroup?.members.slice(0, 5).map((m, i) => (
                      <div key={m.id} title={`${m.user.fullName}${m.role === 'ADMIN' ? ' (Admin)' : ''}`} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-3)', border: `2px solid ${m.role === 'ADMIN' ? 'var(--accent)' : 'var(--bg-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', marginLeft: i > 0 ? -8 : 0, zIndex: i }}>
                        {m.user.avatarUrl ? <img src={m.user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(m.user.fullName)}
                      </div>
                    ))}
                    {activeGroup && activeGroup.members.length > 5 && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>+{activeGroup.members.length - 5}</span>}
                  </div>
                  <button
                    onClick={() => setShowAddMember(true)}
                    title="Add a member to this group"
                    className={styles.addMemberBtn}
                  >+</button>
                </div>
              </div>
              <div className={styles.messages}>
                {pendingInvites.map((req) => (
                  <PendingInviteBanner key={req.id} request={req} currentUserId={user.id}
                    onRespond={(requestId, decision, reason) => respondInvite.mutate({ requestId, decision, reason })}
                    onCancel={(id) => cancelInvite.mutate(id)}
                  />
                ))}
                {renderMessages(groupMessages, false)}
                <div ref={bottomRef} />
              </div>
              <div className={styles.compose}>
                <textarea ref={textareaRef} className={styles.composeInput} placeholder="Write a message… (Enter to send, Shift+Enter for new line)" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKD} rows={1} />
                <button className={styles.sendBtn} onClick={handleSend} disabled={!draft.trim() || sendGroup.isPending} title="Send"><SendIcon /></button>
              </div>
            </>
          )}
        </div>
      </div>

      {showPicker && (
        <NewConvPicker
          currentUserId={user.id}
          onSelectDM={(u) => { setActiveChat({ kind: 'dm', partnerId: u.id }); setShowPicker(false); if (!conversations.find((c) => c.partner.id === u.id)) qc.setQueryData(['dm-messages', u.id], []); }}
          onCreateGroup={(name, members) => createGroup.mutate({ name, memberIds: members.map((m) => m.id) })}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showAddMember && activeGroup && (
        <AddMemberModal
          group={activeGroup} currentUserId={user.id}
          onClose={() => setShowAddMember(false)}
          onRequest={(inviteeId) => invite.mutate(inviteeId)}
        />
      )}
    </>
  );
}

function PlusIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function SendIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l12-6-6 12V9L2 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" /></svg>;
}
