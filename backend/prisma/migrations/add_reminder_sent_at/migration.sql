-- Add reminderSentAt to issues for idempotent deadline cron
ALTER TABLE "issues" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
