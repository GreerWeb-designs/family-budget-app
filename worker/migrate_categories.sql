CREATE TABLE categories_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outflow',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL DEFAULT 'legacy',
  UNIQUE(name, user_id)
);
INSERT INTO categories_new SELECT id, name, direction, created_at, user_id FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
