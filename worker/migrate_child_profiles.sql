CREATE TABLE IF NOT EXISTS child_profiles (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🧒',
  created_at   TEXT NOT NULL
);
