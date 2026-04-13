-- Prisma must run this migration outside a transaction because PostgreSQL does
-- not allow ALTER TYPE ... ADD VALUE inside a transaction block.
-- prisma-client-js: {"transactionAnnotation":"disabled"}

-- Add TEAM_LEAD to the global Role enum on the User table
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEAM_LEAD';
