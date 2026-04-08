/// <reference types="@cloudflare/workers-types" />

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

type Bindings = {
  DB: D1Database;
  SESSION_SECRET: string;
};

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const APP_ORIGIN = "https://app.ducharmefamilybudget.com";

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const isAllowedOrigin = origin === APP_ORIGIN;

  if (isAllowedOrigin) {
    c.header("Access-Control-Allow-Origin", origin!);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    c.header("Vary", "Origin");
  }

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  try {
    await next();
  } finally {
    if (isAllowedOrigin) {
      c.header("Access-Control-Allow-Origin", origin!);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Access-Control-Allow-Headers", "Content-Type");
      c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      c.header("Vary", "Origin");
    }
    c.header("X-FamilyBudget-Worker", "yes");
  }
});

// ---- HARD-CODED CATEGORIES ----
const CATEGORIES = [
  { id: "income", name: "Income" },
  { id: "mortgage", name: "Mortgage" },
  { id: "groceries", name: "Groceries" },
  { id: "insurance", name: "Health Insurance" },
  { id: "toiletries_cleaning", name: "Toiletries/Cleaning" },
  { id: "clothes", name: "Clothes" },
  { id: "greer_cpw", name: "Greer CPW" },
  { id: "phone", name: "Phone" },
  { id: "car", name: "Car" },
  { id: "prisma_bills", name: "Prisma Bills" },
  { id: "gas", name: "Gas" },
  { id: "kirbys", name: "Kirbys" },
  { id: "google_one", name: "Google One" },
  { id: "canva", name: "Canva" },
  { id: "vsp", name: "VSP" },
  { id: "simplisafe", name: "SimpliSafe" },
  { id: "charter", name: "Charter" },
  { id: "burns_giving", name: "Burns Giving" },
  { id: "midland_credit", name: "Midland Credit" },
  { id: "travelers_insurance", name: "Traveler's Insurance" },
  { id: "chickens", name: "Chickens" },
  { id: "recurring", name: "Recurring" },
  { id: "savings", name: "Savings" },
  { id: "prime", name: "Prime" },
  { id: "rosie_spending", name: "Rosie Spending" },
  { id: "bobby_spending", name: "Bobby Spending" },
];

const uid = () => crypto.randomUUID();

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie") || "";
  const parts = cookie.split(";").map((s) => s.trim());

  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }

  return null;
}

function setCookie(name: string, value: string, maxAgeSec = 60 * 60 * 24 * 14) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${maxAgeSec}`;
}

function clearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`;
}

async function ensureAccountState(db: D1Database) {
  await db.prepare(
    `INSERT OR IGNORE INTO account_state (id, bank_balance, anchor_balance, to_be_budgeted, updated_at)
     VALUES ('main', 0, 0, 0, ?)`
  )
    .bind(new Date().toISOString())
    .run();
}

async function getCategories(db: D1Database) {
  const rows = await db.prepare(
    `SELECT id, name, direction
     FROM categories
     ORDER BY name ASC`
  ).all<{ id: string; name: string; direction: string }>();

  return rows.results ?? [];
}

// ---- AUTH MIDDLEWARE ----
const requireUser: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const token = getCookie(c.req.raw, "session");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const tokenHash = await sha256(token + c.env.SESSION_SECRET);
  const now = new Date().toISOString();

  const session = await c.env.DB.prepare(
    `SELECT user_id
     FROM sessions
     WHERE token_hash = ? AND expires_at > ?
     LIMIT 1`
  )
    .bind(tokenHash, now)
    .first<{ user_id: string }>();

  if (!session?.user_id) return c.json({ error: "Unauthorized" }, 401);

  c.set("userId", session.user_id);
  await next();
};

// ---- ROUTES ----
app.get("/api/health", (c) => c.json({ ok: true }));
app.get("/api/categories", async (c) => {
  const categories = await getCategories(c.env.DB);
  return c.json({ categories });
});

