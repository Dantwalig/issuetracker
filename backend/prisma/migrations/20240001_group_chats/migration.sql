-- Migration: Add group chats, group messages, invite system + DM editing
-- Run with: npx prisma migrate deploy  (or apply manually)

-- 1. Add editedAt to direct_messages (backward-compatible: nullable)
ALTER TABLE "direct_messages" ADD COLUMN "editedAt" TIMESTAMP(3);

-- 2. Enums
CREATE TYPE "GroupMemberRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "GroupInviteStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- 3. group_chats
CREATE TABLE "group_chats" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_chats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_chats_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. group_members
CREATE TABLE "group_members" (
    "id"       TEXT NOT NULL,
    "groupId"  TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "role"     "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_members_groupId_userId_key" UNIQUE ("groupId", "userId"),
    CONSTRAINT "group_members_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "group_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_members_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. group_messages
CREATE TABLE "group_messages" (
    "id"        TEXT NOT NULL,
    "groupId"   TEXT NOT NULL,
    "senderId"  TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "editedAt"  TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_messages_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "group_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_messages_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "group_messages_groupId_createdAt_idx" ON "group_messages"("groupId", "createdAt");

-- 6. group_invite_requests
CREATE TABLE "group_invite_requests" (
    "id"          TEXT NOT NULL,
    "groupId"     TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "inviteeId"   TEXT NOT NULL,
    "status"      "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_invite_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_invite_requests_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "group_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_invite_requests_initiatorId_fkey"
        FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "group_invite_requests_inviteeId_fkey"
        FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 7. group_invite_approvals
CREATE TABLE "group_invite_approvals" (
    "id"        TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "memberId"  TEXT NOT NULL,
    "status"    "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "reason"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_invite_approvals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_invite_approvals_requestId_memberId_key" UNIQUE ("requestId", "memberId"),
    CONSTRAINT "group_invite_approvals_requestId_fkey"
        FOREIGN KEY ("requestId") REFERENCES "group_invite_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_invite_approvals_memberId_fkey"
        FOREIGN KEY ("memberId") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
