ALTER TABLE dependent_permissions ADD COLUMN can_see_bank_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS allowance_transactions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  direction TEXT NOT NULL DEFAULT 'out',
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