// ---- AUTH ----
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";

  if (!email || !password) {
    return c.json({ error: "Missing email/password" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, password_hash
     FROM users
     WHERE email = ?
     LIMIT 1`
  )
    .bind(email)
    .first<{ id: string; password_hash: string }>();

  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const candidate = await sha256(password + c.env.SESSION_SECRET);
  if (candidate !== user.password_hash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const sessionToken = uid();
  const tokenHash = await sha256(sessionToken + c.env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(uid(), user.id, tokenHash, expiresAt, now)
    .run();

  c.header("Set-Cookie", setCookie("session", sessionToken));
  return c.json({ ok: true });
});

app.post("/api/auth/logout", async (c) => {
  const token = getCookie(c.req.raw, "session");

  if (token) {
    const tokenHash = await sha256(token + c.env.SESSION_SECRET);
    await c.env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`)
      .bind(tokenHash)
      .run();
  }

  c.header("Set-Cookie", clearCookie("session"));
  return c.json({ ok: true });
});

app.get("/api/auth/me", requireUser, (c) => {
  return c.json({ ok: true, userId: c.get("userId") });
});

// ---- ACCOUNT (SHARED HOUSEHOLD) ----
app.get("/api/account", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const row = await c.env.DB.prepare(
    `SELECT bank_balance, anchor_balance, to_be_budgeted
     FROM account_state
     WHERE id = 'main'
     LIMIT 1`
  ).first<{ bank_balance: number; anchor_balance: number; to_be_budgeted: number }>();

  return c.json({
    bankBalance: Number(row?.bank_balance ?? 0),
    anchorBalance: Number(row?.anchor_balance ?? 0),
    toBeBudgeted: Number(row?.to_be_budgeted ?? 0),
  });
});

app.post("/api/account/set", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const body = await c.req.json<{ bankBalance?: number; anchorBalance?: number }>();

  const bank = body.bankBalance;
  const anchor = body.anchorBalance;

  if (typeof bank !== "number" || Number.isNaN(bank)) {
    return c.json({ error: "bankBalance must be a number" }, 400);
  }

  const now = new Date().toISOString();

  if (typeof anchor === "number" && !Number.isNaN(anchor)) {
    await c.env.DB.prepare(
      `UPDATE account_state
       SET bank_balance = ?, anchor_balance = ?, updated_at = ?
       WHERE id = 'main'`
    )
      .bind(bank, anchor, now)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE account_state
       SET bank_balance = ?, updated_at = ?
       WHERE id = 'main'`
    )
      .bind(bank, now)
      .run();
  }

  return c.json({ ok: true });
});

app.post("/api/account/reconcile", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const acct = await c.env.DB.prepare(
    `SELECT bank_balance
     FROM account_state
     WHERE id = 'main'
     LIMIT 1`
  ).first<{ bank_balance: number }>();

  const bankBalance = Number(acct?.bank_balance ?? 0);

  await c.env.DB.prepare(
    `UPDATE account_state
     SET anchor_balance = ?, updated_at = ?
     WHERE id = 'main'`
  )
    .bind(bankBalance, new Date().toISOString())
    .run();

  return c.json({ ok: true });
});

// ---- TOTALS (SHARED HOUSEHOLD) ----
app.get("/api/totals", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const incomeRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS totalIncome
     FROM manual_spends
     WHERE direction = 'in'`
  ).first<{ totalIncome: number }>();

  const validBudgetCategoryIds = CATEGORIES.filter((c) => c.id !== "income").map((c) => c.id);
  const placeholders = validBudgetCategoryIds.map(() => "?").join(",");

  const budgetRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_budgeted), 0) AS totalBudgeted
     FROM budget_lines
     WHERE category_id IN (${placeholders})`
  )
    .bind(...validBudgetCategoryIds)
    .first<{ totalBudgeted: number }>();

  const accountRow = await c.env.DB.prepare(
    `SELECT COALESCE(bank_balance, 0) AS bankBalance,
            COALESCE(to_be_budgeted, 0) AS toBeBudgeted
     FROM account_state
     WHERE id = 'main'
     LIMIT 1`
  ).first<{ bankBalance: number; toBeBudgeted: number }>();

  return c.json({
    bankBalance: Number(accountRow?.bankBalance ?? 0),
    totalIncome: Number(incomeRow?.totalIncome ?? 0),
    totalBudgeted: Number(budgetRow?.totalBudgeted ?? 0),
    toBeBudgeted: Number(accountRow?.toBeBudgeted ?? 0),
  });
});

// ---- BILLS (SHARED HOUSEHOLD, user_id kept as audit) ----
app.get("/api/bills", requireUser, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, user_id, name, amount, mode, due_date
     FROM bills
     ORDER BY due_date ASC`
  ).all<{ id: string; user_id: string; name: string; amount: number; mode: string; due_date: string }>();

  const payments = await c.env.DB.prepare(
    `SELECT bill_id, paid_date
     FROM bill_payments`
  ).all<{ bill_id: string; paid_date: string }>();

  const today = new Date().toISOString().slice(0, 10);
  const paidSet = new Set((payments.results ?? []).map((p) => `${p.bill_id}:${p.paid_date}`));

  return c.json({
    bills: (rows.results ?? []).map((b) => ({
      ...b,
      paidToday: paidSet.has(`${b.id}:${today}`),
    })),
  });
});

