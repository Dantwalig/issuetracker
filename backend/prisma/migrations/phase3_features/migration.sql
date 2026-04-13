-- Phase 3 Features Migration
-- Safe for live databases: new tables only, ADD COLUMN uses IF NOT EXISTS,
-- enum ADD VALUE uses IF NOT EXISTS. No destructive changes.

-- ── Labels ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "labels_name_projectId_key" ON "labels"("name", "projectId");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'labels_projectId_fkey'
  ) THEN
    ALTER TABLE "labels" ADD CONSTRAINT "labels_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Issue Labels (join table) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "issue_labels" (
    "issueId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("issueId", "labelId")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'issue_labels_issueId_fkey') THEN
    ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issueId_fkey"
      FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'issue_labels_labelId_fkey') THEN
    ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_labelId_fkey"
      FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Checklists ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "checklists" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'checklists_issueId_fkey') THEN
    ALTER TABLE "checklists" ADD CONSTRAINT "checklists_issueId_fkey"
      FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Checklist Items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "checklist_items" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'checklist_items_checklistId_fkey') THEN
    ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklistId_fkey"
      FOREIGN KEY ("checklistId") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Comment Attachments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "comment_attachments" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comment_attachments_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comment_attachments_commentId_fkey') THEN
    ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_commentId_fkey"
      FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Comment Mentions ──────────────────────────────────────────────────────
-- FIX: Added missing FK to users table (was missing in original migration)
CREATE TABLE IF NOT EXISTS "comment_mentions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comment_mentions_commentId_fkey') THEN
    ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_commentId_fkey"
      FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comment_mentions_userId_fkey') THEN
    ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Direct Messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "direct_messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "direct_messages_senderId_receiverId_idx" ON "direct_messages"("senderId", "receiverId");
CREATE INDEX IF NOT EXISTS "direct_messages_receiverId_isRead_idx" ON "direct_messages"("receiverId", "isRead");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'direct_messages_senderId_fkey') THEN
    ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'direct_messages_receiverId_fkey') THEN
    ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Activity Log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "activity_logs_projectId_createdAt_idx" ON "activity_logs"("projectId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'activity_logs_projectId_fkey') THEN
    ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'activity_logs_issueId_fkey') THEN
    ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_issueId_fkey"
      FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'activity_logs_userId_fkey') THEN
    ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── shareToken column on issues (nullable — safe for existing rows) ────────
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "issues_shareToken_key" ON "issues"("shareToken");

-- ── New enum values (IF NOT EXISTS — safe for re-runs) ────────────────────
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DIRECT_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTION';
