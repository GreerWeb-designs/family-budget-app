/// <reference types="@cloudflare/workers-types" />

import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { Resend } from "resend";

type Bindings = {
  DB: D1Database;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
  ADMIN_EMAIL: string;
  RESEND_FROM_EMAIL: string;
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

// ---- HELPERS ----

const uid = () => crypto.randomUUID();

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

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

/** Ensure one account_state row exists per household (id = householdId). */
async function ensureAccountState(db: D1Database, householdId: string) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO account_state (id, bank_balance, anchor_balance, to_be_budgeted, updated_at)
       VALUES (?, 0, 0, 0, ?)`
    )
    .bind(householdId, new Date().toISOString())
    .run();
}

async function getUserHouseholdId(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT household_id FROM household_members WHERE user_id = ? LIMIT 1`
  ).bind(userId).first<{ household_id: string }>();
  return row?.household_id ?? null;
}

/**
 * Like getUserHouseholdId but creates a fallback personal household if the user
 * somehow has no household record (guards against edge cases in shared-data routes).
 */
async function getOrCreateHouseholdId(db: D1Database, userId: string): Promise<string> {
  const existing = await getUserHouseholdId(db, userId);
  if (existing) return existing;

  const householdId = uid();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)`)
    .bind(householdId, "My Household", now).run();
  await db.prepare(
    `INSERT INTO household_members (id, household_id, user_id, role, joined_at) VALUES (?, ?, ?, 'admin', ?)`
  ).bind(uid(), householdId, userId, now).run();
  return householdId;
}

/** Returns categories for the given household (household-scoped). */
async function getCategories(db: D1Database, householdId: string) {
  const rows = await db
    .prepare(`SELECT id, name, direction FROM categories WHERE household_id = ? ORDER BY name ASC`)
    .bind(householdId)
    .all<{ id: string; name: string; direction: string }>();
  return rows.results ?? [];
}

const requireUser: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const token = getCookie(c.req.raw, "session");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const tokenHash = await sha256(token + c.env.SESSION_SECRET);
  const now = new Date().toISOString();

  const session = await c.env.DB.prepare(
    `SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1`
  )
    .bind(tokenHash, now)
    .first<{ user_id: string }>();

  if (!session?.user_id) return c.json({ error: "Unauthorized" }, 401);

  c.set("userId", session.user_id);
  await next();
};

// ---- HEALTH ----
app.get("/api/health", (c) => c.json({ ok: true }));

// ---- CATEGORIES (household-scoped) ----
app.get("/api/categories", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  const categories = await getCategories(c.env.DB, householdId);
  return c.json({ categories });
});

app.post("/api/categories", requireUser, async (c) => {
  const body = await c.req.json<{ name?: string; direction?: "inflow" | "outflow" }>();
  const name = (body.name || "").trim();
  const direction = body.direction === "inflow" ? "inflow" : "outflow";

  if (!name) return c.json({ error: "Category name is required" }, 400);

  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);

  const existing = await c.env.DB.prepare(
    `SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND household_id = ? LIMIT 1`
  )
    .bind(name, householdId)
    .first<{ id: string }>();

  if (existing) return c.json({ error: "A category with that name already exists" }, 400);

  const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseId) return c.json({ error: "Invalid category name" }, 400);
  const id = `${userId.slice(0, 8)}_${baseId}`;

  await c.env.DB.prepare(
    `INSERT INTO categories (id, name, direction, user_id, household_id) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, name, direction, userId, householdId)
    .run();

  return c.json({ ok: true, id });
});