app.post("/api/bills", requireUser, async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    name?: string;
    amount?: number;
    mode?: "auto" | "manual";
    dueDate?: string;
  }>();

  const name = (body.name || "").trim();
  const amount = body.amount;
  const mode = body.mode;
  const dueDate = body.dueDate;

  if (
    !name ||
    typeof amount !== "number" ||
    Number.isNaN(amount) ||
    (mode !== "auto" && mode !== "manual") ||
    !dueDate
  ) {
    return c.json({ error: "Bad payload" }, 400);
  }

  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO bills (id, user_id, name, amount, mode, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, name, amount, mode, dueDate, new Date().toISOString())
    .run();

  return c.json({ ok: true, id });
});

app.post("/api/bills/:id/pay", requireUser, async (c) => {
  const id = c.req.param("id");
  const today = new Date().toISOString().slice(0, 10);

  const bill = await c.env.DB.prepare(
    `SELECT id
     FROM bills
     WHERE id = ?
     LIMIT 1`
  )
    .bind(id)
    .first<{ id: string }>();

  if (!bill) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare(
    `INSERT INTO bill_payments (id, bill_id, paid_date, created_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(uid(), id, today, new Date().toISOString())
    .run();

  return c.json({ ok: true });
});

app.delete("/api/bills/:id", requireUser, async (c) => {
  const id = c.req.param("id");

  await c.env.DB.prepare(`DELETE FROM bill_payments WHERE bill_id = ?`)
    .bind(id)
    .run();

  await c.env.DB.prepare(`DELETE FROM bills WHERE id = ?`)
    .bind(id)
    .run();

  return c.json({ ok: true });
});

// ---- BUDGET (SHARED HOUSEHOLD) ----
app.get("/api/budget/current", requireUser, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT category_id, amount_budgeted
     FROM budget_lines`
  ).all<{ category_id: string; amount_budgeted: number }>();

  const budget: Record<string, number> = {};
  for (const r of rows.results ?? []) {
    budget[r.category_id] = Number(r.amount_budgeted || 0);
  }

  return c.json({ budget });
});

