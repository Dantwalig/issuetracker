-- Add TEAM_LEAD to the global Role enum on the User table
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEAM_LEAD';
