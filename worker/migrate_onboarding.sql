-- Migration: add onboarding tracking to users table
-- Run against the D1 database:
--   npx wrangler d1 execute budget_db --remote --file=worker/migrate_onboarding.sql

ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT;
ALTER TABLE users ADD COLUMN onboarding_quiz_answers TEXT;
ALTER TABLE users ADD COLUMN starting_balance REAL;