app.delete("/api/categories/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const id = c.req.param("id");

  const inSpends = await c.env.DB.prepare(
    `SELECT category_id FROM manual_spends WHERE category_id = ? LIMIT 1`
  )
    .bind(id)
    .first<{ category_id: string }>();

  if (inSpends) {
    return c.json({ error: "Cannot delete a category that has transaction history" }, 400);
  }

  const budgetRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_budgeted), 0) AS amount_budgeted FROM budget_lines WHERE category_id = ?`
  )
    .bind(id)
    .first<{ amount_budgeted: number }>();

  const amountBudgeted = Number(budgetRow?.amount_budgeted ?? 0);

  if (amountBudgeted !== 0) {
    await c.env.DB.prepare(
      `UPDATE account_state SET to_be_budgeted = to_be_budgeted + ?, updated_at = ? WHERE id = ?`
    )
      .bind(amountBudgeted, new Date().toISOString(), householdId)
      .run();
  }

  await c.env.DB.prepare(`DELETE FROM budget_lines WHERE category_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM categories WHERE id = ? AND household_id = ?`).bind(id, householdId).run();

  return c.json({ ok: true });
});

// ---- AUTH ----
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";

  if (!email || !password) return c.json({ error: "Missing email/password" }, 400);

  const user = await c.env.DB.prepare(
    `SELECT id, password_hash FROM users WHERE email = ? LIMIT 1`
  )
    .bind(email)
    .first<{ id: string; password_hash: string }>();

  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const candidate = await sha256(password + c.env.SESSION_SECRET);
  if (candidate !== user.password_hash) return c.json({ error: "Invalid credentials" }, 401);

  const sessionToken = uid();
  const tokenHash = await sha256(sessionToken + c.env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
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
    await c.env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
  }
  c.header("Set-Cookie", clearCookie("session"));
  return c.json({ ok: true });
});

app.get("/api/auth/me", requireUser, async (c) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare(
    `SELECT id, name, email, onboarding_completed_at FROM users WHERE id = ? LIMIT 1`
  ).bind(userId).first<{ id: string; name: string; email: string; onboarding_completed_at: string | null }>();
  return c.json({
    ok: true,
    userId,
    name: user?.name ?? "",
    email: user?.email ?? "",
    onboardingCompletedAt: user?.onboarding_completed_at ?? null,
  });
});

app.post("/api/auth/signup", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string; password?: string }>();
  const name = (body.name || "").trim();
  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";

  if (!name || !email || !password) return c.json({ error: "Name, email, and password are required" }, 400);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "Invalid email address" }, 400);

  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`)
    .bind(email).first<{ id: string }>();
  if (existing) return c.json({ error: "An account with that email already exists" }, 400);

  const passwordHash = await sha256(password + c.env.SESSION_SECRET);
  const now = new Date().toISOString();
  const userId = uid();

  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, email_verified, created_at) VALUES (?, ?, ?, ?, 0, ?)`
  ).bind(userId, name, email, passwordHash, now).run();

  const householdId = uid();
  await c.env.DB.prepare(`INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)`)
    .bind(householdId, `${name}'s Household`, now).run();
  await c.env.DB.prepare(
    `INSERT INTO household_members (id, household_id, user_id, role, joined_at) VALUES (?, ?, ?, 'admin', ?)`
  ).bind(uid(), householdId, userId, now).run();

  // Seed account_state keyed by householdId (shared across household members)
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO account_state (id, bank_balance, anchor_balance, to_be_budgeted, updated_at) VALUES (?, 0, 0, 0, ?)`
  ).bind(householdId, now).run();

  // Seed budget_months for the current month
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO budget_months (month, household_id, created_at) VALUES (?, ?, ?)`
  ).bind(monthKey(), householdId, now).run();

  // Seed default categories keyed by householdId
  const defaultCategories = [
    { id: "income",         name: "Income",         direction: "inflow"  },
    { id: "housing",        name: "Housing",         direction: "outflow" },
    { id: "groceries",      name: "Groceries",       direction: "outflow" },
    { id: "transportation", name: "Transportation",  direction: "outflow" },
    { id: "utilities",      name: "Utilities",       direction: "outflow" },
    { id: "health",         name: "Health",          direction: "outflow" },
    { id: "personal",       name: "Personal",        direction: "outflow" },
    { id: "entertainment",  name: "Entertainment",   direction: "outflow" },
    { id: "savings",        name: "Savings",         direction: "outflow" },
    { id: "miscellaneous",  name: "Miscellaneous",   direction: "outflow" },
  ];
  for (const cat of defaultCategories) {
    const catId = `${householdId.slice(0, 8)}_${cat.id}`;
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO categories (id, name, direction, user_id, household_id) VALUES (?, ?, ?, ?, ?)`
    ).bind(catId, cat.name, cat.direction, userId, householdId).run();
  }

  const sessionToken = uid();
  const tokenHash = await sha256(sessionToken + c.env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(uid(), userId, tokenHash, expiresAt, now).run();

  c.header("Set-Cookie", setCookie("session", sessionToken));

  // Admin notification — fire-and-forget, never blocks signup
  const householdName = `${name}'s Household`;
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const resend = new Resend(c.env.RESEND_API_KEY);
        await resend.emails.send({
          from: c.env.RESEND_FROM_EMAIL,
          to:   c.env.ADMIN_EMAIL,
          subject: "New signup: FamilyBudgetApp",
          html: `
            <p>A new user just signed up for FamilyBudgetApp.</p>
            <ul>
              <li><strong>Display name:</strong> ${name}</li>
              <li><strong>Household created:</strong> ${householdName}</li>
              <li><strong>Signed up at:</strong> ${now} (UTC)</li>
            </ul>
          `.trim(),
        });
      } catch (err) {
        console.error("[resend] Admin notification failed:", err);
      }
    })()
  );

  return c.json({ ok: true, userId, name });
});

app.post("/api/auth/forgot-password", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = (body.email || "").toLowerCase().trim();
  if (!email) return c.json({ error: "Email required" }, 400);

  const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`)
    .bind(email).first<{ id: string }>();
  if (!user) return c.json({ ok: true }); // prevent email enumeration

  const token = uid() + uid();
  const tokenHash = await sha256(token + c.env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)`
  ).bind(uid(), user.id, tokenHash, expiresAt, now).run();

  return c.json({ ok: true, devToken: token });
});

