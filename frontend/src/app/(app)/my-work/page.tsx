'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { myWorkApi, MyWorkActivity, MyWorkSprint } from '@/lib/my-work-api';
import { useAuth } from '@/lib/auth-context';
import { Issue, IssueStatus, IssuePriority, IssueType } from '@/types';
import { formatDistanceToNow, format, isPast, differenceInDays } from 'date-fns';
import styles from './page.module.css';

// ── Tiny icon helpers ──────────────────────────────────────────────────────
function PriorityDot({ p }: { p: IssuePriority }) {
  const color = p === 'HIGH' ? 'var(--red)' : p === 'MEDIUM' ? 'var(--yellow)' : 'var(--text-3)';
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

function TypeBadge({ t }: { t: IssueType }) {
  const map: Record<IssueType, string> = { TASK: '📋', BUG: '🐛', STORY: '📖' };
  return <span className={styles.typeBadge}>{map[t]}</span>;
}

function StatusPill({ status, onChange }: { status: IssueStatus; onChange?: (s: IssueStatus) => void }) {
  const cfg: Record<IssueStatus, { label: string; cls: string }> = {
    TODO:        { label: 'Todo',        cls: styles.sTodo },
    IN_PROGRESS: { label: 'In Progress', cls: styles.sInProgress },
    DONE:        { label: 'Done',        cls: styles.sDone },
  };
  const { label, cls } = cfg[status];
  if (!onChange) return <span className={`${styles.statusPill} ${cls}`}>{label}</span>;
  return (
    <select
      className={`${styles.statusPill} ${styles.statusSelect} ${cls}`}
      value={status}
      onChange={(e) => onChange(e.target.value as IssueStatus)}
      onClick={(e) => e.stopPropagation()}
    >
      <option value="TODO">Todo</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="DONE">Done</option>
    </select>
  );
}

function SprintProgress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={styles.sprintBar}>
      <div className={styles.sprintBarFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SectionHeader({ title, count, icon }: { title: string; count?: number; icon: React.ReactNode }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionIcon}>{icon}</span>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {count !== undefined && <span className={styles.sectionCount}>{count}</span>}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p className={styles.empty}>{msg}</p>;
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ value, label, accent, href }: { value: number; label: string; accent?: string; href?: string }) {
  const inner = (
    <div className={styles.statCard} style={accent ? { borderColor: accent } : {}}>
      <span className={styles.statValue} style={accent ? { color: accent } : {}}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Issue row ──────────────────────────────────────────────────────────────
function IssueRow({
  issue,
  onStatusChange,
  urgent,
}: {
  issue: Issue;
  onStatusChange: (id: string, projectId: string, status: IssueStatus) => void;
  urgent?: boolean;
}) {
  const isOverdue = issue.deadline && isPast(new Date(issue.deadline)) && issue.status !== 'DONE';
  const daysLeft = issue.deadline ? differenceInDays(new Date(issue.deadline), new Date()) : null;

  return (
    <div className={`${styles.issueRow} ${urgent ? styles.urgentRow : ''}`}>
      <PriorityDot p={issue.priority} />
      <TypeBadge t={issue.type} />
      <Link
        href={`/projects/${issue.projectId}/issues/${issue.id}`}
        className={styles.issueTitle}
      >
        {issue.title}
      </Link>
      <span className={styles.issueProject}>{issue.project?.name}</span>
      {issue.deadline && (
        <span className={`${styles.deadline} ${isOverdue ? styles.deadlineOverdue : daysLeft !== null && daysLeft <= 2 ? styles.deadlineSoon : ''}`}>
          {isOverdue
            ? `${Math.abs(daysLeft ?? 0)}d overdue`
            : daysLeft === 0
            ? 'Due today'
            : `${daysLeft}d left`}
        </span>
      )}
      <StatusPill
        status={issue.status}
        onChange={(s) => onStatusChange(issue.id, issue.projectId, s)}
      />
      <Link
        href={`/projects/${issue.projectId}/issues/${issue.id}`}
        className={styles.openBtn}
        title="Open issue"
      >
        ↗
      </Link>
    </div>
  );
}

// ── Activity item ──────────────────────────────────────────────────────────
function ActivityRow({ item }: { item: MyWorkActivity }) {
  return (
    <div className={styles.activityRow}>
      <div className={styles.activityAvatar}>
        {item.user.avatarUrl
          ? <img src={item.user.avatarUrl} alt={item.user.fullName} />
          : item.user.fullName[0]?.toUpperCase()}
      </div>
      <div className={styles.activityBody}>
        <span className={styles.activityUser}>{item.user.fullName}</span>
        {' '}<span className={styles.activityAction}>{item.action.toLowerCase().replace(/_/g, ' ')}</span>
        {item.issue && (
          <>{' '}<Link href={`/projects/${item.issue.projectId}/issues/${item.issue.id}`} className={styles.activityIssue}>
            {item.issue.title}
          </Link></>
        )}
        {item.detail && <span className={styles.activityDetail}> · {item.detail}</span>}
      </div>
      <span className={styles.activityTime}>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
    </div>
  );
}

// ── Sprint card ────────────────────────────────────────────────────────────
function SprintCard({ sprint }: { sprint: MyWorkSprint }) {
  const pct = sprint.myIssueCount === 0 ? 0 : Math.round((sprint.myDoneCount / sprint.myIssueCount) * 100);
  return (
    <Link href={`/projects/${sprint.project.id}/sprints`} className={styles.sprintCard}>
      <div className={styles.sprintCardTop}>
        <span className={styles.sprintName}>{sprint.name}</span>
        <span className={styles.sprintProject}>{sprint.project.name}</span>
      </div>
      <div className={styles.sprintMeta}>
        <span>{sprint.myDoneCount}/{sprint.myIssueCount} my tasks done</span>
        <span>{pct}%</span>
      </div>
      <SprintProgress done={sprint.myDoneCount} total={sprint.myIssueCount} />
      {sprint.endDate && (
        <span className={styles.sprintEnd}>
          Ends {format(new Date(sprint.endDate), 'MMM d')}
        </span>
      )}
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function MyWorkPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<'assigned' | 'reported' | 'completed'>('assigned');

  const { data, isLoading } = useQuery({
    queryKey: ['my-work'],
    queryFn: myWorkApi.getDashboard,
    refetchInterval: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ projectId, issueId, status }: { projectId: string; issueId: string; status: IssueStatus }) =>
      myWorkApi.updateIssueStatus(projectId, issueId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-work'] }),
  });

  const handleStatusChange = (issueId: string, projectId: string, status: IssueStatus) => {
    statusMutation.mutate({ projectId, issueId, status });
  };

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <span className={styles.spinner} />
      </div>
    );
  }

  if (!data) return null;

  const { stats, assignedIssues, overdueIssues, reportedIssues, activeSprints, recentActivity, recentlyCompleted } = data;

  const issueList =
    section === 'assigned' ? assignedIssues :
    section === 'reported' ? reportedIssues :
    recentlyCompleted;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Work</h1>
          <p className={styles.sub}>Hi {user?.fullName?.split(' ')[0]} — here's everything on your plate</p>
        </div>
      </div>

      {/* Stat row */}
      <div className={styles.statsRow}>
        <StatCard value={stats.totalAssigned}    label="Open tasks"       />
        <StatCard value={stats.totalInProgress}  label="In progress"      accent="var(--accent)" />
        <StatCard value={stats.totalOverdue}     label="Overdue"          accent={stats.totalOverdue > 0 ? 'var(--red)' : undefined} />
        <StatCard value={stats.totalDoneThisWeek} label="Done this week"  accent="var(--green)" />
      </div>

      {/* Two-column layout */}
      <div className={styles.grid}>

        {/* LEFT: issues */}
        <div className={styles.left}>

          {/* Overdue banner */}
          {overdueIssues.length > 0 && (
            <div className={styles.overdueBanner}>
              <span className={styles.overdueIcon}>⚠</span>
              <span>You have <strong>{overdueIssues.length}</strong> overdue issue{overdueIssues.length > 1 ? 's' : ''} that need attention</span>
            </div>
          )}

          {/* Issue tabs */}
          <div className={styles.card}>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${section === 'assigned' ? styles.tabActive : ''}`} onClick={() => setSection('assigned')}>
                Assigned to me <span className={styles.tabCount}>{assignedIssues.length}</span>
              </button>
              <button className={`${styles.tab} ${section === 'reported' ? styles.tabActive : ''}`} onClick={() => setSection('reported')}>
                Reported by me <span className={styles.tabCount}>{reportedIssues.length}</span>
              </button>
              <button className={`${styles.tab} ${section === 'completed' ? styles.tabActive : ''}`} onClick={() => setSection('completed')}>
                Done this week <span className={styles.tabCount}>{recentlyCompleted.length}</span>
              </button>
            </div>

            <div className={styles.issueList}>
              {issueList.length === 0
                ? <EmptyState msg={
                    section === 'assigned'  ? 'No open issues assigned to you 🎉' :
                    section === 'reported'  ? 'You haven\'t reported any open issues' :
                    'Nothing completed this week yet'
                  } />
                : issueList.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    onStatusChange={handleStatusChange}
                    urgent={overdueIssues.some((o) => o.id === issue.id)}
                  />
                ))
              }
            </div>
          </div>

          {/* Active sprints */}
          {activeSprints.length > 0 && (
            <div className={styles.card}>
              <SectionHeader
                title="Active Sprints"
                count={activeSprints.length}
                icon={<SprintIcon />}
              />
              <div className={styles.sprintGrid}>
                {activeSprints.map((s) => <SprintCard key={s.id} sprint={s} />)}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: activity feed */}
        <div className={styles.right}>
          <div className={styles.card}>
            <SectionHeader title="Recent Activity" icon={<ActivityIcon />} />
            <div className={styles.activityList}>
              {recentActivity.length === 0
                ? <EmptyState msg="No recent activity" />
                : recentActivity.map((a) => <ActivityRow key={a.id} item={a} />)
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────
function SprintIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 8a6 6 0 1 1 2 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 12V8.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M1 8h2l2-5 3 9 2-6 1.5 3H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
