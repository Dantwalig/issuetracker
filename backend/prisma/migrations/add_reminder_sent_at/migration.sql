-- Add reminderSentAt to issues for idempotent deadline cron
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
