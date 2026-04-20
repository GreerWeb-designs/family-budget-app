ALTER TABLE todo_lists ADD COLUMN owner_user_id TEXT REFERENCES users(id);
