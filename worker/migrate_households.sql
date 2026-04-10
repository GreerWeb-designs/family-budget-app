-- Create household for u_bobby
INSERT OR IGNORE INTO households (id, name, created_at) VALUES ('hh_bobby', 'Ducharme Family', '2024-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO household_members (id, household_id, user_id, role, joined_at) VALUES ('hm_bobby', 'hh_bobby', 'u_bobby', 'admin', '2024-01-01T00:00:00.000Z');

-- Create household for u_rosie
INSERT OR IGNORE INTO households (id, name, created_at) VALUES ('hh_rosie', 'Rosie''s Household', '2024-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO household_members (id, household_id, user_id, role, joined_at) VALUES ('hm_rosie', 'hh_rosie', 'u_rosie', 'admin', '2024-01-01T00:00:00.000Z');

-- Add household_id to bills
ALTER TABLE bills ADD COLUMN household_id TEXT NOT NULL DEFAULT 'legacy';

-- Add household_id to calendar_events
ALTER TABLE calendar_events ADD COLUMN household_id TEXT NOT NULL DEFAULT 'legacy';

-- Add household_id to notes
ALTER TABLE notes ADD COLUMN household_id TEXT NOT NULL DEFAULT 'legacy';
