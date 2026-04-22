-- Migration: add budget_reset_at to account_state for fresh-start support
-- Run with: npx wrangler d1 execute budget_db --remote --file=worker/migrate_budget_reset.sql

ALTER TABLE account_state ADD COLUMN budget_reset_at TEXT;
