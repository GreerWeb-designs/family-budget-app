-- =========================
-- AUTH
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- =========================
-- BUDGET
-- =========================
CREATE TABLE IF NOT EXISTS budget_lines (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  amount_budgeted REAL NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_lines_category
  ON budget_lines(category_id);

-- =========================
-- SPEND / INCOME LOG (direction: out/in)
-- =========================
CREATE TABLE IF NOT EXISTS manual_spends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  direction TEXT NOT NULL DEFAULT 'out', -- 'out' or 'in'
  date TEXT NOT NULL,                   -- YYYY-MM-DD
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_manual_spends_user_date
  ON manual_spends(user_id, date);

-- =========================
-- BILLS
-- =========================
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  mode TEXT NOT NULL,            -- 'auto' or 'manual'
  due_date TEXT NOT NULL,        -- YYYY-MM-DD (next due date)
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bills_user_due
  ON bills(user_id, due_date);

CREATE TABLE IF NOT EXISTS bill_payments (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  paid_date TEXT NOT NULL,       -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  FOREIGN KEY(bill_id) REFERENCES bills(id)
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_date
  ON bill_payments(bill_id, paid_date);

-- =========================
-- GOALS
-- =========================
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'active' | 'done'
  due_date TEXT,                 -- YYYY-MM-DD (optional)
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_goals_user_status_due
  ON goals(user_id, status, due_date);

-- =========================
-- DEBTS (baseline debt data)
-- =========================
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  apr REAL NOT NULL DEFAULT 0,          -- APR percent (e.g. 19.99)
  balance REAL NOT NULL DEFAULT 0,
  payment REAL NOT NULL DEFAULT 0,      -- baseline monthly payment
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_debts_user_name
  ON debts(user_id, name);

CREATE TABLE IF NOT EXISTS debt_payment_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  debt_id TEXT NOT NULL,
  month TEXT NOT NULL,
  planned_payment REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(debt_id) REFERENCES debts(id),
  UNIQUE(user_id, debt_id, month)
);

CREATE INDEX IF NOT EXISTS idx_debt_payment_plans_user_month
  ON debt_payment_plans(user_id, month);

-- Global settings for the debt snowball (one row per user)
CREATE TABLE IF NOT EXISTS debt_settings (
  user_id TEXT PRIMARY KEY,
  extra_monthly REAL NOT NULL DEFAULT 0,   -- your "additional payment" amount
  strategy TEXT NOT NULL DEFAULT 'snowball', -- 'snowball' or 'avalanche' (optional)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- =========================
-- LOCAL CALENDAR EVENTS (MVP)
-- =========================
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,        -- ISO string
  end_at TEXT,                   -- ISO string optional
  location TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start
  ON calendar_events(user_id, start_at);

-- =========================
-- ACCOUNT STATE (Plaid placeholder + anchor/reconcile)
-- =========================
CREATE TABLE IF NOT EXISTS account_state (
  id TEXT PRIMARY KEY,           -- 'main'
  bank_balance REAL NOT NULL DEFAULT 0,
  anchor_balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO account_state (id, bank_balance, anchor_balance, updated_at)
VALUES ('main', 0, 0, datetime('now'));
