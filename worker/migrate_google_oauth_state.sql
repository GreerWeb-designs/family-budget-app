CREATE TABLE IF NOT EXISTS google_oauth_state (
  state      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