app.post("/api/budget/set", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const body = await c.req.json<{ categoryId?: string; amount?: number }>();
  const categoryId = (body.categoryId || "").trim();
  const amount = body.amount;

  if (!categoryId || typeof amount !== "number" || Number.isNaN(amount)) {
    return c.json({ error: "Bad payload" }, 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT amount_budgeted
     FROM budget_lines
     WHERE category_id = ?
     LIMIT 1`
  )
    .bind(categoryId)
    .first<{ amount_budgeted: number }>();

  const oldAmount = Number(existing?.amount_budgeted ?? 0);
  const delta = Number(amount) - oldAmount;

  await c.env.DB.prepare(
    `INSERT INTO budget_lines (id, category_id, amount_budgeted)
     VALUES (?, ?, ?)
     ON CONFLICT(category_id) DO UPDATE SET
       amount_budgeted = excluded.amount_budgeted`
  )
    .bind(uid(), categoryId, amount)
    .run();

  await c.env.DB.prepare(
    `UPDATE account_state
     SET to_be_budgeted = to_be_budgeted - ?,
         updated_at = ?
     WHERE id = 'main'`
  )
    .bind(delta, new Date().toISOString())
    .run();

  return c.json({ ok: true });
});

app.post("/api/budget/adjust", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const body = await c.req.json<{ categoryId?: string; delta?: number }>();
  const categoryId = (body.categoryId || "").trim();
  const delta = body.delta;

  if (!categoryId || typeof delta !== "number" || Number.isNaN(delta)) {
    return c.json({ error: "Bad payload" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO budget_lines (id, category_id, amount_budgeted)
     VALUES (?, ?, 0)
     ON CONFLICT(category_id) DO NOTHING`
  )
    .bind(uid(), categoryId)
    .run();

  await c.env.DB.prepare(
    `UPDATE budget_lines
     SET amount_budgeted = amount_budgeted + ?
     WHERE category_id = ?`
  )
    .bind(delta, categoryId)
    .run();

  await c.env.DB.prepare(
    `UPDATE account_state
     SET to_be_budgeted = to_be_budgeted - ?,
         updated_at = ?
     WHERE id = 'main'`
  )
    .bind(delta, new Date().toISOString())
    .run();

  return c.json({ ok: true });
});

// ---- SPEND (SHARED HOUSEHOLD, user_id kept as audit) ----
app.get("/api/spend", requireUser, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, user_id, category_id, amount, date, note, direction, created_at
     FROM manual_spends
     ORDER BY date DESC, created_at DESC
     LIMIT 200`
  ).all<{
    id: string;
    user_id: string;
    category_id: string;
    amount: number;
    date: string;
    note: string | null;
    direction: "in" | "out";
    created_at: string;
  }>();

  return c.json({ spends: rows.results ?? [] });
});

app.post("/api/spend", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const userId = c.get("userId");

  const body = await c.req.json<{
    categoryId?: string;
    amount?: number;
    date?: string;
    note?: string;
    direction?: "in" | "out";
  }>();

  const categoryId = (body.categoryId || "").trim();
  const amount = body.amount;
  const date = (body.date || "").trim();
  const note = body.note ?? null;
  const direction: "in" | "out" = body.direction === "in" ? "in" : "out";

  if (!categoryId || typeof amount !== "number" || Number.isNaN(amount) || amount < 0 || !date) {
    return c.json({ error: "Bad payload" }, 400);
  }

  if (direction === "in" && categoryId !== "income") {
    return c.json({ error: "Income entries must use the income category" }, 400);
  }

  if (direction === "out" && categoryId === "income") {
    return c.json({ error: "Outflow entries cannot use the income category" }, 400);
  }

  const now = new Date().toISOString();
  const spendId = uid();

  await c.env.DB.prepare(
    `INSERT INTO manual_spends (id, user_id, category_id, amount, date, note, direction, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(spendId, userId, categoryId, amount, date, note, direction, now)
    .run();

  if (direction === "in") {
    await c.env.DB.prepare(
      `UPDATE account_state
       SET bank_balance = bank_balance + ?,
           to_be_budgeted = to_be_budgeted + ?,
           updated_at = ?
       WHERE id = 'main'`
    )
      .bind(amount, amount, now)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE account_state
       SET bank_balance = bank_balance - ?,
           updated_at = ?
       WHERE id = 'main'`
    )
      .bind(amount, now)
      .run();
  }

  return c.json({ ok: true, id: spendId });
});

app.delete("/api/spend/:id", requireUser, async (c) => {
  await ensureAccountState(c.env.DB);

  const spendId = c.req.param("id");

  const existing = await c.env.DB.prepare(
    `SELECT id, amount, direction
     FROM manual_spends
     WHERE id = ?
     LIMIT 1`
  )
    .bind(spendId)
    .first<{ id: string; amount: number; direction: "in" | "out" }>();

  if (!existing) {
    return c.json({ error: "Not found" }, 404);
  }

  await c.env.DB.prepare(`DELETE FROM manual_spends WHERE id = ?`)
    .bind(spendId)
    .run();

  const now = new Date().toISOString();
  const amount = Number(existing.amount || 0);

  if (existing.direction === "in") {
    await c.env.DB.prepare(
      `UPDATE account_state
       SET bank_balance = bank_balance - ?,
           to_be_budgeted = to_be_budgeted - ?,
           updated_at = ?
       WHERE id = 'main'`
    )
      .bind(amount, amount, now)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE account_state
       SET bank_balance = bank_balance + ?,
           updated_at = ?
       WHERE id = 'main'`
    )
      .bind(amount, now)
      .run();
  }

  return c.json({ ok: true });
});