app.post("/api/auth/reset-password", async (c) => {
  const body = await c.req.json<{ token?: string; password?: string }>();
  const token = (body.token || "").trim();
  const password = body.password || "";
  if (!token || !password) return c.json({ error: "Token and password required" }, 400);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);

  const tokenHash = await sha256(token + c.env.SESSION_SECRET);
  const now = new Date().toISOString();

  const resetToken = await c.env.DB.prepare(
    `SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ? AND used = 0 LIMIT 1`
  ).bind(tokenHash, now).first<{ id: string; user_id: string }>();
  if (!resetToken) return c.json({ error: "Invalid or expired reset link" }, 400);

  const passwordHash = await sha256(password + c.env.SESSION_SECRET);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .bind(passwordHash, resetToken.user_id).run();
  await c.env.DB.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE id = ?`)
    .bind(resetToken.id).run();

  return c.json({ ok: true });
});

// ---- ACCOUNT (household-scoped) ----
app.get("/api/account", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const row = await c.env.DB.prepare(
    `SELECT bank_balance, anchor_balance, to_be_budgeted FROM account_state WHERE id = ? LIMIT 1`
  ).bind(householdId).first<{ bank_balance: number; anchor_balance: number; to_be_budgeted: number }>();

  return c.json({
    bankBalance:    Number(row?.bank_balance    ?? 0),
    anchorBalance:  Number(row?.anchor_balance  ?? 0),
    toBeBudgeted:   Number(row?.to_be_budgeted  ?? 0),
  });
});

app.post("/api/account/set", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const body = await c.req.json<{ bankBalance?: number }>();
  const bank = body.bankBalance;

  if (typeof bank !== "number" || Number.isNaN(bank)) {
    return c.json({ error: "bankBalance must be a number" }, 400);
  }

  const categories = await getCategories(c.env.DB, householdId);
  const validIds = categories.filter((c) => c.direction !== "inflow").map((c) => c.id);
  let totalBudgeted = 0;

  if (validIds.length > 0) {
    const placeholders = validIds.map(() => "?").join(",");
    const budgetRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_budgeted), 0) AS totalBudgeted FROM budget_lines WHERE category_id IN (${placeholders}) AND month = ?`
    )
      .bind(...validIds, monthKey())
      .first<{ totalBudgeted: number }>();
    totalBudgeted = Number(budgetRow?.totalBudgeted ?? 0);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE account_state SET bank_balance = ?, to_be_budgeted = ?, updated_at = ? WHERE id = ?`
  )
    .bind(bank, bank - totalBudgeted, now, householdId)
    .run();

  return c.json({ ok: true });
});

app.post("/api/account/reconcile", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const acct = await c.env.DB.prepare(
    `SELECT bank_balance FROM account_state WHERE id = ? LIMIT 1`
  ).bind(householdId).first<{ bank_balance: number }>();

  await c.env.DB.prepare(
    `UPDATE account_state SET anchor_balance = ?, updated_at = ? WHERE id = ?`
  )
    .bind(Number(acct?.bank_balance ?? 0), new Date().toISOString(), householdId)
    .run();

  return c.json({ ok: true });
});

// ---- ONBOARDING ----

app.post("/api/onboarding/complete", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  const body = await c.req.json<{ quizAnswers?: Record<string, string>; startingBalance?: number | null }>();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE users SET onboarding_completed_at = ?, onboarding_quiz_answers = ?, starting_balance = ? WHERE id = ?`
  ).bind(
    now,
    body.quizAnswers ? JSON.stringify(body.quizAnswers) : null,
    typeof body.startingBalance === "number" && !Number.isNaN(body.startingBalance) ? body.startingBalance : null,
    userId,
  ).run();

  // Set live bank balance in account_state (household-scoped) if provided
  const bank = typeof body.startingBalance === "number" && !Number.isNaN(body.startingBalance) && body.startingBalance > 0
    ? body.startingBalance
    : null;

  if (bank !== null) {
    await ensureAccountState(c.env.DB, householdId);
    const categories = await getCategories(c.env.DB, householdId);
    const validIds = categories.filter((cat) => cat.direction !== "inflow").map((cat) => cat.id);
    let totalBudgeted = 0;
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?").join(",");
      const budgetRow = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(amount_budgeted), 0) AS totalBudgeted FROM budget_lines WHERE category_id IN (${placeholders}) AND month = ?`
      ).bind(...validIds, monthKey()).first<{ totalBudgeted: number }>();
      totalBudgeted = Number(budgetRow?.totalBudgeted ?? 0);
    }
    await c.env.DB.prepare(
      `UPDATE account_state SET bank_balance = ?, to_be_budgeted = ?, updated_at = ? WHERE id = ?`
    ).bind(bank, bank - totalBudgeted, now, householdId).run();
  }

  return c.json({ ok: true, completedAt: now });
});

app.post("/api/onboarding/reset", requireUser, async (c) => {
  const userId = c.get("userId");
  await c.env.DB.prepare(
    `UPDATE users SET onboarding_completed_at = NULL, onboarding_quiz_answers = NULL, starting_balance = NULL WHERE id = ?`
  ).bind(userId).run();
  return c.json({ ok: true });
});

// ---- TOTALS (household-scoped) ----
app.get("/api/totals", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);

  const incomeRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM manual_spends WHERE direction = 'in' AND household_id = ?`
  ).bind(householdId).first<{ totalIncome: number }>();

  const categories = await getCategories(c.env.DB, householdId);
  const validIds = categories.filter((c) => c.direction !== "inflow").map((c) => c.id);
  let totalBudgeted = 0;

  if (validIds.length > 0) {
    const placeholders = validIds.map(() => "?").join(",");
    const budgetRow = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_budgeted), 0) AS totalBudgeted FROM budget_lines WHERE category_id IN (${placeholders}) AND month = ?`
    )
      .bind(...validIds, monthKey())
      .first<{ totalBudgeted: number }>();
    totalBudgeted = Number(budgetRow?.totalBudgeted ?? 0);
  }

  const accountRow = await c.env.DB.prepare(
    `SELECT COALESCE(bank_balance, 0) AS bankBalance, COALESCE(to_be_budgeted, 0) AS toBeBudgeted FROM account_state WHERE id = ? LIMIT 1`
  ).bind(householdId).first<{ bankBalance: number; toBeBudgeted: number }>();

  return c.json({
    bankBalance:    Number(accountRow?.bankBalance   ?? 0),
    totalIncome:    Number(incomeRow?.totalIncome    ?? 0),
    totalBudgeted,
    toBeBudgeted:   Number(accountRow?.toBeBudgeted  ?? 0),
  });
});

// ---- BILLS (already household-scoped — unchanged) ----
app.get("/api/bills", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ bills: [] });

  const rows = await c.env.DB.prepare(
    `SELECT id, user_id, name, amount, mode, day_of_month FROM bills WHERE household_id = ? ORDER BY day_of_month ASC`
  ).bind(householdId).all<{ id: string; user_id: string; name: string; amount: number; mode: string; day_of_month: number }>();

  return c.json({ bills: rows.results ?? [] });
});

app.post("/api/bills", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{ name?: string; amount?: number; mode?: "auto" | "manual"; dayOfMonth?: number }>();
  const name = (body.name || "").trim();
  const amount = body.amount;
  const mode = body.mode;
  const dayOfMonth = body.dayOfMonth;

  if (
    !name ||
    typeof amount !== "number" || Number.isNaN(amount) ||
    (mode !== "auto" && mode !== "manual") ||
    typeof dayOfMonth !== "number" || dayOfMonth < 1 || dayOfMonth > 31
  ) {
    return c.json({ error: "Bad payload" }, 400);
  }

  const id = uid();
  const now = new Date();
  const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

  await c.env.DB.prepare(
    `INSERT INTO bills (id, user_id, household_id, name, amount, mode, due_date, day_of_month, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, householdId, name, amount, mode, dueDate, dayOfMonth, now.toISOString()).run();

  return c.json({ ok: true, id });
});

