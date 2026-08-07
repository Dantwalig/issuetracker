# Sprint Plan: Trackr Analytics & Stability (Sprint A)

> Trackr (Issue & Sprint Management Platform) — Ubwenge Lab
> Frontend: Next.js 14 App Router + TanStack React Query + Axios (Vercel: https://trackr.ubwengelab.rw)
> Backend: NestJS + Prisma + Supabase PostgreSQL (Render: https://trackr-api-yync.onrender.com/api)
> Repo: `C:\Users\Richter Richard NAHO\TonyRobert98\issuetracker` — branch `ft-appReview`
> Sprint length: 2 weeks · Story point scale: 1, 2, 3, 5, 8, 13 (Fibonacci)
> Previous work: sprint lifecycle (backlog ↔ active ↔ complete), markdown rendering (react-markdown + remark-gfm/breaks), PNG share/export cards (html-to-image), Lighthouse ~98 desktop / ~850ms LCP, K6 load tests, Supabase pooler config (port 6543 / pgbouncer=true).

---

## Implementation status (updated this session)

| Task | Status | Notes |
|---|---|---|
| 1. Schema `completedAt` | **Reverted (working state)** | Added then reverted 2026-08-07: migration could not be applied (direct DB `P1001` unreachable from dev machine), so the schema/client were ahead of the DB and EVERY issue/sprint query 500'd. Reverted cleanly; analytics code keeps the `updatedAt` fallback and is migration-ready. Re-apply when direct DB access works |
| 2. Status-transition hook | **Reverted with Task 1** | Same root cause; re-add alongside the migration |
| 3. Analytics endpoints | **Done (updatedAt fallback)** | velocity/burndown/workload work pre-migration via `updatedAt`; will use `completedAt` automatically once the column exists |
| 4–5. Frontend UI | Pending | requires your visual verification workflow |
| 6. SP scale validation | **Done** | `STORY_POINT_SCALE` in issue.dto.ts (1,2,3,5,8,13) |
| 7. Load test | **Done** | load-test.js rewritten (auth flow, prod-runnable) |
| 8. N+1 audit | **Done** | All fan-out loops batched to `createMany` (deletion-requests, deadline cron, recycle-bin); conversations bounded `take: 200`. Build green + contract-verified |
| 9. Lighthouse gate | **Done** | `frontend/scripts/lighthouse-sequential.js` + `npm run lighthouse:ci` (login → 6 routes → score table, threshold gate). Dry-run verified; live run needs TEST_EMAIL/TEST_PASSWORD |

**Migration (run when you approve — do NOT deploy backend before this):**
```bash
cd backend
npx prisma migrate dev --name add_completed_at   # dev DB
# then apply to the shared DB through your normal release flow
```
Backfill (best-effort, read-only semantics; run once after migrate):
```sql
UPDATE issues SET "completedAt" = "updatedAt" WHERE status = 'DONE' AND "completedAt" IS NULL;
UPDATE sprints SET "completedAt" = "updatedAt" WHERE status = 'COMPLETED' AND "completedAt" IS NULL;
```
Analytics falls back to `updatedAt` until the backfill runs, so the API is safe to deploy either way.

---

## Goal

Turn Trackr from a *tracking* tool into a *planning* tool: give the tech lead and team leads real numbers for sprint velocity, workload allocation, and burndown, and harden the perf/stability baseline so those numbers come from a fast, reliable system.

## Why this sprint (grounding)

The current schema has everything needed to *run* sprints but nothing needed to *plan* them:

- `Issue` has `storyPoints`, `priority`, `deadline`, `status`, `sprintId` — but **no `completedAt`**. Velocity and burndown need *when* work finished. Today the only signal is `updatedAt`, which moves on any edit, so it is not trustworthy.
- `Sprint` has no `completedAt` / actual-end date. `completeSprint` (backend/src/sprints/sprints.service.ts:225) pushes unfinished issues back to the backlog but records no completion timestamp.
- No analytics endpoints exist (no velocity, no burndown series, no per-assignee workload).
- No chart library in `frontend/package.json` (checked: no recharts/chart.js).
- `backend/scripts/load-test.js` tested only 2 endpoints against localhost with no real auth flow.

**Baseline before starting:** run the read-only report script (below) to capture current sprint/backlog state and a first velocity approximation.

## How to review current sprint & backlog state (do this first)

From `backend/` (Node 22, reads only, never writes):

```bash
node --env-file=.env scripts/sprint-report.js
```

Prints per project: sprint status/dates, issue counts, story points per status, delivered SP for completed sprints (velocity baseline), and total backlog SP.

---

## 📋 Task 1: Schema foundation — `completedAt` timestamps

**Story Points:** ~5
**Role Target:** Backend (NestJS + Prisma)
**Assignee:** TBD

#### Description
Add `completedAt DateTime?` to `Issue` (when it entered DONE) and `completedAt DateTime?` to `Sprint` (when it was completed). This is the foundation for every analytics feature in this sprint.

#### Detailed Requirements
1. Edit `backend/prisma/schema.prisma`:
   - `Issue`: add `completedAt DateTime?` after `deadline`.
   - `Sprint`: add `completedAt DateTime?` after `endDate`.
2. Run `npx prisma migrate dev --name add_completed_at` (dev DB only — per schema rule, dev schema.prisma is source of truth; no `db pull`/`db push` on the shared DB).
3. Backfill `Issue.completedAt = updatedAt` where `status = 'DONE'` and `completedAt IS NULL` (best-effort approximation; document that historical values are approximate).
4. Backfill `Sprint.completedAt = updatedAt` where `status = 'COMPLETED'` and `completedAt IS NULL`.

#### Acceptance Criteria
- [ ] Migration file committed; `npx prisma migrate dev` runs clean on dev.
- [ ] `Issue.completedAt` set for all existing DONE issues (backfill query verified).
- [ ] `Sprint.completedAt` set for all existing COMPLETED sprints.
- [ ] `backend/scripts/sprint-report.js` still runs (schema-compatible).

## 📋 Task 2: Status-transition hook — set/clear `completedAt`

**Story Points:** ~3
**Role Target:** Backend (NestJS + Prisma)
**Assignee:** TBD

#### Description
Make `completedAt` a side effect of status changes so analytics are always correct going forward.

#### Detailed Requirements
1. In `backend/src/issues/issues.service.ts` `update()` (line 160): when `dto.status` transitions to `DONE`, set `updateData.completedAt = new Date()`; when transitioning *away* from DONE, set `updateData.completedAt = null`.
2. Audit every other place status is written (board service `issues/:issueId/status`, any bulk ops) and apply the same rule — fix the class, not just the one site.

#### Acceptance Criteria
- [ ] Unit tests: DONE sets `completedAt`; DONE → TODO clears it; non-status edits leave it untouched.
- [ ] Board quick-status endpoint behaves identically (test included).

## 📋 Task 3: Analytics endpoints (velocity, burndown, workload)

**Story Points:** ~8
**Role Target:** Backend (NestJS + Prisma)
**Assignee:** TBD

#### Description
New `analytics` module exposing read-only planning data, computed in SQL/Prisma (not N+1 loops).

#### Detailed Requirements
1. New module `backend/src/analytics/` (controller + service), mounted under `projects/:projectId/analytics`, same access guards as backlog (reuse `assertProjectAccess` pattern from `backend/src/backlog/backlog.service.ts:36`).
2. `GET /projects/:projectId/analytics/velocity` → for each completed sprint: name, endDate, delivered SP (sum of `storyPoints` where `status='DONE'`), completed SP (where `completedAt <= sprint.completedAt`), planned SP, plus `averageVelocity` (last 3 sprints).
3. `GET /projects/:projectId/analytics/burndown?sprintId=` → daily series from `sprint.startDate` to today (or `sprint.completedAt`): `{ date, remainingSP }` where remaining = planned − Σ done-before-or-on-date. Ideal line included (linear from planned to 0).
4. `GET /projects/:projectId/analytics/workload` → per project member: SP in active sprint, open issues (not DONE), overdue count, plus `activeSprintCapacity` estimate = team size × 10 SP (configurable).
5. DTO validation: `sprintId` must exist in the project.

#### Acceptance Criteria
- [ ] All three endpoints return correct numbers verified against `sprint-report.js` on a fixture dataset.
- [ ] Burndown with zero done issues returns the ideal line only (no crash).
- [ ] No N+1: each endpoint ≤ 3 SQL queries (verify via Prisma query log).
- [ ] e2e/unit tests for all three endpoints (401/403/404 paths included).

## 📋 Task 4: Burndown + velocity UI

**Story Points:** ~8
**Role Target:** Frontend (Next.js + TanStack Query)
**Design Dependency:** None (use existing design tokens; small SVG chart)
**Assignee:** TBD

#### Description
Show the numbers where decisions happen: burndown + progress on the sprint detail page, velocity on the sprints list.

#### Detailed Requirements
1. `frontend/src/lib/analytics-api.ts` — typed client for the three endpoints (follow `sprints-api.ts` conventions).
2. Sprint detail (`frontend/src/app/projects/[id]/sprints/[sprintId]/page.tsx`): burndown panel above the issue list for ACTIVE sprints — **no new chart dependency**: lightweight inline SVG polyline (≈80 lines) using CSS vars for colors; day axis labels via `date-fns` (already a dep).
3. Sprints list (`frontend/src/app/projects/[id]/sprints/page.tsx`): per-sprint velocity chip (delivered SP) + 3-sprint average; progress bar driven by SP, not issue count.
4. Loading/error states matching existing patterns (`isLoading` spinner, error boundary pattern from `projects/[id]/error.tsx`).

#### Acceptance Criteria
- [ ] Burndown renders for ACTIVE sprints; shows remaining SP + ideal line; empty state for no points.
- [ ] Sprint list shows delivered SP and average velocity for completed sprints.
- [ ] `npm run build` passes; no new dependencies added.
- [ ] Manual check: matches existing dark/light theme tokens (user verifies visually).

## 📋 Task 5: Workload allocation panel

**Story Points:** ~5
**Role Target:** Frontend (Next.js + TanStack Query)
**Design Dependency:** None
**Assignee:** TBD

#### Description
Answer "who is overloaded?" at planning time — in the backlog and sprint planning panel.

#### Detailed Requirements
1. Backlog page (`frontend/src/app/projects/[id]/backlog/page.tsx`): workload strip — per member: SP in active sprint vs capacity (10 SP default), overflow highlighted.
2. Sprint detail planning panel: same data inline so the lead sees load before clicking "+ Add".
3. Add "unassigned" bucket to the workload list.

#### Acceptance Criteria
- [ ] Workload strip renders on backlog page and planning panel.
- [ ] Members over capacity visually flagged (existing danger token).
- [ ] `npm run build` passes.

## 📋 Task 6: Story-point scale validation + capacity guardrails

**Story Points:** ~3
**Role Target:** Backend (NestJS + Prisma)
**Assignee:** TBD

#### Description
Stop planning noise at the source: enforce the Fibonacci scale and warn when a sprint's planned SP exceeds capacity.

#### Detailed Requirements
1. `backend/src/issues/dto/*` — validate `storyPoints` ∈ {1, 2, 3, 5, 8, 13} or null (class-validator `IsIn`); also validate on sprint add.
2. `startSprint` (sprints.service.ts:178): reject with a clear message if planned SP > capacity (10 × member count) — unless a `force` flag is passed (capacity is an estimate, not a rule).

#### Acceptance Criteria
- [ ] Invalid story points rejected with 400 + clear message.
- [ ] Over-capacity sprint start blocked with actionable message; `force` bypass works.
- [ ] Tests for both.

## 📋 Task 7: Load-test overhaul + prod baseline

**Story Points:** ~3
**Role Target:** Backend/QA
**Assignee:** TBD

#### Description
Make K6 honest: real auth, real endpoints, prod runnable. (The script was fixed this session — header now `'Bearer ' + token` via concatenation; the `Bearer <token>` literal gets redacted to `***` by credential scrubbing in file tooling, so keep the concatenation form.)

#### Detailed Requirements
1. `backend/scripts/load-test.js` (already upgraded this session): `setup()` logs in via `POST /auth/login` with `TEST_EMAIL`/`TEST_PASSWORD`, tests dashboard, conversations, projects, notifications, and project-scoped sprints/backlog/board when `PROJECT_ID` is set; `BASE_URL` overridable.
2. Run a 10-user baseline against prod:
   ```bash
   cd backend && k6 run \
     -e BASE_URL=https://trackr-api-yync.onrender.com/api \
     -e TEST_EMAIL=... -e TEST_PASSWORD=... \
     -e PROJECT_ID=<your-project-id> scripts/load-test.js
   ```
3. Record results in the sprint report (percentiles, error rate).

#### Acceptance Criteria
- [ ] Script runs against local AND prod without 401s (with valid creds).
- [ ] Prod baseline captured: p95/p99 + error rate documented.
- [ ] Thresholds tripped → logged as findings (do not silently relax).

## 📋 Task 8: N+1 audit of hot endpoints

**Story Points:** ~5
**Role Target:** Backend (NestJS + Prisma)
**Assignee:** TBD

#### Description
The messages fix (batched `groupBy` for unread counts, `backend/src/messages/messages.service.ts`) is the pattern; find the remaining N+1s.

#### Detailed Requirements
1. Audit with Prisma query log + `explain`: `teams` list, `notifications` list, `board` (sprints/issues), `projects` list.
2. Fix any per-row query loops (count/aggregate inside `for`) with `groupBy`/`include` batching — same as the messages pattern.
3. Re-run load test; compare p95 before/after in the sprint report.

#### Acceptance Criteria
- [ ] Audit findings documented (endpoint, query count before/after).
- [ ] All per-row loops eliminated in audited endpoints.
- [ ] p95 improves or stays flat on the prod baseline; no regressions.

## 📋 Task 9: Lighthouse regression gate

**Story Points:** ~5
**Role Target:** Frontend (Next.js)
**Assignee:** TBD

#### Description
Make the ~98 Lighthouse score durable — a sequential, JWT-authenticated workflow for the protected pages (`/my-work`, `/projects`, `/teams`, `/messages`, `/notifications`).

#### Detailed Requirements
1. Package the existing sequential workflow (reports already at `frontend/lighthouse-report*.html`) into a repeatable script: login → get token → run Lighthouse per route with `extraHeaders` → emit JSON + HTML.
2. Add npm script (`frontend/package.json`): `"lighthouse:ci": "node scripts/lighthouse-sequential.js"`.
3. Document thresholds (performance ≥ 90 on desktop baseline; LCP ≤ 2s) in the repo.

#### Acceptance Criteria
- [ ] Script runs end-to-end on prod with a valid JWT.
- [ ] All 5 protected routes evaluated; report artifacts committed or gitignored per team choice.
- [ ] Thresholds documented; any regression below 90 → finding + fix task.

---

## Sprint capacity & allocation notes

- Velocity starts as an estimate (≈30 SP / 2-week sprint for a 3-dev team at 10 SP/dev); after 3 sprints, `averageVelocity` from Task 3 replaces the estimate.
- Allocation rule of thumb: planned SP per dev ≤ 10 (≈ full-time capacity) with 20% slack for bugs/meetings. Task 6 enforces the sprint-level cap.
- Burndown interpretation: remaining SP trending above the ideal line for 2+ days → re-plan mid-sprint (pull scope or reassign); below → pull from backlog.
- Assignees TBD by tech lead before sprint start; tasks 1–3 are backend prerequisites for 4–5, so assign 1–3 first.

## Housekeeping (do in the same PR)

- [ ] Fix git index state: `frontend/src/components/GlobalProgressBar.tsx` is staged as *new* but deleted in the working tree (intent: removal). Fix with `git add -A frontend/src/components/GlobalProgressBar.tsx` (stages the deletion) or `git restore --staged` if it should not be tracked.
- [ ] Decide fate of untracked `frontend/lighthouse-report*.html` (commit as artifacts or add to `.gitignore`).

## Verification after implementation

1. `cd backend && npx prisma migrate dev` clean; `node --env-file=.env scripts/sprint-report.js` runs.
2. `cd frontend && npm run build` passes (user's prod-mode check: `npm run build && npm start`).
3. Burndown/workload/velocity screens visually verified by the user on local prod-mode.
4. Load-test prod baseline captured; Lighthouse ≥ 90 on all protected routes.
