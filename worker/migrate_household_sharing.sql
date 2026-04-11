-- Migration: household-shared budget data
-- Command: npx wrangler d1 execute budget_db --remote --file=worker/migrate_household_sharing.sql
-- Safe to re-run: uses COALESCE/INSERT OR IGNORE guards throughout.

-- 1. categories: add household_id
ALTER TABLE categories ADD COLUMN household_id TEXT NOT NULL DEFAULT 'personal';

-- 2. categories: migrate existing rows to their household
UPDATE categories
SET household_id = COALESCE(
  (SELECT hm.household_id FROM household_members hm WHERE hm.user_id = categories.user_id LIMIT 1),
  'personal'
)
WHERE household_id = 'personal';

-- 3. budget_lines: add household_id
ALTER TABLE budget_lines ADD COLUMN household_id TEXT NOT NULL DEFAULT 'personal';

-- 4. budget_lines: migrate via category's household
UPDATE budget_lines
SET household_id = COALESCE(
  (SELECT c.household_id FROM categories c WHERE c.id = budget_lines.category_id LIMIT 1),
  'personal'
)
WHERE household_id = 'personal';

-- 5. manual_spends: add household_id
ALTER TABLE manual_spends ADD COLUMN household_id TEXT NOT NULL DEFAULT 'personal';

-- 6. manual_spends: migrate existing rows to their household
UPDATE manual_spends
SET household_id = COALESCE(
  (SELECT hm.household_id FROM household_members hm WHERE hm.user_id = manual_spends.user_id LIMIT 1),
  'personal'
)
WHERE household_id = 'personal';

-- 7a. account_state: insert new household-scoped rows, taking the best values
--     from all members (MAX bank_balance wins; INSERT OR IGNORE is idempotent).
INSERT OR IGNORE INTO account_state (id, bank_balance, anchor_balance, to_be_budgeted, updated_at)
SELECT
  hm.household_id,
  MAX(COALESCE(a.bank_balance,    0)),
  MAX(COALESCE(a.anchor_balance,  0)),
  MAX(COALESCE(a.to_be_budgeted,  0)),
  MAX(COALESCE(a.updated_at, '1970-01-01T00:00:00.000Z'))
FROM household_members hm
LEFT JOIN account_state a ON a.id = hm.user_id
GROUP BY hm.household_id;

-- 7b. account_state: delete old user-scoped rows (now superseded by household row)
DELETE FROM account_state
WHERE id IN (SELECT user_id FROM household_members);

-- 8. budget_months: add household_id
ALTER TABLE budget_months ADD COLUMN household_id TEXT NOT NULL DEFAULT 'personal';

-- 9. budget_months: migrate via budget_lines for that month
UPDATE budget_months
SET household_id = COALESCE(
  (SELECT bl.household_id FROM budget_lines bl
   WHERE bl.month = budget_months.month AND bl.household_id != 'personal' LIMIT 1),
  'personal'
)
WHERE household_id = 'personal';
