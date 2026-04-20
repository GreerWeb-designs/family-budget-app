CREATE TABLE IF NOT EXISTS todo_lists (
  id            TEXT PRIMARY KEY,
  household_id  TEXT NOT NULL,
  title         TEXT NOT NULL,
  list_type     TEXT NOT NULL DEFAULT 'onetime',
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  FOREIGN KEY (household_id) REFERENCES households(id)
);

CREATE TABLE IF NOT EXISTS todo_items (
  id            TEXT PRIMARY KEY,
  list_id       TEXT NOT NULL,
  household_id  TEXT NOT NULL,
  title         TEXT NOT NULL,
  completed     INTEGER NOT NULL DEFAULT 0,
  completed_at  TEXT,
  created_at    TEXT NOT NULL,
  FOREIGN KEY (list_id) REFERENCES todo_lists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todo_lists_household ON todo_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_list      ON todo_items(list_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_household ON todo_items(household_id);