app.delete("/api/bills/:id", requireUser, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM bills WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

// ---- BUDGET (household-scoped) ----
app.get("/api/budget/current", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  const month = (c.req.query("month") || "").trim() || monthKey();

  const rows = await c.env.DB.prepare(
    `SELECT category_id, amount_budgeted FROM budget_lines WHERE month = ? AND household_id = ?`
  )
    .bind(month, householdId)
    .all<{ category_id: string; amount_budgeted: number }>();

  const budget: Record<string, number> = {};
  for (const r of rows.results ?? []) {
    budget[r.category_id] = Number(r.amount_budgeted || 0);
  }

  return c.json({ budget, month });
});

app.post("/api/budget/set", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const body = await c.req.json<{ categoryId?: string; amount?: number; month?: string }>();
  const categoryId = (body.categoryId || "").trim();
  const amount = body.amount;
  const month = (body.month || "").trim() || monthKey();

  if (!categoryId || typeof amount !== "number" || Number.isNaN(amount)) {
    return c.json({ error: "Bad payload" }, 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT amount_budgeted FROM budget_lines WHERE category_id = ? AND month = ? LIMIT 1`
  )
    .bind(categoryId, month)
    .first<{ amount_budgeted: number }>();

  const oldAmount = Number(existing?.amount_budgeted ?? 0);
  const delta = Number(amount) - oldAmount;

  await c.env.DB.prepare(
    `INSERT INTO budget_lines (id, category_id, amount_budgeted, month, household_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(category_id, month) DO UPDATE SET amount_budgeted = excluded.amount_budgeted`
  )
    .bind(uid(), categoryId, amount, month, householdId)
    .run();

  await c.env.DB.prepare(
    `UPDATE account_state SET to_be_budgeted = to_be_budgeted - ?, updated_at = ? WHERE id = ?`
  )
    .bind(delta, new Date().toISOString(), householdId)
    .run();

  return c.json({ ok: true });
});

app.post("/api/budget/adjust", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const body = await c.req.json<{ categoryId?: string; delta?: number; month?: string }>();
  const categoryId = (body.categoryId || "").trim();
  const delta = body.delta;
  const month = (body.month || "").trim() || monthKey();

  if (!categoryId || typeof delta !== "number" || Number.isNaN(delta)) {
    return c.json({ error: "Bad payload" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO budget_lines (id, category_id, amount_budgeted, month, household_id)
     VALUES (?, ?, 0, ?, ?)
     ON CONFLICT(category_id, month) DO NOTHING`
  )
    .bind(uid(), categoryId, month, householdId)
    .run();

  await c.env.DB.prepare(
    `UPDATE budget_lines SET amount_budgeted = amount_budgeted + ? WHERE category_id = ? AND month = ?`
  )
    .bind(delta, categoryId, month)
    .run();

  await c.env.DB.prepare(
    `UPDATE account_state SET to_be_budgeted = to_be_budgeted - ?, updated_at = ? WHERE id = ?`
  )
    .bind(delta, new Date().toISOString(), householdId)
    .run();

  return c.json({ ok: true });
});

// ---- SPEND (household-scoped; user_id kept as audit trail) ----
app.get("/api/spend", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);

  const rows = await c.env.DB.prepare(
    `SELECT id, user_id, category_id, amount, date, note, direction, created_at
     FROM manual_spends WHERE household_id = ? ORDER BY date DESC, created_at DESC LIMIT 200`
  ).bind(householdId).all<{
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
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
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

  const catRow = await c.env.DB.prepare(
    `SELECT direction FROM categories WHERE id = ? AND household_id = ? LIMIT 1`
  ).bind(categoryId, householdId).first<{ direction: string }>();
  if (!catRow) return c.json({ error: "Invalid category" }, 400);

  if (direction === "in" && catRow.direction !== "inflow") {
    return c.json({ error: "Income entries must use an income category" }, 400);
  }
  if (direction === "out" && catRow.direction === "inflow") {
    return c.json({ error: "Outflow entries cannot use an income category" }, 400);
  }

  const now = new Date().toISOString();
  const spendId = uid();

  await c.env.DB.prepare(
    `INSERT INTO manual_spends (id, user_id, household_id, category_id, amount, date, note, direction, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(spendId, userId, householdId, categoryId, amount, date, note, direction, now)
    .run();

  if (direction === "in") {
    await c.env.DB.prepare(
      `UPDATE account_state SET bank_balance = bank_balance + ?, to_be_budgeted = to_be_budgeted + ?, updated_at = ? WHERE id = ?`
    )
      .bind(amount, amount, now, householdId)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE account_state SET bank_balance = bank_balance - ?, updated_at = ? WHERE id = ?`
    )
      .bind(amount, now, householdId)
      .run();
  }

  return c.json({ ok: true, id: spendId });
});