app.get("/api/spend/summary", requireUser, async (c) => {
  const activityRows = await c.env.DB.prepare(
    `SELECT
        category_id,
        COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS activity
     FROM manual_spends
     WHERE category_id != 'income'
     GROUP BY category_id`
  ).all<{ category_id: string; activity: number }>();

  const budgetRows = await c.env.DB.prepare(
    `SELECT category_id, amount_budgeted
     FROM budget_lines`
  ).all<{ category_id: string; amount_budgeted: number }>();

  const activityByCategory: Record<string, number> = {};
  const budgetByCategory: Record<string, number> = {};

  for (const r of activityRows.results ?? []) {
    activityByCategory[r.category_id] = Number(r.activity || 0);
  }

  for (const r of budgetRows.results ?? []) {
    budgetByCategory[r.category_id] = Number(r.amount_budgeted || 0);
  }

  const byCategory = CATEGORIES
    .filter((cat) => cat.id !== "income")
    .map((cat) => {
      const budgeted = budgetByCategory[cat.id] || 0;
      const activity = activityByCategory[cat.id] || 0;
      const available = budgeted - activity;

      return {
        ...cat,
        budgeted,
        activity,
        available,
      };
    });

  return c.json({ byCategory });
});

// ---- GOALS (PERSONAL) ----
app.get("/api/goals", requireUser, async (c) => {
  const userId = c.get("userId");

  const rows = await c.env.DB.prepare(
    `SELECT id, title, status, due_date, notes, created_at, updated_at
     FROM goals
     WHERE user_id = ?
     ORDER BY
       CASE WHEN status = 'active' THEN 0 ELSE 1 END,
       COALESCE(due_date, '9999-12-31') ASC,
       created_at DESC`
  )
    .bind(userId)
    .all<{
      id: string;
      title: string;
      status: "active" | "done";
      due_date: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>();

  return c.json({ goals: rows.results ?? [] });
});

app.post("/api/goals", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ title?: string; dueDate?: string; notes?: string }>();

  const title = (body.title || "").trim();
  const dueDate = (body.dueDate || "").trim() || null;
  const notes = (body.notes || "").trim() || null;

  if (!title) return c.json({ error: "Missing title" }, 400);

  const now = new Date().toISOString();
  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO goals (id, user_id, title, status, due_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
  )
    .bind(id, userId, title, dueDate, notes, now, now)
    .run();

  return c.json({ ok: true, id });
});

