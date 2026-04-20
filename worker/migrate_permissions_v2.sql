ALTER TABLE dependent_permissions ADD COLUMN finances_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dependent_permissions ADD COLUMN can_see_spending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dependent_permissions ADD COLUMN can_see_recipes INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dependent_permissions ADD COLUMN can_see_meals INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dependent_permissions ADD COLUMN can_see_todo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dependent_permissions ADD COLUMN can_see_allowance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS allowances (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