app.delete("/api/spend/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const spendId = c.req.param("id");

  const existing = await c.env.DB.prepare(
    `SELECT id, amount, direction FROM manual_spends WHERE id = ? AND household_id = ? LIMIT 1`
  )
    .bind(spendId, householdId)
    .first<{ id: string; amount: number; direction: "in" | "out" }>();

  if (!existing) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare(`DELETE FROM manual_spends WHERE id = ?`).bind(spendId).run();

  const now = new Date().toISOString();
  const amount = Number(existing.amount || 0);

  if (existing.direction === "in") {
    await c.env.DB.prepare(
      `UPDATE account_state SET bank_balance = bank_balance - ?, to_be_budgeted = to_be_budgeted - ?, updated_at = ? WHERE id = ?`
    )
      .bind(amount, amount, now, householdId)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE account_state SET bank_balance = bank_balance + ?, updated_at = ? WHERE id = ?`
    )
      .bind(amount, now, householdId)
      .run();
  }

  return c.json({ ok: true });
});

// ---- SPEND SUMMARY (household-scoped) ----
app.get("/api/spend/summary", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  const month = (c.req.query("month") || "").trim() || monthKey();
  const categories = await getCategories(c.env.DB, householdId);

  const [year, mon] = month.split("-");
  const y = Number(year);
  const m = Number(mon);
  const startDate = `${year}-${mon}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const endDate = `${nextY}-${String(nextM).padStart(2, "0")}-01`;

  const activityRows = await c.env.DB.prepare(
    `SELECT category_id,
            COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS activity
     FROM manual_spends
     WHERE date >= ? AND date < ? AND household_id = ?
     GROUP BY category_id`
  )
    .bind(startDate, endDate, householdId)
    .all<{ category_id: string; activity: number }>();

  const budgetRows = await c.env.DB.prepare(
    `SELECT category_id, amount_budgeted FROM budget_lines WHERE month = ? AND household_id = ?`
  )
    .bind(month, householdId)
    .all<{ category_id: string; amount_budgeted: number }>();

  const activityByCategory: Record<string, number> = {};
  const budgetByCategory: Record<string, number> = {};

  for (const r of activityRows.results ?? []) {
    activityByCategory[r.category_id] = Number(r.activity || 0);
  }
  for (const r of budgetRows.results ?? []) {
    budgetByCategory[r.category_id] = Number(r.amount_budgeted || 0);
  }

  const byCategory = categories
    .filter((cat) => cat.direction !== "inflow")
    .map((cat) => {
      const budgeted = budgetByCategory[cat.id] || 0;
      const activity = activityByCategory[cat.id] || 0;
      return { id: cat.id, name: cat.name, budgeted, activity, available: budgeted - activity };
    });

  return c.json({ byCategory });
});

// ---- GOALS (personal — user_id scoped, unchanged) ----
app.get("/api/goals", requireUser, async (c) => {
  const userId = c.get("userId");
  const rows = await c.env.DB.prepare(
    `SELECT id, title, status, due_date, notes, created_at, updated_at
     FROM goals WHERE user_id = ?
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, COALESCE(due_date, '9999-12-31') ASC, created_at DESC`
  )
    .bind(userId)
    .all<{ id: string; title: string; status: "active" | "done"; due_date: string | null; notes: string | null; created_at: string; updated_at: string }>();

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
  const body = await c.req.json<{ title?: string; dueDate?: string | null; notes?: string | null; status?: "active" | "done" }>();

  const existing = await c.env.DB.prepare(`SELECT id FROM goals WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, userId)
    .first<{ id: string }>();

  if (!existing) return c.json({ error: "Not found" }, 404);

  const now = new Date().toISOString();
  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.title !== undefined) {
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "Title cannot be empty" }, 400);
    sets.push("title = ?"); binds.push(title);
  }
  if (body.dueDate !== undefined) { sets.push("due_date = ?"); binds.push(body.dueDate ? body.dueDate.trim() : null); }
  if (body.notes !== undefined) { sets.push("notes = ?"); binds.push(body.notes ? body.notes.trim() : null); }
  if (body.status !== undefined) { sets.push("status = ?"); binds.push(body.status); }
  sets.push("updated_at = ?"); binds.push(now);

  await c.env.DB.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...binds, id, userId)
    .run();

  return c.json({ ok: true });
});

app.delete("/api/goals/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM goals WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  return c.json({ ok: true });
});

// ---- DEBTS (personal — user_id scoped, unchanged) ----
type DebtRow = { id: string; name: string; balance: number; apr: number; payment: number; payments_remaining: number; created_at: string; updated_at: string };

app.get("/api/debts", requireUser, async (c) => {
  const userId = c.get("userId");
  const rows = await c.env.DB.prepare(
    `SELECT id, name, balance, apr, min_payment AS payment, payments_remaining, created_at, updated_at FROM debts WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(userId)
    .all<DebtRow>();
  return c.json({ debts: rows.results ?? [] });
});

app.post("/api/debts", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; balance?: number; apr?: number; payment?: number; paymentsRemaining?: number }>();
  const name = (body.name || "").trim();
  const balance = Number(body.balance);
  const apr = Number(body.apr);
  const payment = Number(body.payment);
  const paymentsRemaining = Number(body.paymentsRemaining ?? 0);

  if (!name || Number.isNaN(balance) || Number.isNaN(apr) || Number.isNaN(payment)) {
    return c.json({ error: "Bad payload" }, 400);
  }

  const now = new Date().toISOString();
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO debts (id, user_id, name, balance, apr, min_payment, payments_remaining, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, name, balance, apr, payment, paymentsRemaining, now, now)
    .run();

  return c.json({ ok: true, id });
});