app.patch("/api/goals/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const body = await c.req.json<{
    title?: string;
    dueDate?: string | null;
    notes?: string | null;
    status?: "active" | "done";
  }>();

  const existing = await c.env.DB.prepare(
    `SELECT id
     FROM goals
     WHERE id = ? AND user_id = ?
     LIMIT 1`
  )
    .bind(id, userId)
    .first<{ id: string }>();

  if (!existing) return c.json({ error: "Not found" }, 404);

  const now = new Date().toISOString();
  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.title !== undefined) {
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "Title cannot be empty" }, 400);
    sets.push("title = ?");
    binds.push(title);
  }

  if (body.dueDate !== undefined) {
    sets.push("due_date = ?");
    binds.push(body.dueDate ? body.dueDate.trim() : null);
  }

  if (body.notes !== undefined) {
    sets.push("notes = ?");
    binds.push(body.notes ? body.notes.trim() : null);
  }

  if (body.status !== undefined) {
    sets.push("status = ?");
    binds.push(body.status);
  }

  sets.push("updated_at = ?");
  binds.push(now);

  await c.env.DB.prepare(
    `UPDATE goals
     SET ${sets.join(", ")}
     WHERE id = ? AND user_id = ?`
  )
    .bind(...binds, id, userId)
    .run();

  return c.json({ ok: true });
});

app.delete("/api/goals/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  await c.env.DB.prepare(
    `DELETE FROM goals
     WHERE id = ? AND user_id = ?`
  )
    .bind(id, userId)
    .run();

  return c.json({ ok: true });
});

// ---- DEBTS (PERSONAL) ----
type DebtRow = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  payment: number;
  created_at: string;
  updated_at: string;
};

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

app.get("/api/debts", requireUser, async (c) => {
  const userId = c.get("userId");

  const rows = await c.env.DB.prepare(
    `SELECT id, name, balance, apr, payment, created_at, updated_at
     FROM debts
     WHERE user_id = ?
     ORDER BY created_at DESC`
  )
    .bind(userId)
    .all<DebtRow>();

  return c.json({ debts: rows.results ?? [] });
});

app.post("/api/debts", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    name?: string;
    balance?: number;
    apr?: number;
    payment?: number;
  }>();

  const name = (body.name || "").trim();
  const balance = Number(body.balance);
  const apr = Number(body.apr);
  const payment = Number(body.payment);

  if (!name || Number.isNaN(balance) || Number.isNaN(apr) || Number.isNaN(payment)) {
    return c.json({ error: "Bad payload" }, 400);
  }

  const now = new Date().toISOString();
  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO debts (id, user_id, name, balance, apr, payment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, name, balance, apr, payment, now, now)
    .run();

  return c.json({ ok: true, id });
});

app.patch("/api/debts/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const body = await c.req.json<{
    name?: string;
    balance?: number;
    apr?: number;
    payment?: number;
  }>();

  const existing = await c.env.DB.prepare(
    `SELECT id
     FROM debts
     WHERE id = ? AND user_id = ?
     LIMIT 1`
  )
    .bind(id, userId)
    .first<{ id: string }>();

  if (!existing) return c.json({ error: "Not found" }, 404);

  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.name !== undefined) {
    const name = (body.name || "").trim();
    if (!name) return c.json({ error: "Name cannot be empty" }, 400);
    sets.push("name = ?");
    binds.push(name);
  }

  if (body.balance !== undefined) {
    const n = Number(body.balance);
    if (Number.isNaN(n)) return c.json({ error: "balance must be a number" }, 400);
    sets.push("balance = ?");
    binds.push(n);
  }

  if (body.apr !== undefined) {
    const n = Number(body.apr);
    if (Number.isNaN(n)) return c.json({ error: "apr must be a number" }, 400);
    sets.push("apr = ?");
    binds.push(n);
  }

  if (body.payment !== undefined) {
    const n = Number(body.payment);
    if (Number.isNaN(n)) return c.json({ error: "payment must be a number" }, 400);
    sets.push("payment = ?");
    binds.push(n);
  }

  const now = new Date().toISOString();
  sets.push("updated_at = ?");
  binds.push(now);

  await c.env.DB.prepare(
    `UPDATE debts
     SET ${sets.join(", ")}
     WHERE id = ? AND user_id = ?`
  )
    .bind(...binds, id, userId)
    .run();

  return c.json({ ok: true });
});

