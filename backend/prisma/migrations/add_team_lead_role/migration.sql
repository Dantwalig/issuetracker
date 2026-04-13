-- Add scoped Team Lead role to TeamMember and ProjectMember
-- This is a fully non-destructive, additive-only migration.
-- Existing rows are unaffected (column defaults to NULL = regular member).

ALTER TABLE "team_members"
  ADD COLUMN IF NOT EXISTS "scopedRole" TEXT DEFAULT NULL;

ALTER TABLE "project_members"
  ADD COLUMN IF NOT EXISTS "scopedRole" TEXT DEFAULT NULL;

-- Optional index for fast lookup of all team leads in a team/project
CREATE INDEX IF NOT EXISTS "team_members_scopedRole_idx" ON "team_members" ("teamId", "scopedRole");
CREATE INDEX IF NOT EXISTS "project_members_scopedRole_idx" ON "project_members" ("projectId", "scopedRole");