app.patch("/api/debts/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; balance?: number; apr?: number; payment?: number; paymentsRemaining?: number }>();

  const existing = await c.env.DB.prepare(`SELECT id FROM debts WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(id, userId).first<{ id: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.name !== undefined) {
    const name = (body.name || "").trim();
    if (!name) return c.json({ error: "Name cannot be empty" }, 400);
    sets.push("name = ?"); binds.push(name);
  }
  if (body.balance !== undefined) { const n = Number(body.balance); if (Number.isNaN(n)) return c.json({ error: "balance must be a number" }, 400); sets.push("balance = ?"); binds.push(n); }
  if (body.apr !== undefined) { const n = Number(body.apr); if (Number.isNaN(n)) return c.json({ error: "apr must be a number" }, 400); sets.push("apr = ?"); binds.push(n); }
  if (body.payment !== undefined) { const n = Number(body.payment); if (Number.isNaN(n)) return c.json({ error: "payment must be a number" }, 400); sets.push("min_payment = ?"); binds.push(n); }
  if (body.paymentsRemaining !== undefined) { const n = Number(body.paymentsRemaining); if (Number.isNaN(n)) return c.json({ error: "paymentsRemaining must be a number" }, 400); sets.push("payments_remaining = ?"); binds.push(n); }

  const now = new Date().toISOString();
  sets.push("updated_at = ?"); binds.push(now);

  await c.env.DB.prepare(`UPDATE debts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...binds, id, userId).run();

  return c.json({ ok: true });
});

app.delete("/api/debts/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM debts WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  return c.json({ ok: true });
});

app.get("/api/debts/settings", requireUser, async (c) => {
  const userId = c.get("userId");
  const row = await c.env.DB.prepare(`SELECT extra_monthly, strategy FROM debt_settings WHERE user_id = ? LIMIT 1`)
    .bind(userId).first<{ extra_monthly: number; strategy: string }>();
  return c.json({ extraMonthly: Number(row?.extra_monthly ?? 0), method: row?.strategy ?? "snowball" });
});