app.delete("/api/debts/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  await c.env.DB.prepare(
    `DELETE FROM debts
     WHERE id = ? AND user_id = ?`
  )
    .bind(id, userId)
    .run();

  return c.json({ ok: true });
});

app.get("/api/debts/settings", requireUser, async (c) => {
  const userId = c.get("userId");

  const row = await c.env.DB.prepare(
    `SELECT extra_monthly
     FROM debt_settings
     WHERE user_id = ?
     LIMIT 1`
  )
    .bind(userId)
    .first<{ extra_monthly: number }>();

  return c.json({ extraMonthly: Number(row?.extra_monthly ?? 0) });
});

app.post("/api/debts/settings", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ extraMonthly?: number }>();

  const n = Number(body.extraMonthly);
  if (Number.isNaN(n) || n < 0) {
    return c.json({ error: "extraMonthly must be a number >= 0" }, 400);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO debt_settings (user_id, extra_monthly, strategy, created_at, updated_at)
     VALUES (?, ?, 'snowball', ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       extra_monthly = excluded.extra_monthly,
       updated_at = excluded.updated_at`
  )
    .bind(userId, n, now, now)
    .run();

  return c.json({ ok: true });
});

app.post("/api/debts/:id/plan", requireUser, async (c) => {
  const userId = c.get("userId");
  const debtId = c.req.param("id");

  const body = await c.req.json<{ month?: string; plannedPayment?: number }>();

  const month = (body.month || monthKey()).trim();
  const plannedPayment = body.plannedPayment;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "month must be YYYY-MM" }, 400);
  }

  if (typeof plannedPayment !== "number" || Number.isNaN(plannedPayment) || plannedPayment < 0) {
    return c.json({ error: "plannedPayment must be a number" }, 400);
  }

  const exists = await c.env.DB.prepare(
    `SELECT id
     FROM debts
     WHERE id = ? AND user_id = ?
     LIMIT 1`
  )
    .bind(debtId, userId)
    .first<{ id: string }>();

  if (!exists) return c.json({ error: "Not found" }, 404);

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO debt_payment_plans (id, user_id, debt_id, month, planned_payment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, debt_id, month) DO UPDATE SET
       planned_payment = excluded.planned_payment,
       updated_at = excluded.updated_at`
  )
    .bind(uid(), userId, debtId, month, plannedPayment, now, now)
    .run();

  return c.json({ ok: true });
});

// ---- CALENDAR (PERSONAL) ----
app.get("/api/calendar/upcoming", requireUser, async (c) => {
  const userId = c.get("userId");
  const days = Math.max(1, Math.min(30, Number(c.req.query("days") || "7")));

  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const nowIso = now.toISOString();
  const endIso = end.toISOString();

  const rows = await c.env.DB.prepare(
    `SELECT id, title, start_at, end_at, location, notes
     FROM calendar_events
     WHERE user_id = ?
       AND start_at >= ?
       AND start_at < ?
     ORDER BY start_at ASC`
  )
    .bind(userId, nowIso, endIso)
    .all<{
      id: string;
      title: string;
      start_at: string;
      end_at: string | null;
      location: string | null;
      notes: string | null;
    }>();

  return c.json({ events: rows.results ?? [] });
});

