-- Phase 2 migration: recycle bin, deletion requests, deadlines, story points, avatars, createdById
-- Fully idempotent: safe to run even if partially applied

-- ============================================================
-- 1. New enums (safe if already exist)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "DeletedItemType" AS ENUM ('ISSUE', 'PROJECT', 'TEAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RecycleBinStatus" AS ENUM ('ACTIVE', 'RESTORED', 'PURGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. Extend NotificationType enum with new values
-- ============================================================
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_NOTICE'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_REQUEST'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_APPROVED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_REJECTED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESTORE_REQUEST'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESTORE_APPROVED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESTORE_REJECTED'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_REMINDER'; EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- 3. New columns on existing tables (safe if already exist)
-- ============================================================

-- users: avatar
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- teams: track creator
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
UPDATE "teams" SET "createdById" = COALESCE(
  (SELECT id FROM "users" WHERE role = 'SUPERADMIN' ORDER BY "createdAt" LIMIT 1),
  (SELECT id FROM "users" ORDER BY "createdAt" LIMIT 1)
) WHERE "createdById" IS NULL;
DO $$ BEGIN
  ALTER TABLE "teams" ALTER COLUMN "createdById" SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- projects: track creator
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
UPDATE "projects" SET "createdById" = COALESCE(
  (SELECT id FROM "users" WHERE role = 'SUPERADMIN' ORDER BY "createdAt" LIMIT 1),
  (SELECT id FROM "users" ORDER BY "createdAt" LIMIT 1)
) WHERE "createdById" IS NULL;
DO $$ BEGIN
  ALTER TABLE "projects" ALTER COLUMN "createdById" SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- issues: story points, deadline, createdById, reminderSentAt
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "storyPoints" INTEGER;
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3);
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
UPDATE "issues" SET "createdById" = "reporterId" WHERE "createdById" IS NULL;
DO $$ BEGIN
  ALTER TABLE "issues" ALTER COLUMN "createdById" SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "issues" ADD CONSTRAINT "issues_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4. New table: deleted_items (recycle bin)
-- ============================================================
CREATE TABLE IF NOT EXISTS "deleted_items" (
  "id"           TEXT NOT NULL,
  "itemType"     "DeletedItemType" NOT NULL,
  "itemId"       TEXT NOT NULL,
  "itemSnapshot" JSONB NOT NULL,
  "deletedById"  TEXT NOT NULL,
  "reason"       TEXT NOT NULL,
  "status"       "RecycleBinStatus" NOT NULL DEFAULT 'ACTIVE',
  "deletedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "restoredAt"   TIMESTAMP(3),

  CONSTRAINT "deleted_items_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "deleted_items" ADD CONSTRAINT "deleted_items_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "users"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 5. New table: deletion_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS "deletion_requests" (
  "id"              TEXT NOT NULL,
  "issueId"         TEXT NOT NULL,
  "requestedById"   TEXT NOT NULL,
  "reason"          TEXT NOT NULL,
  "status"          "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "responseReason"  TEXT,
  "respondedById"   TEXT,
  "respondedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_issueId_fkey"
    FOREIGN KEY ("issueId") REFERENCES "issues"(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_respondedById_fkey"
    FOREIGN KEY ("respondedById") REFERENCES "users"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 6. New table: restore_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS "restore_requests" (
  "id"             TEXT NOT NULL,
  "deletedItemId"  TEXT NOT NULL,
  "requestedById"  TEXT NOT NULL,
  "reason"         TEXT NOT NULL,
  "status"         "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "responseReason" TEXT,
  "respondedById"  TEXT,
  "respondedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "restore_requests_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_deletedItemId_fkey"
    FOREIGN KEY ("deletedItemId") REFERENCES "deleted_items"(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_respondedById_fkey"
    FOREIGN KEY ("respondedById") REFERENCES "users"(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 7. Indexes (safe if already exist)
-- ============================================================
CREATE INDEX IF NOT EXISTS "deleted_items_itemType_status_idx" ON "deleted_items"("itemType", "status");
CREATE INDEX IF NOT EXISTS "deleted_items_expiresAt_idx" ON "deleted_items"("expiresAt");
CREATE INDEX IF NOT EXISTS "deletion_requests_issueId_idx" ON "deletion_requests"("issueId");
CREATE INDEX IF NOT EXISTS "deletion_requests_status_idx" ON "deletion_requests"("status");
CREATE INDEX IF NOT EXISTS "issues_deadline_idx" ON "issues"("deadline");
CREATE INDEX IF NOT EXISTS "issues_reminderSentAt_idx" ON "issues"("reminderSentAt");