app.post("/api/debts/settings", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ extraMonthly?: number; method?: string }>();

  const existing = await c.env.DB.prepare(`SELECT extra_monthly, strategy FROM debt_settings WHERE user_id = ? LIMIT 1`)
    .bind(userId).first<{ extra_monthly: number; strategy: string }>();

  const extraMonthly = body.extraMonthly !== undefined ? Number(body.extraMonthly) : Number(existing?.extra_monthly ?? 0);
  if (Number.isNaN(extraMonthly) || extraMonthly < 0) return c.json({ error: "extraMonthly must be a number >= 0" }, 400);
  const strategy = body.method === "avalanche" ? "avalanche" : body.method === "snowball" ? "snowball" : (existing?.strategy ?? "snowball");

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO debt_settings (user_id, extra_monthly, strategy, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET extra_monthly = excluded.extra_monthly, strategy = excluded.strategy, updated_at = excluded.updated_at`
  ).bind(userId, extraMonthly, strategy, now, now).run();

  return c.json({ ok: true });
});

app.post("/api/debts/:id/plan", requireUser, async (c) => {
  const userId = c.get("userId");
  const debtId = c.req.param("id");
  const body = await c.req.json<{ month?: string; plannedPayment?: number }>();
  const month = (body.month || monthKey()).trim();
  const plannedPayment = body.plannedPayment;

  if (!/^\d{4}-\d{2}$/.test(month)) return c.json({ error: "month must be YYYY-MM" }, 400);
  if (typeof plannedPayment !== "number" || Number.isNaN(plannedPayment) || plannedPayment < 0) {
    return c.json({ error: "plannedPayment must be a number" }, 400);
  }

  const exists = await c.env.DB.prepare(`SELECT id FROM debts WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(debtId, userId).first<{ id: string }>();
  if (!exists) return c.json({ error: "Not found" }, 404);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO debt_payment_plans (id, user_id, debt_id, month, planned_payment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, debt_id, month) DO UPDATE SET planned_payment = excluded.planned_payment, updated_at = excluded.updated_at`
  )
    .bind(uid(), userId, debtId, month, plannedPayment, now, now).run();

  return c.json({ ok: true });
});

// ---- CALENDAR (already household-scoped — unchanged) ----
app.get("/api/calendar/upcoming", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ events: [] });

  const days = Math.max(1, Math.min(30, Number(c.req.query("days") || "7")));
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await c.env.DB.prepare(
    `SELECT id, title, start_at, end_at, location, notes FROM calendar_events
     WHERE household_id = ? AND start_at >= ? AND start_at < ? ORDER BY start_at ASC`
  )
    .bind(householdId, now.toISOString(), end.toISOString())
    .all<{ id: string; title: string; start_at: string; end_at: string | null; location: string | null; notes: string | null }>();

  return c.json({ events: rows.results ?? [] });
});

app.post("/api/calendar", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{ title?: string; startAt?: string; endAt?: string | null; location?: string; notes?: string }>();
  const title = (body.title || "").trim();
  const startAt = (body.startAt || "").trim();
  const endAt = body.endAt ? body.endAt.trim() : null;
  const location = (body.location || "").trim() || null;
  const notes = (body.notes || "").trim() || null;

  if (!title || !startAt) return c.json({ error: "Missing title/startAt" }, 400);

  const now = new Date().toISOString();
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO calendar_events (id, user_id, household_id, title, start_at, end_at, location, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, householdId, title, startAt, endAt, location, notes, now, now).run();

  return c.json({ ok: true, id });
});

app.delete("/api/calendar/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  const id = c.req.param("id");
  await c.env.DB.prepare(
    `DELETE FROM calendar_events WHERE id = ? AND household_id = ?`
  ).bind(id, householdId ?? "").run();
  return c.json({ ok: true });
});

// ---- HOME UPCOMING (already household-scoped — unchanged) ----
app.get("/api/home/upcoming", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  const billsDays = Math.max(1, Math.min(14, Number(c.req.query("billsDays") || "3")));
  const calDays = Math.max(1, Math.min(30, Number(c.req.query("calDays") || "7")));

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const currentDay = todayDate.getDate();
  const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();

  const upcomingDays: number[] = [];
  for (let i = 0; i <= billsDays; i++) {
    upcomingDays.push(((currentDay - 1 + i) % daysInMonth) + 1);
  }

  const placeholders = upcomingDays.map(() => "?").join(",");
  const billsRows = householdId ? await c.env.DB.prepare(
    `SELECT id, name, mode, day_of_month FROM bills WHERE household_id = ? AND day_of_month IN (${placeholders}) ORDER BY day_of_month ASC`
  ).bind(householdId, ...upcomingDays).all<{ id: string; name: string; mode: "auto" | "manual"; day_of_month: number }>()
  : { results: [] };

  const now = new Date();
  const calEnd = new Date(now.getTime() + calDays * 24 * 60 * 60 * 1000);

  const eventsRows = householdId ? await c.env.DB.prepare(
    `SELECT id, title, start_at, end_at, location FROM calendar_events
     WHERE household_id = ? AND start_at >= ? AND start_at < ? ORDER BY start_at ASC`
  )
    .bind(householdId, now.toISOString(), calEnd.toISOString())
    .all<{ id: string; title: string; start_at: string; end_at: string | null; location: string | null }>()
  : { results: [] };

  return c.json({ bills: billsRows.results ?? [], events: eventsRows.results ?? [] });
});

app.get("/api/calendar/range", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  const start = (c.req.query("start") || "").trim();
  const end = (c.req.query("end") || "").trim();

  if (!start || !end) return c.json({ error: "Missing start/end" }, 400);
  if (!householdId) return c.json({ bills: [], events: [] });

  const allBills = await c.env.DB.prepare(
    `SELECT id, name, mode, day_of_month FROM bills WHERE household_id = ?`
  ).bind(householdId).all<{ id: string; name: string; mode: string; day_of_month: number }>();

  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);

  const billsInRange: { id: string; name: string; mode: string; due_date: string }[] = [];
  for (const bill of allBills.results ?? []) {
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === startYear && m < startMonth) continue;
        if (y === endYear && m > endMonth) continue;
        const daysInMonth = new Date(y, m, 0).getDate();
        const day = Math.min(bill.day_of_month, daysInMonth);
        const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (dateStr >= start && dateStr < end) {
          billsInRange.push({ ...bill, due_date: dateStr });
        }
      }
    }
  }
  billsInRange.sort((a, b) => a.due_date.localeCompare(b.due_date));

  const eventsRows = await c.env.DB.prepare(
    `SELECT id, title, start_at, end_at, location, notes FROM calendar_events
     WHERE household_id = ? AND start_at >= ? AND start_at < ? ORDER BY start_at ASC`
  )
    .bind(householdId, `${start}T00:00:00.000Z`, `${end}T00:00:00.000Z`)
    .all<{ id: string; title: string; start_at: string; end_at: string | null; location: string | null; notes: string | null }>();

  return c.json({ bills: billsInRange, events: eventsRows.results ?? [] });
});

// ---- MONTHLY BUDGET (household-scoped) ----
app.get("/api/budget/months", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);

  const rows = await c.env.DB.prepare(
    `SELECT month, closed_at FROM budget_months WHERE household_id = ? ORDER BY month DESC`
  ).bind(householdId).all<{ month: string; closed_at: string | null }>();
  return c.json({ months: rows.results ?? [] });
});

app.post("/api/budget/month/close", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getOrCreateHouseholdId(c.env.DB, userId);
  await ensureAccountState(c.env.DB, householdId);
  const body = await c.req.json<{ currentMonth?: string; nextMonth?: string }>();
  const currentMonth = (body.currentMonth || "").trim();
  const nextMonth = (body.nextMonth || "").trim();

  if (!/^\d{4}-\d{2}$/.test(currentMonth) || !/^\d{4}-\d{2}$/.test(nextMonth)) {
    return c.json({ error: "currentMonth and nextMonth must be YYYY-MM" }, 400);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE budget_months SET closed_at = ? WHERE month = ? AND household_id = ?`
  ).bind(now, currentMonth, householdId).run();

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO budget_months (month, household_id, created_at) VALUES (?, ?, ?)`
  ).bind(nextMonth, householdId, now).run();

  const categories = await getCategories(c.env.DB, householdId);

  for (const cat of categories.filter((c) => c.direction !== "inflow")) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO budget_lines (id, category_id, amount_budgeted, month, household_id) VALUES (?, ?, 0, ?, ?)`
    ).bind(uid(), cat.id, nextMonth, householdId).run();
  }

  const acct = await c.env.DB.prepare(
    `SELECT bank_balance FROM account_state WHERE id = ? LIMIT 1`
  ).bind(householdId).first<{ bank_balance: number }>();

  await c.env.DB.prepare(
    `UPDATE account_state SET to_be_budgeted = ?, updated_at = ? WHERE id = ?`
  ).bind(Number(acct?.bank_balance ?? 0), now, householdId).run();

  return c.json({ ok: true, nextMonth });
});

// ---- NOTES (already household-scoped — unchanged) ----
app.get("/api/notes", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ notes: [] });

  const rows = await c.env.DB.prepare(
    `SELECT n.id, n.user_id, n.body, n.created_at, u.name AS author_name
     FROM notes n
     LEFT JOIN users u ON u.id = n.user_id
     WHERE n.household_id = ?
     ORDER BY n.created_at DESC
     LIMIT 50`
  ).bind(householdId).all<{ id: string; user_id: string; body: string; created_at: string; author_name: string | null }>();
  return c.json({ notes: rows.results ?? [] });
});