app.post("/api/calendar", requireUser, async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    title?: string;
    startAt?: string;
    endAt?: string | null;
    location?: string;
    notes?: string;
  }>();

  const title = (body.title || "").trim();
  const startAt = (body.startAt || "").trim();
  const endAt = body.endAt ? body.endAt.trim() : null;
  const location = (body.location || "").trim() || null;
  const notes = (body.notes || "").trim() || null;

  if (!title || !startAt) {
    return c.json({ error: "Missing title/startAt" }, 400);
  }

  const now = new Date().toISOString();
  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO calendar_events (id, user_id, title, start_at, end_at, location, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, title, startAt, endAt, location, notes, now, now)
    .run();

  return c.json({ ok: true, id });
});

app.delete("/api/calendar/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  await c.env.DB.prepare(
    `DELETE FROM calendar_events
     WHERE id = ? AND user_id = ?`
  )
    .bind(id, userId)
    .run();

  return c.json({ ok: true });
});

// ---- HOME UPCOMING (PERSONAL BILLS + PERSONAL EVENTS) ----
app.get("/api/home/upcoming", requireUser, async (c) => {
  const userId = c.get("userId");

  const billsDays = Math.max(1, Math.min(14, Number(c.req.query("billsDays") || "3")));
  const calDays = Math.max(1, Math.min(30, Number(c.req.query("calDays") || "7")));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const billsEnd = new Date(today.getTime() + billsDays * 24 * 60 * 60 * 1000);
  const billsEndStr = billsEnd.toISOString().slice(0, 10);

  const billsRows = await c.env.DB.prepare(
    `SELECT id, name, mode, due_date
     FROM bills
     WHERE user_id = ?
       AND due_date >= ?
       AND due_date <= ?
     ORDER BY due_date ASC`
  )
    .bind(userId, today.toISOString().slice(0, 10), billsEndStr)
    .all<{ id: string; name: string; mode: "auto" | "manual"; due_date: string }>();

  const now = new Date();
  const calEnd = new Date(now.getTime() + calDays * 24 * 60 * 60 * 1000);

  const eventsRows = await c.env.DB.prepare(
    `SELECT id, title, start_at, end_at, location
     FROM calendar_events
     WHERE user_id = ?
       AND start_at >= ?
       AND start_at < ?
     ORDER BY start_at ASC`
  )
    .bind(userId, now.toISOString(), calEnd.toISOString())
    .all<{ id: string; title: string; start_at: string; end_at: string | null; location: string | null }>();

  return c.json({
    bills: billsRows.results ?? [],
    events: eventsRows.results ?? [],
  });
});

app.get("/api/calendar/range", requireUser, async (c) => {
  const userId = c.get("userId");

  const start = (c.req.query("start") || "").trim();
  const end = (c.req.query("end") || "").trim();

  if (!start || !end) {
    return c.json({ error: "Missing start/end" }, 400);
  }

  const billsRows = await c.env.DB.prepare(
    `SELECT id, name, mode, due_date
     FROM bills
     WHERE user_id = ?
       AND due_date >= ?
       AND due_date < ?
     ORDER BY due_date ASC`
  )
    .bind(userId, start, end)
    .all<{ id: string; name: string; mode: "auto" | "manual"; due_date: string }>();

  const startIso = `${start}T00:00:00.000Z`;
  const endIso = `${end}T00:00:00.000Z`;

  const eventsRows = await c.env.DB.prepare(
    `SELECT id, title, start_at, end_at, location, notes
     FROM calendar_events
     WHERE user_id = ?
       AND start_at >= ?
       AND start_at < ?
     ORDER BY start_at ASC`
  )
    .bind(userId, startIso, endIso)
    .all<{
      id: string;
      title: string;
      start_at: string;
      end_at: string | null;
      location: string | null;
      notes: string | null;
    }>();

  return c.json({
    bills: billsRows.results ?? [],
    events: eventsRows.results ?? [],
  });
});

export default {
  fetch: app.fetch,
};
