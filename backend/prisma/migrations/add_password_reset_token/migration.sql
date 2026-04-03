-- Add password reset token fields to users table
ALTER TABLE "users" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordResetExpiry" TIMESTAMP(3);
