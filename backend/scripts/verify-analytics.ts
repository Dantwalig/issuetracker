/**
 * Throwaway verification for the analytics pure functions (Sprint A, Tasks 1-3).
 * Run from backend/:  npx ts-node scripts/verify-analytics.ts
 * No database access — fixture data only. Exits non-zero on any failed check.
 */
import {
  buildVelocitySeries,
  buildBurndownSeries,
  buildWorkloadReport,
  completionTime,
  SprintLike,
  IssueLike,
} from '../src/analytics/analytics.service';

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  PASS  ${label}`);
  else {
    failures++;
    console.error(`  FAIL  ${label}`);
  }
}

const d = (s: string) => new Date(s);

// ── completionTime fallback ──────────────────────────────────────────────────
{
  console.log('\ncompletionTime');
  const withStamp: IssueLike = {
    id: 'i1', status: 'DONE', storyPoints: 5,
    completedAt: d('2026-01-10T10:00:00Z'), updatedAt: d('2026-01-12T10:00:00Z'),
  };
  const noStamp: IssueLike = {
    id: 'i2', status: 'DONE', storyPoints: 3,
    completedAt: null, updatedAt: d('2026-01-12T10:00:00Z'),
  };
  const todo: IssueLike = {
    id: 'i3', status: 'TODO', storyPoints: 2,
    completedAt: null, updatedAt: d('2026-01-12T10:00:00Z'),
  };
  assert(completionTime(withStamp)!.toISOString() === '2026-01-10T10:00:00.000Z', 'completedAt preferred');
  assert(completionTime(noStamp)!.toISOString() === '2026-01-12T10:00:00.000Z', 'falls back to updatedAt');
  assert(completionTime(todo) === null, 'non-DONE returns null');
}

// ── velocity ─────────────────────────────────────────────────────────────────
{
  console.log('\nvelocity');
  const mk = (id: string, name: string, end: string, completed: string, issues: IssueLike[]): SprintLike => ({
    id, name, status: 'COMPLETED',
    startDate: d('2026-01-05T00:00:00Z'), endDate: d(end), completedAt: d(completed),
    createdAt: d('2026-01-01T00:00:00Z'), updatedAt: d(completed), issues,
  });
  const s1 = mk('s1', 'Sprint 1', '2026-01-16T00:00:00Z', '2026-01-16T18:00:00Z', [
    { id: 'a', status: 'DONE', storyPoints: 5, completedAt: d('2026-01-10T10:00:00Z'), updatedAt: d('2026-01-10T10:00:00Z') },
    { id: 'b', status: 'DONE', storyPoints: 3, completedAt: d('2026-01-15T10:00:00Z'), updatedAt: d('2026-01-15T10:00:00Z') },
    { id: 'c', status: 'TODO', storyPoints: 2, completedAt: null, updatedAt: d('2026-01-10T10:00:00Z') },
  ]);
  const s2 = mk('s2', 'Sprint 2', '2026-01-30T00:00:00Z', '2026-01-30T18:00:00Z', [
    { id: 'x', status: 'DONE', storyPoints: 3, completedAt: d('2026-01-25T10:00:00Z'), updatedAt: d('2026-01-25T10:00:00Z') },
    // done AFTER the sprint ended → delivered but not counted in-sprint
    { id: 'y', status: 'DONE', storyPoints: 2, completedAt: d('2026-02-01T10:00:00Z'), updatedAt: d('2026-02-01T10:00:00Z') },
    { id: 'z', status: 'TODO', storyPoints: 3, completedAt: null, updatedAt: d('2026-01-25T10:00:00Z') },
  ]);
  const s3 = mk('s3', 'Sprint 3', '2026-02-13T00:00:00Z', '2026-02-13T18:00:00Z', [
    { id: 'p', status: 'DONE', storyPoints: 6, completedAt: d('2026-02-10T10:00:00Z'), updatedAt: d('2026-02-10T10:00:00Z') },
  ]);

  const v = buildVelocitySeries([s1, s2, s3]);
  const byName = Object.fromEntries(v.sprints.map((r) => [r.name, r]));
  assert(byName['Sprint 1'].plannedSP === 10, 'Sprint 1 planned = 10');
  assert(byName['Sprint 1'].deliveredSP === 8, 'Sprint 1 delivered = 8');
  assert(byName['Sprint 1'].completedInSprintSP === 8, 'Sprint 1 in-sprint = 8');
  assert(byName['Sprint 2'].completedInSprintSP === 3, 'Sprint 2 in-sprint excludes post-end completion');
  assert(byName['Sprint 2'].deliveredSP === 5, 'Sprint 2 delivered = 5');
  assert(v.averageVelocity === 6, `average of last 3 = 6 (got ${v.averageVelocity})`);
  assert(v.sprints.length === 3, 'three sprint rows');
}

// ── burndown ─────────────────────────────────────────────────────────────────
{
  console.log('\nburndown');
  const sprint: SprintLike = {
    id: 's1', name: 'Active', status: 'ACTIVE',
    startDate: d('2026-01-05T00:00:00Z'), endDate: d('2026-01-09T00:00:00Z'),
    completedAt: d('2026-01-09T18:00:00Z'),
    createdAt: d('2026-01-01T00:00:00Z'), updatedAt: d('2026-01-09T18:00:00Z'),
    issues: [
      { id: 'a', status: 'DONE', storyPoints: 5, completedAt: d('2026-01-06T10:00:00Z'), updatedAt: d('2026-01-06T10:00:00Z') },
      { id: 'b', status: 'DONE', storyPoints: 3, completedAt: d('2026-01-08T10:00:00Z'), updatedAt: d('2026-01-08T10:00:00Z') },
      { id: 'c', status: 'TODO', storyPoints: 2, completedAt: null, updatedAt: d('2026-01-08T10:00:00Z') },
    ],
  };
  const b = buildBurndownSeries(sprint, d('2026-01-09T23:00:00Z'));
  assert(b.plannedSP === 10, 'planned = 10');
  assert(b.completedSP === 8, 'completed = 8');
  assert(b.series.length === 5, `5 daily points (got ${b.series.length})`);
  assert(b.series[0].remainingSP === 10 && b.series[0].idealSP === 10, 'day 1: all remaining');
  assert(b.series[2].remainingSP === 5, `day 3: remaining 5 (got ${b.series[2].remainingSP})`);
  assert(b.series[4].remainingSP === 2, `last day: remaining 2 (got ${b.series[4].remainingSP})`);
  assert(b.series[4].idealSP === 0, 'ideal reaches 0 at end');
  assert(b.series[2].idealSP === 5, `ideal midpoint 5 (got ${b.series[2].idealSP})`);

  // Degenerate: no dates → single point, no crash
  const bare: SprintLike = {
    id: 's2', name: 'Bare', status: 'ACTIVE',
    startDate: null, endDate: null, completedAt: null,
    createdAt: d('2026-01-05T00:00:00Z'), updatedAt: d('2026-01-05T00:00:00Z'),
    issues: [{ id: 'z', status: 'TODO', storyPoints: 4, completedAt: null, updatedAt: d('2026-01-05T00:00:00Z') }],
  };
  const b2 = buildBurndownSeries(bare, d('2026-01-05T12:00:00Z'));
  assert(b2.series.length === 1 && b2.series[0].remainingSP === 4, 'degenerate window: single point');
}

// ── workload ─────────────────────────────────────────────────────────────────
{
  console.log('\nworkload');
  const members = [
    { userId: 'u1', fullName: 'Alice' },
    { userId: 'u2', fullName: 'Bob' },
  ];
  const active = [
    { id: 'a', status: 'IN_PROGRESS', storyPoints: 5, assigneeId: 'u1', deadline: d('2026-01-01T00:00:00Z'), completedAt: null, updatedAt: d('2026-01-05T00:00:00Z') },
    { id: 'b', status: 'TODO', storyPoints: 7, assigneeId: 'u1', deadline: null, completedAt: null, updatedAt: d('2026-01-05T00:00:00Z') },
    { id: 'c', status: 'DONE', storyPoints: 3, assigneeId: 'u2', deadline: null, completedAt: d('2026-01-05T00:00:00Z'), updatedAt: d('2026-01-05T00:00:00Z') },
    { id: 'd', status: 'TODO', storyPoints: 2, assigneeId: null, deadline: null, completedAt: null, updatedAt: d('2026-01-05T00:00:00Z') },
  ];
  const backlog = [
    { id: 'e', status: 'TODO', storyPoints: 8, updatedAt: d('2026-01-05T00:00:00Z') },
  ];
  const w = buildWorkloadReport(members, active as any, backlog as any, 10);
  const alice = w.members.find((m) => m.fullName === 'Alice')!;
  assert(alice.activeSprintSP === 12, 'Alice has 12 SP');
  assert(alice.utilization === 1.2, `Alice utilization 1.2 (got ${alice.utilization})`);
  assert(alice.overdue === 1, 'Alice has 1 overdue');
  assert(alice.openIssues === 2, 'Alice has 2 open');
  assert(w.unassigned.count === 1 && w.unassigned.sp === 2, 'unassigned bucket correct');
  assert(w.backlogSP === 8 && w.backlogCount === 1, 'backlog totals correct');
  assert(w.members[0].fullName === 'Alice', 'rows sorted by SP desc');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
