CREATE TABLE IF NOT EXISTS allowance_deposits (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS allowance_categories (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '💰',
  budgeted REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
