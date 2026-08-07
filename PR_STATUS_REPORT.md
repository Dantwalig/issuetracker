# PR Status Report — ft-appReview (Performance & UI/UX Pass)

**Repo:** github.com/Dantwalig/issuetracker · **Branch:** `ft-appReview` → `main`
**Product:** Trackr — Issue & Sprint Management Platform (task-allocation tool for the Ubwenge Lab team)
**Scope of branch:** application review pass — performance, UI/UX, and stability improvements across the web app.
**Date:** 2026-08-03 · **Author:** Robert Tony MITALI Niyonkuru (tech lead)

---

## 1. Summary

The `ft-appReview` branch is a performance + UI/UX hardening pass over Trackr. It is code-complete and **both production builds pass** (frontend = Vercel CI gate, backend = Render gate). No automated test suite exists in this repo (see Risks), so verification is build-level + code review; runtime/visual verification is pending the user's local prod-mode check.

## 2. What the PR contains (vs `main`) — 29 files, +1,761 / −207

**Performance**
- DB indexes on `issues` table: `projectId`, `sprintId`, `assigneeId`, `reporterId` (backend/prisma/schema.prisma)
- Backend CORS fix allowing the production frontend URL (trackr.ubwengelab.rw)
- `tsconfig.build.json` fix so the backend compiles directly to `dist/` (Render deploy fix)

**UI/UX**
- Printable Report view moved to a layout-isolated route (`/report/projects/[id]`) — printing no longer renders sidebar/topbar/tabs; fixed code-block backgrounds in the printed report
- Issues list overhaul: native Link rows (right/middle-click open-in-new-tab), filtering UI, +350 lines of improvements
- Board & backlog page improvements (drag/status affordances)
- Project routes: new Error Boundary (`error.tsx`) + loading state (`loading.tsx`)
- Sidebar active-link fix for `/projects`; Topbar breadcrumbs via new header-context
- IssueForm improvements (+143 lines)

**CI/stability**
- Added missing `frontend/.eslintrc.json` (was breaking Vercel CI builds); removed unused import; fixed `img` alt prop

## 3. In-flight work on top of the branch (uncommitted, reviewed & ready)

| Change | Why it matters |
|---|---|
| My-work dashboard: 5 serialized Prisma queries → `Promise.all` (1 round-trip) + in-memory stats | Biggest backend latency win for the landing page |
| Messages: N+1 unread-count queries → single batched `groupBy` | Conversations list latency |
| Group chats: per-member role updates (N queries) → 2 batched `updateMany` | Team admin actions |
| GlobalProgressBar removed | Route transitions are now instant (no blocking UI loader) |
| Skeleton loaders on My-Work, Teams, Notifications (replacing spinners) | Perceived performance |
| Optimistic status change (My-Work) + optimistic team create, both with rollback | Instant feedback, safe on error |
| ShareModal refactor + new ExportCard: PNG export of issue cards via `html-to-image`, markdown + spacing preserved | Feature: shareable task cards |
| MarkdownRenderer: `remark-breaks` (Shift+Enter single line breaks render properly) | Feature parity with the markdown guide |

## 4. Verification evidence

- `frontend npm run build` (Vercel CI gate): **PASS** — exit 0, all 24 routes compiled
- `backend npm run build` (nest build / tsc): **PASS**
- `npx prisma validate`: **PASS**
- Analytics pure-logic checks (fixture-based, 26 assertions): **PASS** — see Sprint A below

## 5. Follow-up work (separate, NOT required for this PR)

**Sprint A — Analytics & Stability** (`SPRINT_PLAN_ANALYTICS.md` in repo root):
- `completedAt` on Issue/Sprint (schema done, migration **not** run — requires approval; code falls back to `updatedAt` until then)
- New analytics module: velocity / burndown / workload endpoints (build green, logic verified)
- Fibonacci story-point validation (1,2,3,5,8,13)
- K6 load-test script overhauled (real auth flow, prod-runnable); read-only sprint-report script added
- Planned but not started: burndown/velocity/workload UI, N+1 audit (teams/notifications/board), Lighthouse regression gate

## 6. Risks & open items (before submission)

1. **No automated tests** anywhere in the repo (frontend or backend) — no `test` scripts, no jest. Build-level verification only. Recommend adding at least backend unit tests for the analytics module + status-transition hooks (Sprint A tasks include them).
2. **Git index inconsistency:** `GlobalProgressBar.tsx` is staged as "new file" but deleted in the working tree (intent: removal). Fix before push:
   `git add -A frontend/src/components/GlobalProgressBar.tsx`
3. **3 commits unpushed** (cc8d043, ac538b9, 31be760) — push when ready.
4. **Untracked artifacts to decide on:** `frontend/lighthouse-report*.html` (3 files) — commit as evidence or gitignore.
5. Backend `npm run lint` is broken on a clean install (eslint not declared in backend devDependencies) — pre-existing, low priority.
6. **Pending runtime/visual verification:** user's `npm run build && npm start` + browser pass (Lighthouse ~98 desktop baseline already measured; re-run recommended after these changes).

## 7. Recommended sequence

1. Fix GlobalProgressBar index state (item 2)
2. Push the 3 commits; open PR `ft-appReview` → `main`
3. User runtime pass on prod-mode (`npm run build && npm start`) — confirm skeletons, print report, PNG export, optimistic updates
4. Then start Sprint A (analytics) with the `add_completed_at` migration as the gate