app.post("/api/notes", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{ body?: string }>();
  const text = (body.body || "").trim();
  if (!text || text.length > 500) return c.json({ error: "Message required (max 500 chars)" }, 400);
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO notes (id, user_id, household_id, body, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(uid(), userId, householdId, text, now).run();
  return c.json({ ok: true });
});

app.delete("/api/notes/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  const id = c.req.param("id");
  await c.env.DB.prepare(
    `DELETE FROM notes WHERE id = ? AND (user_id = ? OR household_id = ?)`
  ).bind(id, userId, householdId ?? "").run();
  return c.json({ ok: true });
});

// ---- HOUSEHOLD MANAGEMENT (unchanged) ----
app.get("/api/household", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ household: null, members: [] });

  const household = await c.env.DB.prepare(
    `SELECT id, name, created_at FROM households WHERE id = ? LIMIT 1`
  ).bind(householdId).first<{ id: string; name: string; created_at: string }>();

  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, hm.role, hm.joined_at
     FROM household_members hm
     JOIN users u ON u.id = hm.user_id
     WHERE hm.household_id = ?
     ORDER BY hm.joined_at ASC`
  ).bind(householdId).all<{ id: string; name: string; email: string; role: string; joined_at: string }>();

  return c.json({ household, members: members.results ?? [] });
});

app.patch("/api/household", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const body = await c.req.json<{ name?: string }>();
  const name = (body.name || "").trim();
  if (!name) return c.json({ error: "Name required" }, 400);

  await c.env.DB.prepare(`UPDATE households SET name = ? WHERE id = ?`)
    .bind(name, householdId).run();

  return c.json({ ok: true });
});

app.post("/api/household/invite", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO household_invites (id, household_id, code, created_by, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).bind(uid(), householdId, code, userId, expiresAt, now).run();

  return c.json({ ok: true, code, expiresAt });
});

app.post("/api/household/join", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ code?: string }>();
  const code = (body.code || "").trim().toUpperCase();

  if (!code) return c.json({ error: "Invite code required" }, 400);

  const now = new Date().toISOString();

  const invite = await c.env.DB.prepare(
    `SELECT id, household_id FROM household_invites
     WHERE code = ? AND expires_at > ? AND used = 0 LIMIT 1`
  ).bind(code, now).first<{ id: string; household_id: string }>();

  if (!invite) return c.json({ error: "Invalid or expired invite code" }, 400);

  const existingHousehold = await getUserHouseholdId(c.env.DB, userId);

  if (existingHousehold === invite.household_id) {
    return c.json({ error: "You are already in this household" }, 400);
  }

  if (existingHousehold) {
    await c.env.DB.prepare(`DELETE FROM household_members WHERE user_id = ?`).bind(userId).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO household_members (id, household_id, user_id, role, joined_at)
     VALUES (?, ?, ?, 'member', ?)`
  ).bind(uid(), invite.household_id, userId, now).run();

  await c.env.DB.prepare(
    `UPDATE household_invites SET used = 1, used_by = ? WHERE id = ?`
  ).bind(userId, invite.id).run();

  const household = await c.env.DB.prepare(
    `SELECT name FROM households WHERE id = ? LIMIT 1`
  ).bind(invite.household_id).first<{ name: string }>();

  return c.json({ ok: true, householdName: household?.name ?? "" });
});

app.delete("/api/household/members/:memberId", requireUser, async (c) => {
  const userId = c.get("userId");
  const memberId = c.req.param("memberId");

  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const myRole = await c.env.DB.prepare(
    `SELECT role FROM household_members WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(userId, householdId).first<{ role: string }>();

  if (myRole?.role !== "admin" && userId !== memberId) {
    return c.json({ error: "Only admins can remove members" }, 403);
  }

  if (userId === memberId) {
    const adminCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM household_members WHERE household_id = ? AND role = 'admin'`
    ).bind(householdId).first<{ count: number }>();
    if ((adminCount?.count ?? 0) <= 1) {
      return c.json({ error: "Cannot remove the last admin" }, 400);
    }
  }

  await c.env.DB.prepare(
    `DELETE FROM household_members WHERE user_id = ? AND household_id = ?`
  ).bind(memberId, householdId).run();

  return c.json({ ok: true });
});

// ---- PROFILE (unchanged) ----
app.patch("/api/auth/profile", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; currentPassword?: string; newPassword?: string }>();

  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.name !== undefined) {
    const name = (body.name || "").trim();
    if (!name) return c.json({ error: "Name cannot be empty" }, 400);
    sets.push("name = ?");
    binds.push(name);
  }

  if (body.newPassword !== undefined) {
    if (!body.currentPassword) return c.json({ error: "Current password required" }, 400);
    if ((body.newPassword || "").length < 8) return c.json({ error: "New password must be at least 8 characters" }, 400);

    const user = await c.env.DB.prepare(
      `SELECT password_hash FROM users WHERE id = ? LIMIT 1`
    ).bind(userId).first<{ password_hash: string }>();

    const currentHash = await sha256(body.currentPassword + c.env.SESSION_SECRET);
    if (currentHash !== user?.password_hash) {
      return c.json({ error: "Current password is incorrect" }, 401);
    }

    const newHash = await sha256(body.newPassword + c.env.SESSION_SECRET);
    sets.push("password_hash = ?");
    binds.push(newHash);
  }

  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);

  await c.env.DB.prepare(
    `UPDATE users SET ${sets.join(", ")} WHERE id = ?`
  ).bind(...binds, userId).run();

  return c.json({ ok: true });
});

export default { fetch: app.fetch };
