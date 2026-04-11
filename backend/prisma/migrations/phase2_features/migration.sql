-- Phase 2 migration: recycle bin, deletion requests, deadlines, story points, avatars, createdById

-- ============================================================
-- 1. New enums
-- ============================================================
CREATE TYPE "DeletedItemType" AS ENUM ('ISSUE', 'PROJECT', 'TEAM');
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "RecycleBinStatus" AS ENUM ('ACTIVE', 'RESTORED', 'PURGED');

-- ============================================================
-- 2. Extend NotificationType enum with new values
-- ============================================================
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_NOTICE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELETION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESTORE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESTORE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESTORE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_REMINDER';

-- ============================================================
-- 3. New columns on existing tables
-- ============================================================

-- User: avatar
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- Team: track creator
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
-- Backfill: assign the first superadmin (or any user) as creator for existing rows
UPDATE "Team" SET "createdById" = (SELECT id FROM "User" WHERE role = 'SUPERADMIN' ORDER BY "createdAt" LIMIT 1)
  WHERE "createdById" IS NULL;
-- Now enforce NOT NULL and FK
ALTER TABLE "Team" ALTER COLUMN "createdById" SET NOT NULL;
ALTER TABLE "Team" ADD CONSTRAINT "Team_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Project: track creator
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
UPDATE "Project" SET "createdById" = (SELECT id FROM "User" WHERE role = 'SUPERADMIN' ORDER BY "createdAt" LIMIT 1)
  WHERE "createdById" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "createdById" SET NOT NULL;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Issue: story points, deadline, createdById, reminderSentAt
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "storyPoints" INTEGER;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
UPDATE "Issue" SET "createdById" = "reporterId" WHERE "createdById" IS NULL;
ALTER TABLE "Issue" ALTER COLUMN "createdById" SET NOT NULL;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. New table: DeletedItem (recycle bin)
-- ============================================================
CREATE TABLE IF NOT EXISTS "DeletedItem" (
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

  CONSTRAINT "DeletedItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeletedItem_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- 5. New table: DeletionRequest (member requests admin to delete an issue)
-- ============================================================
CREATE TABLE IF NOT EXISTS "DeletionRequest" (
  "id"              TEXT NOT NULL,
  "issueId"         TEXT NOT NULL,
  "requestedById"   TEXT NOT NULL,
  "reason"          TEXT NOT NULL,
  "status"          "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "responseReason"  TEXT,
  "respondedById"   TEXT,
  "respondedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeletionRequest_issueId_fkey"
    FOREIGN KEY ("issueId") REFERENCES "Issue"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeletionRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeletionRequest_respondedById_fkey"
    FOREIGN KEY ("respondedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================
-- 6. New table: RestoreRequest
-- ============================================================
CREATE TABLE IF NOT EXISTS "RestoreRequest" (
  "id"            TEXT NOT NULL,
  "deletedItemId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "status"        "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "responseReason" TEXT,
  "respondedById" TEXT,
  "respondedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RestoreRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RestoreRequest_deletedItemId_fkey"
    FOREIGN KEY ("deletedItemId") REFERENCES "DeletedItem"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RestoreRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RestoreRequest_respondedById_fkey"
    FOREIGN KEY ("respondedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================
-- 7. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS "DeletedItem_itemType_status_idx" ON "DeletedItem"("itemType", "status");
CREATE INDEX IF NOT EXISTS "DeletedItem_expiresAt_idx" ON "DeletedItem"("expiresAt");
CREATE INDEX IF NOT EXISTS "DeletionRequest_issueId_idx" ON "DeletionRequest"("issueId");
CREATE INDEX IF NOT EXISTS "DeletionRequest_status_idx" ON "DeletionRequest"("status");
CREATE INDEX IF NOT EXISTS "Issue_deadline_idx" ON "Issue"("deadline");
CREATE INDEX IF NOT EXISTS "Issue_reminderSentAt_idx" ON "Issue"("reminderSentAt");
