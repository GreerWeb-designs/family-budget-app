CREATE TABLE IF NOT EXISTS google_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  google_email  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
