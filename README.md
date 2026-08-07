# Trackr — Issue & Sprint Management Platform

Trackr is the task-allocation and sprint-planning tool for the Ubwenge Lab team. It is used to
assign issues to team members, plan and track sprints, and run the day-to-day delivery workflow
across projects.

- **Frontend:** https://trackr.ubwengelab.rw (Vercel)
- **Backend API:** https://trackr-api-yync.onrender.com/api (Render)
- **Repository:** https://github.com/Dantwalig/issuetracker

---

## Features

**Issue management**
- Issue types: Task / Bug / Story, with priorities (Low / Medium / High)
- Story points on the Fibonacci scale (1, 2, 3, 5, 8, 13), deadlines, labels, checklists, comments with mentions and attachments
- Full markdown support (GFM + `Shift+Enter` single line breaks) in descriptions, comments, and the printable report

**Sprints & planning**
- Sprint lifecycle: `DRAFT → ACTIVE → COMPLETED` (one active sprint per project; unfinished issues auto-return to the backlog on completion)
- Backlog with drag-reorder and move-to/from-sprint planning panel
- Board with `TODO / IN_PROGRESS / DONE` columns and quick status changes
- Analytics API: sprint **velocity**, **burndown**, and per-member **workload** endpoints (see "Analytics API")

**Collaboration**
- Teams & projects with scoped roles (member / team lead) and admin controls
- My-Work dashboard: stats, overdue items, sprint progress, recent activity
- Direct messages and group chats
- Notifications: in-app + email (Resend), deadline reminders via scheduled cron

**Sharing & reporting**
- Public share links per issue (generatable/revocable)
- PNG card export of issues (`html-to-image`, markdown preserved)
- Layout-isolated printable report route (`/report/projects/[id]`)

**Admin**
- User management (roles, activate/deactivate), deletion requests with approval flow, recycle bin with restore

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TanStack React Query, Axios, react-hook-form, react-markdown |
| Backend | NestJS 10, Prisma 5 ORM, class-validator |
| Database | PostgreSQL on Supabase (transaction-mode pooler for runtime) |
| Email | Resend |
| Infra | Vercel (frontend), Render (backend), Supabase (DB), Cloudflare (edge) |
| Perf tooling | k6 (load tests), Lighthouse (frontend audits) |

---

## Repository layout

```
backend/
  prisma/schema.prisma      # Prisma schema (source of truth)
  src/                      # NestJS modules (issues, sprints, backlog, board,
                            #   teams, projects, messages, notifications, labels,
                            #   checklists, comments, analytics, recycle-bin, …)
  scripts/
    load-test.js            # k6 load test (auth flow, prod-runnable)
    sprint-report.js        # read-only sprint/backlog state report
    diagnose-prisma.js      # read-only Prisma/DB health probes
    verify-analytics.ts     # fixture-based analytics logic checks
frontend/
  src/app/                  # Next.js App Router pages
  src/components/           # UI components (issues, layout, ui)
  src/lib/                  # API clients, auth/header contexts, permissions
  scripts/lighthouse-sequential.js   # JWT-authenticated Lighthouse gate
SPRINT_PLAN_ANALYTICS.md    # Sprint A plan + implementation status
PR_STATUS_REPORT.md         # Branch status report (boss-ready summary)
```

---

## Getting started

**Prerequisites:** Node.js 20+, npm, a PostgreSQL database (local or Supabase), and `prisma` CLI
via the backend's dev dependencies.

### Backend

```bash
cd backend
npm install
cp .env.example .env        # then fill in the values (see table below)
npx prisma generate
npx prisma migrate dev      # apply migrations to your dev database
npm run start:dev           # http://localhost:4000/api
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL
npm run dev                 # http://localhost:3000
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Runtime DB connection. Production uses the **Supabase transaction-mode pooler** (`…pooler.supabase.com:6543/…?sslmode=require&pgbouncer=true`) |
| `DIRECT_URL` | Direct DB connection used by Prisma **migrations** (migrations cannot run through the pooler) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for access/refresh tokens |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (e.g. `15m` / `7d`) |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated |
| `PORT` | API port (default `4000`) |
| `RESEND_API_KEY` | Resend key for email notifications |
| `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` | Email sender identity |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:4000/api`) |

---

## Useful scripts

| Command | Purpose |
|---|---|
| `node scripts/diagnose-prisma.js` (in `backend/`) | Read-only Prisma/DB health probes — run this first when you see DB errors |
| `node scripts/sprint-report.js` (in `backend/`) | Read-only sprint & backlog state report (status, dates, story points, velocity baseline) |
| `node scripts/verify-analytics.ts` (in `backend/`) | Fixture-based checks of the analytics pure logic (no DB needed) |
| `k6 run -e BASE_URL=… -e TEST_EMAIL=… -e TEST_PASSWORD=… -e PROJECT_ID=… scripts/load-test.js` | Load test against a running API (needs a test account) |
| `npm run lighthouse:ci` (in `frontend/`) | Sequential Lighthouse audit of the protected routes with JWT auth (`TEST_EMAIL`/`TEST_PASSWORD` env) |

---

## Analytics API

Protected by JWT, project-scoped, read-only:

- `GET /api/projects/:projectId/analytics/velocity` — delivered SP per completed sprint + average velocity (last 3 sprints)
- `GET /api/projects/:projectId/analytics/burndown?sprintId=…` — daily remaining-SP series with ideal line
- `GET /api/projects/:projectId/analytics/workload` — per-member SP vs capacity, overdue counts, unassigned bucket, backlog totals

> Note: completion timestamps currently fall back to `updatedAt`. A `completedAt` column is designed
> (migration-ready) but not yet applied — see `SPRINT_PLAN_ANALYTICS.md`.

---

## Deployment

**Frontend (Vercel):** build command `npm run build` (in `frontend/`), env `NEXT_PUBLIC_API_URL` set to
the production API. CORS is pre-configured for `https://trackr.ubwengelab.rw`.

**Backend (Render):** build `npm run build`, start `npm run start:prod` (`node dist/main`). Set the
backend env vars above; `DATABASE_URL` must be the pooler URL, `DIRECT_URL` the direct connection.

### Operational notes

- **Render free tier sleeps** after ~15 minutes of inactivity. The first request after idle triggers a
  cold start (can take 30–60 s and may fail with a `net::ERR_FAILED` / CORS-looking error in the browser).
  The frontend retries failed GETs once automatically; a keep-alive ping (e.g. an uptime monitor) is
  recommended for production usage.
- **Migrations:** `prisma/migrations/` is git-ignored in this repo (existing choice). Apply schema
  changes with `prisma migrate dev` on your dev DB and `prisma migrate deploy` in the deployment
  environment.
- **Schema hygiene:** never run `prisma db pull`/`db push` against the shared database; keep
  `schema.prisma` the source of truth and ship migrations.

---

## Docs

- `PR_STATUS_REPORT.md` — status of the `ft-appReview` branch (perf + UI/UX pass) for reporting
- `SPRINT_PLAN_ANALYTICS.md` — Sprint A plan: analytics foundation, N+1 audit, Lighthouse gate, status table
- `MARKDOWN_GUIDE.md` — markdown conventions used across issue descriptions and comments
