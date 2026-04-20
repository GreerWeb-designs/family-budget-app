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
  ADMIN_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const APP_ORIGIN = "https://app.nestotter.com";
const APP_ORIGIN_LEGACY = "https://app.ducharmefamilybudget.com";
const LANDING_ORIGIN = "https://nestotter.com";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Email ──────────────────────────────────────────────────────────────────────

async function sendEmail(
  apiKey: string,
  { to, subject, html }: { to: string; subject: string; html: string }
) {
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "NestOtter <hello@send.nestotter.com>",
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

function passwordResetHtml(resetUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6EE;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EE;padding:40px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#FFFDF8;border-radius:16px;border:1px solid #EDE7D8;overflow:hidden">
      <tr><td style="background:#2D6E70;padding:28px 32px;text-align:center">
        <span style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#FFFDF8;letter-spacing:-0.3px">NestOtter</span>
      </td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;font-weight:500;color:#1C2A33">Reset your password</h1>
        <p style="margin:0 0 24px;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#3F5260">
          We received a request to reset your NestOtter password. Click the button below — this link expires in <strong>1 hour</strong>.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
          <tr><td style="background:#2D6E70;border-radius:10px;padding:14px 28px">
            <a href="${resetUrl}" style="font-family:-apple-system,sans-serif;font-size:14px;font-weight:600;color:#FFFDF8;text-decoration:none;display:block">Reset password →</a>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-family:-apple-system,sans-serif;font-size:13px;color:#6B7A85">Or copy this link:</p>
        <p style="margin:0 0 24px;font-family:monospace;font-size:12px;color:#6B7A85;word-break:break-all;background:#FAF6EE;padding:10px 12px;border-radius:8px;border:1px solid #EDE7D8">${resetUrl}</p>
        <p style="margin:0;font-family:-apple-system,sans-serif;font-size:13px;color:#A8B3BB">Didn't request this? You can safely ignore this email.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #EDE7D8;text-align:center">
        <p style="margin:0;font-family:-apple-system,sans-serif;font-size:12px;color:#A8B3BB">NestOtter — Your home, organized.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function emailVerificationHtml(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6EE;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EE;padding:40px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#FFFDF8;border-radius:16px;border:1px solid #EDE7D8;overflow:hidden">
      <tr><td style="background:#2D6E70;padding:28px 32px;text-align:center">
        <span style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#FFFDF8;letter-spacing:-0.3px">NestOtter</span>
      </td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;font-weight:500;color:#1C2A33">Verify your email</h1>
        <p style="margin:0 0 24px;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#3F5260">
          Hi ${name}, welcome to NestOtter! Click the button below to verify your email address and activate your account. This link expires in <strong>24 hours</strong>.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
          <tr><td style="background:#2D6E70;border-radius:10px;padding:14px 28px">
            <a href="${verifyUrl}" style="font-family:-apple-system,sans-serif;font-size:14px;font-weight:600;color:#FFFDF8;text-decoration:none;display:block">Verify my email →</a>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-family:-apple-system,sans-serif;font-size:13px;color:#6B7A85">Or copy this link:</p>
        <p style="margin:0 0 24px;font-family:monospace;font-size:12px;color:#6B7A85;word-break:break-all;background:#FAF6EE;padding:10px 12px;border-radius:8px;border:1px solid #EDE7D8">${verifyUrl}</p>
        <p style="margin:0;font-family:-apple-system,sans-serif;font-size:13px;color:#A8B3BB">Didn't create a NestOtter account? You can safely ignore this email.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #EDE7D8;text-align:center">
        <p style="margin:0;font-family:-apple-system,sans-serif;font-size:12px;color:#A8B3BB">NestOtter — Your home, organized.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function householdInviteHtml(inviterName: string, householdName: string, joinUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6EE;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EE;padding:40px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#FFFDF8;border-radius:16px;border:1px solid #EDE7D8;overflow:hidden">
      <tr><td style="background:#2D6E70;padding:28px 32px;text-align:center">
        <span style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#FFFDF8;letter-spacing:-0.3px">NestOtter</span>
      </td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;font-weight:500;color:#1C2A33">You're invited 🏠</h1>
        <p style="margin:0 0 24px;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#3F5260">
          <strong>${inviterName}</strong> has invited you to join the <strong>${householdName}</strong> household on NestOtter — a shared space for budgets, meals, chores, and more.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
          <tr><td style="background:#2D6E70;border-radius:10px;padding:14px 28px">
            <a href="${joinUrl}" style="font-family:-apple-system,sans-serif;font-size:14px;font-weight:600;color:#FFFDF8;text-decoration:none;display:block">Join household →</a>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-family:-apple-system,sans-serif;font-size:13px;color:#6B7A85">
          This invite expires in <strong>48 hours</strong>. You'll need a NestOtter account to join.
        </p>
        <p style="margin:0;font-family:-apple-system,sans-serif;font-size:13px;color:#A8B3BB">Not expecting this? You can safely ignore it.</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #EDE7D8;text-align:center">
        <p style="margin:0;font-family:-apple-system,sans-serif;font-size:12px;color:#A8B3BB">NestOtter — Your home, organized.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const isAllowedOrigin = origin === APP_ORIGIN || origin === APP_ORIGIN_LEGACY || origin === LANDING_ORIGIN;

  if (isAllowedOrigin) {
    c.header("Access-Control-Allow-Origin", origin!);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    c.header("Vary", "Origin");
  }

  // Let admin routes handle their own OPTIONS preflight (they allow null origin)
  if (c.req.method === "OPTIONS" && !c.req.path.startsWith("/api/admin")) {
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
    `SELECT id, password_hash, email_verified FROM users WHERE email = ? LIMIT 1`
  )
    .bind(email)
    .first<{ id: string; password_hash: string; email_verified: number }>();

  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const candidate = await sha256(password + c.env.SESSION_SECRET);
  if (candidate !== user.password_hash) return c.json({ error: "Invalid credentials" }, 401);

  if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified) {
    return c.json({ error: "Please verify your email before signing in. Check your inbox for the verification link.", code: "EMAIL_NOT_VERIFIED" }, 403);
  }

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
    `SELECT id, name, email, onboarding_completed_at, account_type FROM users WHERE id = ? LIMIT 1`
  ).bind(userId).first<{ id: string; name: string; email: string; onboarding_completed_at: string | null; account_type: string | null }>();

  const householdId = await getUserHouseholdId(c.env.DB, userId);
  let role = "member";
  if (householdId) {
    const memberRow = await c.env.DB.prepare(
      `SELECT role FROM household_members WHERE user_id = ? AND household_id = ? LIMIT 1`
    ).bind(userId, householdId).first<{ role: string }>();
    role = memberRow?.role ?? "member";
  }

  const accountType = user?.account_type ?? "standard";
  let permissions: Record<string, boolean> | null = null;
  if (accountType === "dependent") {
    const perm = await c.env.DB.prepare(
      `SELECT * FROM dependent_permissions WHERE user_id = ? LIMIT 1`
    ).bind(userId).first<Record<string, number | string>>();
    if (perm) {
      permissions = {
        finances_enabled: perm.finances_enabled !== undefined ? !!perm.finances_enabled : true,
        can_see_budget: !!perm.can_see_budget,
        can_see_transactions: !!perm.can_see_transactions,
        can_see_bills: !!perm.can_see_bills,
        can_see_debts: !!perm.can_see_debts,
        can_see_spending: !!perm.can_see_spending,
        can_see_goals: !!perm.can_see_goals,
        can_add_chores: !!perm.can_add_chores,
        can_add_grocery: !!perm.can_add_grocery,
        can_add_calendar: !!perm.can_add_calendar,
        can_view_notes: !!perm.can_view_notes,
        can_post_notes: !!perm.can_post_notes,
        can_see_recipes: perm.can_see_recipes !== undefined ? !!perm.can_see_recipes : true,
        can_see_meals: perm.can_see_meals !== undefined ? !!perm.can_see_meals : true,
        can_see_todo: perm.can_see_todo !== undefined ? !!perm.can_see_todo : true,
        can_see_allowance: !!perm.can_see_allowance,
      };
    }
  }

  return c.json({
    ok: true,
    userId,
    name: user?.name ?? "",
    email: user?.email ?? "",
    onboardingCompletedAt: user?.onboarding_completed_at ?? null,
    accountType,
    role,
    permissions,
  });
});

// ── TESTING FLAG — set to true to re-enable email verification ───────────────
const REQUIRE_EMAIL_VERIFICATION = false;

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

  // email_verified = 1 when REQUIRE_EMAIL_VERIFICATION is off (testing mode)
  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(userId, name, email, passwordHash, REQUIRE_EMAIL_VERIFICATION ? 0 : 1, now).run();

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

  if (REQUIRE_EMAIL_VERIFICATION) {
    // Generate and send verification token
    const verifyToken = uid();
    const verifyTokenHash = await sha256(verifyToken + c.env.SESSION_SECRET);
    const verifyExpires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    await c.env.DB.prepare(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(uid(), userId, verifyTokenHash, verifyExpires, now).run();

    const verifyUrl = `${APP_ORIGIN}/verify-email?token=${verifyToken}`;
    const householdName = `${name}'s Household`;
    c.executionCtx.waitUntil(
      (async () => {
        try {
          await sendEmail(c.env.RESEND_API_KEY, {
            to: email,
            subject: "Verify your NestOtter email",
            html: emailVerificationHtml(name, verifyUrl),
          });
        } catch (err) { console.error("[resend] Verification email failed:", err); }
        try {
          const resend = new Resend(c.env.RESEND_API_KEY);
          await resend.emails.send({
            from: c.env.RESEND_FROM_EMAIL,
            to:   c.env.ADMIN_EMAIL,
            subject: "New signup: NestOtter",
            html: `<p>New signup.</p><ul><li><strong>Name:</strong> ${name}</li><li><strong>Household:</strong> ${householdName}</li><li><strong>At:</strong> ${now} (UTC)</li></ul>`,
          });
        } catch (err) { console.error("[resend] Admin notification failed:", err); }
      })()
    );
    return c.json({ ok: true, email, requiresVerification: true });
  }

  // Testing mode: skip verification — admin notification only
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const resend = new Resend(c.env.RESEND_API_KEY);
        await resend.emails.send({
          from: c.env.RESEND_FROM_EMAIL,
          to:   c.env.ADMIN_EMAIL,
          subject: "New signup: NestOtter (testing)",
          html: `<p>New signup (verification skipped — testing mode).</p><ul><li><strong>Name:</strong> ${name}</li><li><strong>At:</strong> ${now} (UTC)</li></ul>`,
        });
      } catch { /* silent */ }
    })()
  );

  return c.json({ ok: true, email, requiresVerification: false });
});

// ── Waitlist (public, no auth) ─────────────────────────
app.post("/api/waitlist", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Invalid email" }, 400);
  }
  const db = c.env.DB;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.prepare("INSERT INTO waitlist (id, email, created_at) VALUES (?, ?, ?)")
      .bind(id, email, now).run();
  } catch {
    // duplicate — still return ok so we don't leak whether email exists
  }
  return c.json({ ok: true });
});

// ── Email verification ────────────────────────────────
app.get("/api/auth/verify-email", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return c.json({ error: "Missing token" }, 400);

  const tokenHash = await sha256(token + c.env.SESSION_SECRET);
  const row = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token_hash = ? LIMIT 1`
  ).bind(tokenHash).first<{ id: string; user_id: string; expires_at: string }>();

  if (!row) return c.json({ error: "Invalid or already used verification link." }, 400);
  if (new Date(row.expires_at) < new Date()) return c.json({ error: "Verification link has expired. Please request a new one." }, 400);

  await c.env.DB.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`).bind(row.user_id).run();
  await c.env.DB.prepare(`DELETE FROM email_verification_tokens WHERE id = ?`).bind(row.id).run();

  return c.json({ ok: true });
});

app.post("/api/auth/resend-verification", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return c.json({ error: "Email required" }, 400);

  const user = await c.env.DB.prepare(
    `SELECT id, name, email_verified FROM users WHERE email = ? LIMIT 1`
  ).bind(email).first<{ id: string; name: string; email_verified: number }>();

  // Always return ok to avoid leaking whether email exists
  if (!user || user.email_verified) return c.json({ ok: true });

  // Delete any existing tokens for this user
  await c.env.DB.prepare(`DELETE FROM email_verification_tokens WHERE user_id = ?`).bind(user.id).run();

  const token = uid();
  const tokenHash = await sha256(token + c.env.SESSION_SECRET);
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(uid(), user.id, tokenHash, expires, now).run();

  const verifyUrl = `${APP_ORIGIN}/verify-email?token=${token}`;
  c.executionCtx.waitUntil(
    sendEmail(c.env.RESEND_API_KEY, {
      to: email,
      subject: "Verify your NestOtter email",
      html: emailVerificationHtml(user.name, verifyUrl),
    }).catch(err => console.error("[resend] Resend verification failed:", err))
  );

  return c.json({ ok: true });
});

// ── Google Calendar OAuth ─────────────────────────────
const GOOGLE_REDIRECT_URI = "https://family-budget-api.bob-31b.workers.dev/api/auth/google/callback";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

async function refreshGoogleToken(db: D1Database, userId: string, clientId: string, clientSecret: string) {
  const row = await db.prepare(
    `SELECT refresh_token FROM google_tokens WHERE user_id = ? LIMIT 1`
  ).bind(userId).first<{ refresh_token: string }>();
  if (!row) throw new Error("No Google token found");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json<{ access_token?: string; expires_in?: number; error?: string }>();
  if (!data.access_token) throw new Error(data.error ?? "Token refresh failed");

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE google_tokens SET access_token = ?, expires_at = ?, updated_at = ? WHERE user_id = ?`
  ).bind(data.access_token, expiresAt, now, userId).run();

  return data.access_token;
}

async function getValidGoogleToken(db: D1Database, userId: string, clientId: string, clientSecret: string): Promise<string> {
  const row = await db.prepare(
    `SELECT access_token, expires_at FROM google_tokens WHERE user_id = ? LIMIT 1`
  ).bind(userId).first<{ access_token: string; expires_at: string }>();
  if (!row) throw new Error("Google Calendar not connected");

  // Refresh if expiring within 2 minutes
  if (new Date(row.expires_at) <= new Date(Date.now() + 120_000)) {
    return refreshGoogleToken(db, userId, clientId, clientSecret);
  }
  return row.access_token;
}

// Step 1 — redirect to Google consent screen
app.get("/api/auth/google", requireUser, async (c) => {
  const userId = c.get("userId");
  const state = await sha256(userId + c.env.SESSION_SECRET + Date.now());
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  // Store state temporarily so callback can verify it
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO google_oauth_state (state, user_id, created_at) VALUES (?, ?, ?)`
  ).bind(state, userId, new Date().toISOString()).run().catch(() => {});
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Step 2 — Google redirects back here with a code
app.get("/api/auth/google/callback", async (c) => {
  const code  = c.req.query("code") ?? "";
  const state = c.req.query("state") ?? "";
  const error = c.req.query("error");

  if (error || !code) return c.redirect(`${APP_ORIGIN}/settings?google=error`);

  // Look up the user from state
  const stateRow = await c.env.DB.prepare(
    `SELECT user_id FROM google_oauth_state WHERE state = ? LIMIT 1`
  ).bind(state).first<{ user_id: string }>();
  if (!stateRow) return c.redirect(`${APP_ORIGIN}/settings?google=error`);

  await c.env.DB.prepare(`DELETE FROM google_oauth_state WHERE state = ?`).bind(state).run().catch(() => {});

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json<{
    access_token?: string; refresh_token?: string;
    expires_in?: number; error?: string;
  }>();
  if (!tokens.access_token || !tokens.refresh_token) {
    return c.redirect(`${APP_ORIGIN}/settings?google=error`);
  }

  // Fetch Google email
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json<{ email?: string }>();

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO google_tokens (id, user_id, access_token, refresh_token, expires_at, google_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       google_email = excluded.google_email,
       updated_at = excluded.updated_at`
  ).bind(uid(), stateRow.user_id, tokens.access_token, tokens.refresh_token, expiresAt, profile.email ?? null, now, now).run();

  return c.redirect(`${APP_ORIGIN}/settings?google=connected`);
});

// Status — is this user connected?
app.get("/api/auth/google/status", requireUser, async (c) => {
  const userId = c.get("userId");
  const row = await c.env.DB.prepare(
    `SELECT google_email, sync_events, sync_meals, sync_bills FROM google_tokens WHERE user_id = ? LIMIT 1`
  ).bind(userId).first<{ google_email: string | null; sync_events: number; sync_meals: number; sync_bills: number }>();
  return c.json({
    connected: !!row,
    email: row?.google_email ?? null,
    prefs: row ? { syncEvents: !!row.sync_events, syncMeals: !!row.sync_meals, syncBills: !!row.sync_bills } : null,
  });
});

// Update sync prefs
app.patch("/api/auth/google/sync-prefs", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ syncEvents?: boolean; syncMeals?: boolean; syncBills?: boolean }>();
  const sets: string[] = []; const binds: unknown[] = [];
  if (body.syncEvents !== undefined) { sets.push("sync_events = ?"); binds.push(body.syncEvents ? 1 : 0); }
  if (body.syncMeals  !== undefined) { sets.push("sync_meals = ?");  binds.push(body.syncMeals  ? 1 : 0); }
  if (body.syncBills  !== undefined) { sets.push("sync_bills = ?");  binds.push(body.syncBills  ? 1 : 0); }
  if (!sets.length) return c.json({ ok: true });
  binds.push(userId);
  await c.env.DB.prepare(`UPDATE google_tokens SET ${sets.join(", ")} WHERE user_id = ?`).bind(...binds).run();
  return c.json({ ok: true });
});

// Disconnect
app.delete("/api/auth/google", requireUser, async (c) => {
  const userId = c.get("userId");
  const row = await c.env.DB.prepare(
    `SELECT access_token FROM google_tokens WHERE user_id = ? LIMIT 1`
  ).bind(userId).first<{ access_token: string }>();

  if (row) {
    // Best-effort revoke
    fetch(`https://oauth2.googleapis.com/revoke?token=${row.access_token}`, { method: "POST" }).catch(() => {});
    await c.env.DB.prepare(`DELETE FROM google_tokens WHERE user_id = ?`).bind(userId).run();
  }
  return c.json({ ok: true });
});

// Push a NestOtter event to Google Calendar
app.post("/api/calendar/:id/push-to-google", requireUser, async (c) => {
  const userId = c.get("userId");
  const eventId = c.req.param("id");

  const event = await c.env.DB.prepare(
    `SELECT title, start_at, end_at, location FROM calendar_events WHERE id = ? AND household_id IN (
       SELECT household_id FROM household_members WHERE user_id = ?
     ) LIMIT 1`
  ).bind(eventId, userId).first<{ title: string; start_at: string; end_at: string | null; location: string | null }>();
  if (!event) return c.json({ error: "Event not found" }, 404);

  let accessToken: string;
  try {
    accessToken = await getValidGoogleToken(c.env.DB, userId, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET);
  } catch {
    return c.json({ error: "Google Calendar not connected" }, 400);
  }

  const body: Record<string, unknown> = {
    summary: event.title,
    start: { dateTime: event.start_at, timeZone: "UTC" },
    end: { dateTime: event.end_at ?? event.start_at, timeZone: "UTC" },
  };
  if (event.location) body.location = event.location;

  const gcalRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!gcalRes.ok) {
    const err = await gcalRes.json<{ error?: { message?: string } }>();
    return c.json({ error: err?.error?.message ?? "Google Calendar push failed" }, 500);
  }
  return c.json({ ok: true });
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

  const resetUrl = `${APP_ORIGIN}/reset-password?token=${token}`;
  try {
    await sendEmail(c.env.RESEND_API_KEY, {
      to: email,
      subject: "Reset your NestOtter password",
      html: passwordResetHtml(resetUrl),
    });
  } catch (e) {
    console.error("Failed to send password reset email:", e);
  }

  return c.json({ ok: true });
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
      `SELECT COALESCE(SUM(max_budgeted), 0) AS totalBudgeted FROM (SELECT category_id, MAX(amount_budgeted) as max_budgeted FROM budget_lines WHERE category_id IN (${placeholders}) AND month = ? GROUP BY category_id)`
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
        `SELECT COALESCE(SUM(max_budgeted), 0) AS totalBudgeted FROM (SELECT category_id, MAX(amount_budgeted) as max_budgeted FROM budget_lines WHERE category_id IN (${placeholders}) AND month = ? GROUP BY category_id)`
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
      `SELECT COALESCE(SUM(max_budgeted), 0) AS totalBudgeted FROM (SELECT category_id, MAX(amount_budgeted) as max_budgeted FROM budget_lines WHERE category_id IN (${placeholders}) AND month = ? GROUP BY category_id)`
    )
      .bind(...validIds, monthKey())
      .first<{ totalBudgeted: number }>();
    totalBudgeted = Number(budgetRow?.totalBudgeted ?? 0);
  }

  const accountRow = await c.env.DB.prepare(
    `SELECT COALESCE(bank_balance, 0) AS bankBalance, COALESCE(to_be_budgeted, 0) AS toBeBudgeted FROM account_state WHERE id = ? LIMIT 1`
  ).bind(householdId).first<{ bankBalance: number; toBeBudgeted: number }>();

  return c.json({
    bankBalance:   round2(Number(accountRow?.bankBalance  ?? 0)),
    totalIncome:   round2(Number(incomeRow?.totalIncome   ?? 0)),
    totalBudgeted: round2(totalBudgeted),
    toBeBudgeted:  round2(Number(accountRow?.toBeBudgeted ?? 0)),
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
  const month = (body.month || "").trim() || monthKey();

  if (!categoryId || typeof body.amount !== "number" || Number.isNaN(body.amount)) {
    return c.json({ error: "Bad payload" }, 400);
  }
  const amount = round2(body.amount);

  const existing = await c.env.DB.prepare(
    `SELECT amount_budgeted FROM budget_lines WHERE category_id = ? AND month = ? LIMIT 1`
  )
    .bind(categoryId, month)
    .first<{ amount_budgeted: number }>();

  const oldAmount = round2(Number(existing?.amount_budgeted ?? 0));
  const delta = round2(amount - oldAmount);

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
  const month = (body.month || "").trim() || monthKey();

  if (!categoryId || typeof body.delta !== "number" || Number.isNaN(body.delta)) {
    return c.json({ error: "Bad payload" }, 400);
  }
  const delta = round2(body.delta);

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
  const date = (body.date || "").trim();
  const note = body.note ?? null;
  const direction: "in" | "out" = body.direction === "in" ? "in" : "out";

  if (!categoryId || typeof body.amount !== "number" || Number.isNaN(body.amount) || body.amount < 0 || !date) {
    return c.json({ error: "Bad payload" }, 400);
  }
  const amount = round2(body.amount);

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
    `SELECT category_id, MAX(amount_budgeted) as amount_budgeted FROM budget_lines WHERE month = ? AND household_id = ? GROUP BY category_id`
  )
    .bind(month, householdId)
    .all<{ category_id: string; amount_budgeted: number }>();

  const activityByCategory: Record<string, number> = {};
  const budgetByCategory: Record<string, number> = {};

  for (const r of activityRows.results ?? []) {
    activityByCategory[r.category_id] = round2(Number(r.activity || 0));
  }
  for (const r of budgetRows.results ?? []) {
    budgetByCategory[r.category_id] = round2(Number(r.amount_budgeted || 0));
  }

  const byCategory = categories
    .filter((cat) => cat.direction !== "inflow")
    .map((cat) => {
      const budgeted = budgetByCategory[cat.id] || 0;
      const activity = activityByCategory[cat.id] || 0;
      return { id: cat.id, name: cat.name, budgeted, activity, available: round2(budgeted - activity) };
    });

  return c.json({ byCategory });
});

// ---- GOALS (personal — user_id scoped, unchanged) ----
app.get("/api/goals", requireUser, async (c) => {
  const userId = c.get("userId");
  const rows = await c.env.DB.prepare(
    `SELECT id, title, status, due_date, notes, goal_type, target_amount, saved_amount, created_at, updated_at
     FROM goals WHERE user_id = ?
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, COALESCE(due_date, '9999-12-31') ASC, created_at DESC`
  )
    .bind(userId)
    .all<{ id: string; title: string; status: "active" | "done"; due_date: string | null; notes: string | null; goal_type: string; target_amount: number; saved_amount: number; created_at: string; updated_at: string }>();

  return c.json({ goals: rows.results ?? [] });
});

app.post("/api/goals", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ title?: string; dueDate?: string; notes?: string; goal_type?: string; target_amount?: number }>();
  const title = (body.title || "").trim();
  const dueDate = (body.dueDate || "").trim() || null;
  const notes = (body.notes || "").trim() || null;
  const goalType = body.goal_type === "savings" ? "savings" : "personal";
  const targetAmount = goalType === "savings" ? Number(body.target_amount ?? 0) : 0;

  if (!title) return c.json({ error: "Missing title" }, 400);

  const now = new Date().toISOString();
  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO goals (id, user_id, title, status, due_date, notes, goal_type, target_amount, saved_amount, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(id, userId, title, dueDate, notes, goalType, targetAmount, now, now)
    .run();

  return c.json({ ok: true, id });
});

app.patch("/api/goals/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ title?: string; dueDate?: string | null; notes?: string | null; status?: "active" | "done"; goal_type?: string; target_amount?: number; saved_amount?: number }>();

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
  if (body.goal_type !== undefined) { sets.push("goal_type = ?"); binds.push(body.goal_type === "savings" ? "savings" : "personal"); }
  if (body.target_amount !== undefined) { sets.push("target_amount = ?"); binds.push(Number(body.target_amount)); }
  if (body.saved_amount !== undefined) { sets.push("saved_amount = ?"); binds.push(Number(body.saved_amount)); }
  sets.push("updated_at = ?"); binds.push(now);

  await c.env.DB.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...binds, id, userId)
    .run();

  return c.json({ ok: true });
});

app.post("/api/goals/:id/contribute", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ amount?: number }>();
  const amount = Number(body.amount);

  if (Number.isNaN(amount) || amount <= 0) return c.json({ error: "Amount must be a positive number" }, 400);

  const goal = await c.env.DB.prepare(
    `SELECT id, target_amount, saved_amount FROM goals WHERE id = ? AND user_id = ? LIMIT 1`
  ).bind(id, userId).first<{ id: string; target_amount: number; saved_amount: number }>();

  if (!goal) return c.json({ error: "Not found" }, 404);

  const newSaved = Math.min(Number(goal.saved_amount) + amount, Number(goal.target_amount));
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE goals SET saved_amount = ?, updated_at = ? WHERE id = ? AND user_id = ?`
  ).bind(newSaved, now, id, userId).run();

  const isComplete = newSaved >= Number(goal.target_amount);
  if (isComplete) {
    await c.env.DB.prepare(
      `UPDATE goals SET status = 'done', updated_at = ? WHERE id = ? AND user_id = ?`
    ).bind(now, id, userId).run();
  }

  return c.json({ ok: true, saved_amount: newSaved, isComplete });
});

app.delete("/api/goals/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM goals WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  return c.json({ ok: true });
});

// ---- DEBTS (personal — user_id scoped, unchanged) ----
type DebtRow = { id: string; name: string; balance: number; apr: number; payment: number; payments_remaining: number; debt_type: string; principal_and_interest: number | null; includes_escrow: number; escrow_amount: number | null; created_at: string; updated_at: string };

app.get("/api/debts", requireUser, async (c) => {
  const userId = c.get("userId");
  const rows = await c.env.DB.prepare(
    `SELECT id, name, balance, apr, min_payment AS payment, payments_remaining,
     COALESCE(debt_type, 'other') AS debt_type,
     principal_and_interest, COALESCE(includes_escrow, 0) AS includes_escrow, escrow_amount,
     created_at, updated_at FROM debts WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(userId)
    .all<DebtRow>();
  return c.json({ debts: rows.results ?? [] });
});

app.post("/api/debts", requireUser, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    name?: string; balance?: number; apr?: number; payment?: number; paymentsRemaining?: number;
    debtType?: string; principalAndInterest?: number | null; includesEscrow?: boolean; escrowAmount?: number | null;
  }>();
  const name = (body.name || "").trim();
  const balance = Number(body.balance);
  const apr = Number(body.apr);
  const payment = Number(body.payment);
  const paymentsRemaining = Number(body.paymentsRemaining ?? 0);
  const debtType = body.debtType || "other";
  const principalAndInterest = body.principalAndInterest != null ? Number(body.principalAndInterest) : null;
  const includesEscrow = body.includesEscrow ? 1 : 0;
  const escrowAmount = body.escrowAmount != null ? Number(body.escrowAmount) : null;

  if (!name || Number.isNaN(balance) || Number.isNaN(apr) || Number.isNaN(payment)) {
    return c.json({ error: "Bad payload" }, 400);
  }

  const now = new Date().toISOString();
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO debts (id, user_id, name, balance, apr, min_payment, payments_remaining, debt_type, principal_and_interest, includes_escrow, escrow_amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, name, balance, apr, payment, paymentsRemaining, debtType, principalAndInterest, includesEscrow, escrowAmount, now, now)
    .run();

  return c.json({ ok: true, id });
});

app.patch("/api/debts/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string; balance?: number; apr?: number; payment?: number; paymentsRemaining?: number;
    debtType?: string; principalAndInterest?: number | null; includesEscrow?: boolean; escrowAmount?: number | null;
  }>();

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
  if (body.debtType !== undefined) { sets.push("debt_type = ?"); binds.push(body.debtType || "other"); }
  if (body.principalAndInterest !== undefined) { sets.push("principal_and_interest = ?"); binds.push(body.principalAndInterest != null ? Number(body.principalAndInterest) : null); }
  if (body.includesEscrow !== undefined) { sets.push("includes_escrow = ?"); binds.push(body.includesEscrow ? 1 : 0); }
  if (body.escrowAmount !== undefined) { sets.push("escrow_amount = ?"); binds.push(body.escrowAmount != null ? Number(body.escrowAmount) : null); }

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

  // Auto-push to Google Calendar if user has sync_events enabled
  c.executionCtx.waitUntil((async () => {
    try {
      const prefs = await c.env.DB.prepare(
        `SELECT sync_events FROM google_tokens WHERE user_id = ? LIMIT 1`
      ).bind(userId).first<{ sync_events: number }>();
      if (!prefs?.sync_events) return;
      const token = await getValidGoogleToken(c.env.DB, userId, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET);
      const gcBody: Record<string, unknown> = {
        summary: title,
        start: { dateTime: startAt, timeZone: "UTC" },
        end: { dateTime: endAt ?? startAt, timeZone: "UTC" },
      };
      if (location) gcBody.location = location;
      await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(gcBody),
      });
    } catch { /* silent — never block the response */ }
  })());

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
    `SELECT u.id, u.name, u.email, hm.role, hm.joined_at, COALESCE(u.account_type, 'standard') as account_type
     FROM household_members hm
     JOIN users u ON u.id = hm.user_id
     WHERE hm.household_id = ?
     ORDER BY hm.joined_at ASC`
  ).bind(householdId).all<{ id: string; name: string; email: string; role: string; joined_at: string; account_type: string }>();

  // Attach permissions for dependent members
  const memberList = members.results ?? [];
  const dependentIds = memberList.filter(m => m.account_type === "dependent").map(m => m.id);
  const permsMap = new Map<string, Record<string, boolean>>();
  for (const depId of dependentIds) {
    const perm = await c.env.DB.prepare(
      `SELECT * FROM dependent_permissions WHERE user_id = ? LIMIT 1`
    ).bind(depId).first<Record<string, number | string>>();
    if (perm) {
      permsMap.set(depId, {
        finances_enabled: perm.finances_enabled !== undefined ? !!perm.finances_enabled : true,
        can_see_budget: !!perm.can_see_budget,
        can_see_transactions: !!perm.can_see_transactions,
        can_see_bills: !!perm.can_see_bills,
        can_see_debts: !!perm.can_see_debts,
        can_see_spending: !!perm.can_see_spending,
        can_see_goals: !!perm.can_see_goals,
        can_add_chores: !!perm.can_add_chores,
        can_add_grocery: !!perm.can_add_grocery,
        can_add_calendar: !!perm.can_add_calendar,
        can_view_notes: !!perm.can_view_notes,
        can_post_notes: !!perm.can_post_notes,
        can_see_recipes: perm.can_see_recipes !== undefined ? !!perm.can_see_recipes : true,
        can_see_meals: perm.can_see_meals !== undefined ? !!perm.can_see_meals : true,
        can_see_todo: perm.can_see_todo !== undefined ? !!perm.can_see_todo : true,
        can_see_allowance: !!perm.can_see_allowance,
      });
    }
  }

  const membersWithPerms = memberList.map(m => ({
    ...m,
    permissions: m.account_type === "dependent" ? (permsMap.get(m.id) ?? null) : null,
  }));

  return c.json({ household, members: membersWithPerms });
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

  const body = await c.req.json<{ inviteeEmail?: string }>().catch(() => ({}));
  const inviteeEmail = (body.inviteeEmail || "").toLowerCase().trim();

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO household_invites (id, household_id, code, created_by, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).bind(uid(), householdId, code, userId, expiresAt, now).run();

  if (inviteeEmail) {
    const [inviter, household] = await Promise.all([
      c.env.DB.prepare(`SELECT name FROM users WHERE id = ? LIMIT 1`)
        .bind(userId).first<{ name: string }>(),
      c.env.DB.prepare(`SELECT name FROM households WHERE id = ? LIMIT 1`)
        .bind(householdId).first<{ name: string }>(),
    ]);
    const joinUrl = `${APP_ORIGIN}/join/${code}`;
    try {
      await sendEmail(c.env.RESEND_API_KEY, {
        to: inviteeEmail,
        subject: `${inviter?.name ?? "Someone"} invited you to join NestOtter`,
        html: householdInviteHtml(
          inviter?.name ?? "Your household",
          household?.name ?? "NestOtter",
          joinUrl
        ),
      });
    } catch (e) {
      console.error("Failed to send invite email:", e);
    }
  }

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

// ---- DEPENDENT ACCOUNTS ----

async function isAdminOrPrimary(db: D1Database, userId: string, householdId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT role FROM household_members WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(userId, householdId).first<{ role: string }>();
  return row?.role === "admin" || row?.role === "primary";
}

// Create a dependent account (admin/primary only)
app.post("/api/auth/signup-dependent", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const canManage = await isAdminOrPrimary(c.env.DB, userId, householdId);
  if (!canManage) return c.json({ error: "Only admins can create dependent accounts" }, 403);

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
  const depUserId = uid();

  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, email_verified, account_type, created_at) VALUES (?, ?, ?, ?, 0, 'dependent', ?)`
  ).bind(depUserId, name, email, passwordHash, now).run();

  await c.env.DB.prepare(
    `INSERT INTO household_members (id, household_id, user_id, role, joined_at) VALUES (?, ?, ?, 'member', ?)`
  ).bind(uid(), householdId, depUserId, now).run();

  // Seed default permissions (household features on; everything financial off)
  await c.env.DB.prepare(
    `INSERT INTO dependent_permissions
       (id, user_id, household_id,
        finances_enabled, can_see_budget, can_see_transactions, can_see_bills, can_see_debts, can_see_spending,
        can_see_goals, can_add_chores, can_add_grocery, can_add_calendar, can_view_notes, can_post_notes,
        can_see_recipes, can_see_meals, can_see_todo, can_see_allowance,
        created_at, updated_at)
     VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, ?, ?)`
  ).bind(uid(), depUserId, householdId, now, now).run();

  return c.json({ ok: true, userId: depUserId, name });
});

// Update dependent permissions (admin/primary only)
app.patch("/api/household/members/:userId/permissions", requireUser, async (c) => {
  const requesterId = c.get("userId");
  const targetUserId = c.req.param("userId");
  const householdId = await getUserHouseholdId(c.env.DB, requesterId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const canManage = await isAdminOrPrimary(c.env.DB, requesterId, householdId);
  if (!canManage) return c.json({ error: "Only admins can update permissions" }, 403);

  const body = await c.req.json<Record<string, boolean>>();
  const allowed = [
    "finances_enabled",
    "can_see_budget","can_see_transactions","can_see_bills","can_see_debts","can_see_spending",
    "can_see_goals","can_add_chores","can_add_grocery","can_add_calendar",
    "can_view_notes","can_post_notes",
    "can_see_recipes","can_see_meals","can_see_todo","can_see_allowance",
  ];

  const sets: string[] = [];
  const binds: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`);
      binds.push(body[key] ? 1 : 0);
    }
  }
  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);

  const now = new Date().toISOString();
  sets.push("updated_at = ?");
  binds.push(now);
  binds.push(targetUserId);

  await c.env.DB.prepare(
    `UPDATE dependent_permissions SET ${sets.join(", ")} WHERE user_id = ?`
  ).bind(...binds).run();

  return c.json({ ok: true });
});

// ── Allowance endpoints ───────────────────────────────────────────────────────

// Parent: get allowance for a specific dependent
app.get("/api/allowance/:userId", requireUser, async (c) => {
  const requesterId = c.get("userId");
  const targetUserId = c.req.param("userId");
  const householdId = await getUserHouseholdId(c.env.DB, requesterId);
  if (!householdId) return c.json({ error: "No household" }, 404);
  const canManage = await isAdminOrPrimary(c.env.DB, requesterId, householdId);
  if (!canManage) return c.json({ error: "Forbidden" }, 403);
  const row = await c.env.DB.prepare(
    `SELECT * FROM allowances WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(targetUserId, householdId).first<{ id: string; amount: number; frequency: string; notes: string | null }>();
  return c.json({ allowance: row ?? null });
});

// Parent: set/update allowance for a dependent
app.put("/api/allowance/:userId", requireUser, async (c) => {
  const requesterId = c.get("userId");
  const targetUserId = c.req.param("userId");
  const householdId = await getUserHouseholdId(c.env.DB, requesterId);
  if (!householdId) return c.json({ error: "No household" }, 404);
  const canManage = await isAdminOrPrimary(c.env.DB, requesterId, householdId);
  if (!canManage) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ amount?: number; frequency?: string; notes?: string }>();
  const amount = Number(body.amount ?? 0);
  const frequency = ["weekly", "monthly"].includes(body.frequency ?? "") ? body.frequency! : "weekly";
  const notes = (body.notes ?? "").trim() || null;
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare(
    `SELECT id FROM allowances WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(targetUserId, householdId).first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE allowances SET amount = ?, frequency = ?, notes = ?, updated_at = ? WHERE id = ?`
    ).bind(amount, frequency, notes, now, existing.id).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO allowances (id, household_id, user_id, amount, frequency, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(uid(), householdId, targetUserId, amount, frequency, notes, now, now).run();
  }
  return c.json({ ok: true });
});

// Dependent: get own allowance
app.get("/api/allowance/mine", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 404);
  const row = await c.env.DB.prepare(
    `SELECT amount, frequency, notes FROM allowances WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(userId, householdId).first<{ amount: number; frequency: string; notes: string | null }>();
  return c.json({ allowance: row ?? null });
});

// Update household member role (admin only)
app.patch("/api/household/members/:userId/role", requireUser, async (c) => {
  const requesterId = c.get("userId");
  const targetUserId = c.req.param("userId");
  const householdId = await getUserHouseholdId(c.env.DB, requesterId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const myRole = await c.env.DB.prepare(
    `SELECT role FROM household_members WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(requesterId, householdId).first<{ role: string }>();
  if (myRole?.role !== "admin") return c.json({ error: "Only admins can change roles" }, 403);

  const body = await c.req.json<{ role?: string }>();
  const newRole = body.role;
  if (!newRole || !["admin","member","primary"].includes(newRole)) {
    return c.json({ error: "Invalid role. Must be admin, primary, or member" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE household_members SET role = ? WHERE user_id = ? AND household_id = ?`
  ).bind(newRole, targetUserId, householdId).run();

  return c.json({ ok: true });
});

// ── Child profiles (no-account household members) ─────
app.get("/api/household/children", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ children: [] });
  const rows = await c.env.DB.prepare(
    `SELECT id, name, emoji, created_at FROM child_profiles WHERE household_id = ? ORDER BY name ASC`
  ).bind(householdId).all<{ id: string; name: string; emoji: string; created_at: string }>();
  return c.json({ children: rows.results ?? [] });
});

app.post("/api/household/children", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const myRole = await c.env.DB.prepare(
    `SELECT role FROM household_members WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(userId, householdId).first<{ role: string }>();
  if (!["admin","primary"].includes(myRole?.role ?? "")) return c.json({ error: "Only admins can add children" }, 403);

  const body = await c.req.json<{ name?: string; emoji?: string }>();
  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "Name is required" }, 400);
  const emoji = (body.emoji ?? "🧒").trim();

  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO child_profiles (id, household_id, name, emoji, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, householdId, name, emoji, now).run();

  return c.json({ ok: true, id, name, emoji });
});

app.patch("/api/household/children/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const childId = c.req.param("id");
  const body = await c.req.json<{ name?: string; emoji?: string }>();
  const sets: string[] = []; const binds: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); binds.push(body.name.trim()); }
  if (body.emoji !== undefined) { sets.push("emoji = ?"); binds.push(body.emoji.trim()); }
  if (!sets.length) return c.json({ error: "Nothing to update" }, 400);

  binds.push(childId, householdId);
  await c.env.DB.prepare(
    `UPDATE child_profiles SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`
  ).bind(...binds).run();
  return c.json({ ok: true });
});

app.delete("/api/household/children/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const myRole = await c.env.DB.prepare(
    `SELECT role FROM household_members WHERE user_id = ? AND household_id = ? LIMIT 1`
  ).bind(userId, householdId).first<{ role: string }>();
  if (!["admin","primary"].includes(myRole?.role ?? "")) return c.json({ error: "Only admins can remove children" }, 403);

  const childId = c.req.param("id");
  await c.env.DB.prepare(
    `DELETE FROM child_profiles WHERE id = ? AND household_id = ?`
  ).bind(childId, householdId).run();
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

// ---- RECIPES ----

app.get("/api/recipes", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ recipes: [] });

  const rows = await c.env.DB.prepare(
    `SELECT r.id, r.title, r.type, r.description, r.prep_time, r.cook_time,
     r.servings, r.created_at,
     COUNT(ri.id) as ingredient_count
     FROM recipes r
     LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
     WHERE r.household_id = ?
     GROUP BY r.id
     ORDER BY r.type ASC, r.title ASC`
  ).bind(householdId).all<{
    id: string; title: string; type: string; description: string | null;
    prep_time: number | null; cook_time: number | null; servings: number | null;
    created_at: string; ingredient_count: number;
  }>();

  return c.json({ recipes: rows.results ?? [] });
});

app.get("/api/recipes/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 404);

  const recipe = await c.env.DB.prepare(
    `SELECT id, title, type, description, prep_time, cook_time, servings, directions, created_at
     FROM recipes WHERE id = ? AND household_id = ? LIMIT 1`
  ).bind(id, householdId).first<{
    id: string; title: string; type: string; description: string | null;
    prep_time: number | null; cook_time: number | null; servings: number | null;
    directions: string | null; created_at: string;
  }>();

  if (!recipe) return c.json({ error: "Not found" }, 404);

  const ingredients = await c.env.DB.prepare(
    `SELECT id, name, quantity, unit, sort_order
     FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC`
  ).bind(id).all<{
    id: string; name: string; quantity: string | null; unit: string | null; sort_order: number;
  }>();

  return c.json({ recipe, ingredients: ingredients.results ?? [] });
});

app.post("/api/recipes", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{
    title?: string; type?: string; description?: string;
    prepTime?: number; cookTime?: number; servings?: number; directions?: string;
    ingredients?: { name: string; quantity?: string; unit?: string }[];
  }>();

  const title = (body.title || "").trim();
  if (!title) return c.json({ error: "Title required" }, 400);

  const validTypes = ["soup_salad", "main", "appetizer", "dessert", "snack"];
  const type = validTypes.includes(body.type || "") ? body.type! : "main";

  const now = new Date().toISOString();
  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO recipes (id, household_id, title, type, description, prep_time, cook_time, servings, directions, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, householdId, title, type, body.description || null,
    body.prepTime || null, body.cookTime || null, body.servings || null,
    body.directions || null, userId, now, now).run();

  const ingredients = body.ingredients ?? [];
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    if (!ing.name?.trim()) continue;
    await c.env.DB.prepare(
      `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(uid(), id, ing.name.trim(), ing.quantity || null, ing.unit || null, i).run();
  }

  return c.json({ ok: true, id });
});

app.post("/api/recipes/import-url", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{ url?: string }>();
  const url = (body.url || "").trim();
  if (!url) return c.json({ error: "URL required" }, 400);

  // Fetch HTML with realistic browser headers to bypass bot detection
  let html: string;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      redirect: "follow",
    });
    if (!resp.ok) return c.json({ error: "Could not fetch that URL" }, 400);
    html = await resp.text();
  } catch {
    return c.json({ error: "Could not fetch that URL" }, 400);
  }

  function parseDuration(iso: string | undefined): number | null {
    if (!iso) return null;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
    if (!m) return null;
    const mins = (parseInt(m[1] || "0") * 60) + parseInt(m[2] || "0");
    return mins || null;
  }

  function parseServings(val: unknown): number | null {
    if (!val) return null;
    if (typeof val === "number") return val;
    const s = Array.isArray(val) ? String(val[0]) : String(val);
    const n = s.match(/\d+/);
    return n ? parseInt(n[0]) : null;
  }

  function parseInstructions(steps: unknown[]): string {
    return steps.map((step, i) => {
      const text = typeof step === "string" ? step : ((step as any).text || (step as any).name || "");
      return `${i + 1}. ${text.trim()}`;
    }).filter(Boolean).join("\n");
  }

  // PRIORITY 1 — JSON-LD structured data
  let title = "";
  let description = "";
  let ingredientStrings: string[] = [];
  let directions = "";
  let prepTime: number | null = null;
  let cookTime: number | null = null;
  let servings: number | null = null;

  // Broader JSON-LD regex: also handles unquoted type attribute
  const scriptRegex = /<script[^>]+type=(?:["']application\/ld\+json["']|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  let recipeNode: any = null;

  const isRecipeType = (node: any) =>
    node?.["@type"] === "Recipe" ||
    (Array.isArray(node?.["@type"]) && node["@type"].includes("Recipe"));

  while ((scriptMatch = scriptRegex.exec(html)) !== null && !recipeNode) {
    try {
      const parsed = JSON.parse(scriptMatch[1]);
      if (isRecipeType(parsed)) {
        recipeNode = parsed;
      } else if (Array.isArray(parsed["@graph"])) {
        recipeNode = parsed["@graph"].find(isRecipeType) ?? null;
      }
    } catch { /* malformed JSON-LD — skip */ }
  }

  if (recipeNode) {
    title = (recipeNode.name || "").trim();
    description = (recipeNode.description || "").trim();
    ingredientStrings = Array.isArray(recipeNode.recipeIngredient)
      ? recipeNode.recipeIngredient.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];
    if (Array.isArray(recipeNode.recipeInstructions)) {
      directions = parseInstructions(recipeNode.recipeInstructions);
    }
    prepTime = parseDuration(recipeNode.prepTime);
    cookTime = parseDuration(recipeNode.cookTime);
    servings = parseServings(recipeNode.recipeYield ?? recipeNode.yield);
  }

  // PRIORITY 2 — OG / meta tag fallback for name and description
  if (!title) {
    const m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if (m) title = m[1].trim();
  }
  if (!title) {
    const m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (m) title = m[1].trim();
  }
  if (!description) {
    const m = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
      ?? html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (m) description = m[1].trim();
  }

  // PRIORITY 3 — HTML heuristic fallback for ingredients
  if (ingredientStrings.length === 0) {
    // Pattern 1: <li> elements with "ingredient" in their class
    const liMatches = html.matchAll(/<li[^>]*class=[^>]*ingredient[^>]*>([^<]+(?:<(?!\/li)[^<]*)*)<\/li>/gi);
    for (const m of liMatches) {
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      if (text && text.length > 2 && text.length < 200) ingredientStrings.push(text);
    }

    // Pattern 2: <span> elements with "ingredient" in their class
    if (ingredientStrings.length === 0) {
      const spanMatches = html.matchAll(/<span[^>]*class=[^>]*ingredient[^>]*>([^<]+)<\/span>/gi);
      for (const m of spanMatches) {
        const text = m[1].replace(/<[^>]+>/g, "").trim();
        if (text && text.length > 2 && text.length < 200) ingredientStrings.push(text);
      }
    }

    // Deduplicate
    ingredientStrings = [...new Set(ingredientStrings)];
  }

  // PRIORITY 4 — fail with debug log and helpful message
  if (ingredientStrings.length === 0) {
    console.error("[import-url] No ingredients found. HTML preview:", html.slice(0, 500));
    return c.json({ error: "We couldn't extract a recipe from that URL. This sometimes happens with sites that block automated requests. Try copying the recipe manually." }, 400);
  }

  if (!title) title = "Imported Recipe";

  // Save recipe using existing pattern
  const now = new Date().toISOString();
  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO recipes (id, household_id, title, type, description, prep_time, cook_time, servings, directions, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, householdId, title, "main", description || null,
    prepTime, cookTime, servings, directions || null, userId, now, now).run();

  for (let i = 0; i < ingredientStrings.length; i++) {
    await c.env.DB.prepare(
      `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(uid(), id, ingredientStrings[i], null, null, i).run();
  }

  return c.json({ ok: true, id, title, description, ingredientCount: ingredientStrings.length });
});

app.patch("/api/recipes/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{
    title?: string; type?: string; description?: string;
    prepTime?: number; cookTime?: number; servings?: number; directions?: string;
    ingredients?: { name: string; quantity?: string; unit?: string }[];
  }>();

  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const binds: unknown[] = [now];

  if (body.title !== undefined) { const t = (body.title || "").trim(); if (!t) return c.json({ error: "Title required" }, 400); sets.push("title = ?"); binds.push(t); }
  if (body.type !== undefined) { sets.push("type = ?"); binds.push(body.type); }
  if (body.description !== undefined) { sets.push("description = ?"); binds.push(body.description || null); }
  if (body.prepTime !== undefined) { sets.push("prep_time = ?"); binds.push(body.prepTime); }
  if (body.cookTime !== undefined) { sets.push("cook_time = ?"); binds.push(body.cookTime); }
  if (body.servings !== undefined) { sets.push("servings = ?"); binds.push(body.servings); }
  if (body.directions !== undefined) { sets.push("directions = ?"); binds.push(body.directions || null); }

  await c.env.DB.prepare(
    `UPDATE recipes SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`
  ).bind(...binds, id, householdId).run();

  if (body.ingredients !== undefined) {
    await c.env.DB.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`).bind(id).run();
    for (let i = 0; i < body.ingredients.length; i++) {
      const ing = body.ingredients[i];
      if (!ing.name?.trim()) continue;
      await c.env.DB.prepare(
        `INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(uid(), id, ing.name.trim(), ing.quantity || null, ing.unit || null, i).run();
    }
  }

  return c.json({ ok: true });
});

app.delete("/api/recipes/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  await c.env.DB.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM meal_plans WHERE recipe_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM recipes WHERE id = ? AND household_id = ?`).bind(id, householdId).run();

  return c.json({ ok: true });
});

// ---- MEAL PLANS ----

app.get("/api/meals/upcoming", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ meals: [] });

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const rows = await c.env.DB.prepare(
    `SELECT mp.id, mp.planned_date, mp.meal_type, r.title as recipe_title, r.type as recipe_type
     FROM meal_plans mp
     JOIN recipes r ON r.id = mp.recipe_id
     WHERE mp.household_id = ? AND mp.planned_date >= ? AND mp.planned_date <= ?
     ORDER BY mp.planned_date ASC LIMIT 5`
  ).bind(householdId, today, in7).all<{
    id: string; planned_date: string; meal_type: string;
    recipe_title: string; recipe_type: string;
  }>();

  return c.json({ meals: rows.results ?? [] });
});

app.get("/api/meals", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ meals: [] });

  const start = c.req.query("start") || "";
  const end = c.req.query("end") || "";

  let query = `
    SELECT mp.id, mp.planned_date, mp.meal_type, mp.notes, mp.recipe_id,
           r.title as recipe_title, r.type as recipe_type,
           r.prep_time, r.cook_time, r.servings
    FROM meal_plans mp
    JOIN recipes r ON r.id = mp.recipe_id
    WHERE mp.household_id = ?`;
  const binds: unknown[] = [householdId];

  if (start) { query += ` AND mp.planned_date >= ?`; binds.push(start); }
  if (end) { query += ` AND mp.planned_date <= ?`; binds.push(end); }
  query += ` ORDER BY mp.planned_date ASC, mp.meal_type ASC`;

  const rows = await c.env.DB.prepare(query).bind(...binds).all<{
    id: string; planned_date: string; meal_type: string; notes: string | null;
    recipe_id: string; recipe_title: string; recipe_type: string;
    prep_time: number | null; cook_time: number | null; servings: number | null;
  }>();

  return c.json({ meals: rows.results ?? [] });
});

app.post("/api/meals", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{
    recipeId?: string; plannedDate?: string; mealType?: string; notes?: string;
  }>();

  const recipeId = (body.recipeId || "").trim();
  const plannedDate = (body.plannedDate || "").trim();
  if (!recipeId || !plannedDate) return c.json({ error: "recipeId and plannedDate required" }, 400);

  const recipe = await c.env.DB.prepare(
    `SELECT id FROM recipes WHERE id = ? AND household_id = ? LIMIT 1`
  ).bind(recipeId, householdId).first<{ id: string }>();
  if (!recipe) return c.json({ error: "Recipe not found" }, 404);

  const now = new Date().toISOString();
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO meal_plans (id, household_id, recipe_id, planned_date, meal_type, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, householdId, recipeId, plannedDate, body.mealType || "dinner", body.notes || null, userId, now).run();

  // Auto-push to Google Calendar if user has sync_meals enabled
  c.executionCtx.waitUntil((async () => {
    try {
      const prefs = await c.env.DB.prepare(
        `SELECT sync_meals FROM google_tokens WHERE user_id = ? LIMIT 1`
      ).bind(userId).first<{ sync_meals: number }>();
      if (!prefs?.sync_meals) return;
      const token = await getValidGoogleToken(c.env.DB, userId, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET);
      const recipeRow = await c.env.DB.prepare(
        `SELECT title FROM recipes WHERE id = ? LIMIT 1`
      ).bind(recipeId).first<{ title: string }>();
      const mealType = body.mealType || "dinner";
      const summary = recipeRow ? `${mealType.charAt(0).toUpperCase() + mealType.slice(1)}: ${recipeRow.title}` : mealType;
      await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          start: { date: plannedDate },
          end: { date: plannedDate },
        }),
      });
    } catch { /* silent */ }
  })());

  return c.json({ ok: true, id });
});

app.delete("/api/meals/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  await c.env.DB.prepare(
    `DELETE FROM meal_plans WHERE id = ? AND household_id = ?`
  ).bind(id, householdId).run();

  return c.json({ ok: true });
});

// ---- GROCERY LISTS ----

app.get("/api/grocery/lists", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ lists: [] });

  const lists = await c.env.DB.prepare(
    `SELECT gl.id, gl.name, gl.created_at,
     COUNT(gi.id) as total_items,
     SUM(CASE WHEN gi.checked = 1 THEN 1 ELSE 0 END) as checked_items
     FROM grocery_lists gl
     LEFT JOIN grocery_items gi ON gi.list_id = gl.id
     WHERE gl.household_id = ?
     GROUP BY gl.id
     ORDER BY gl.created_at DESC`
  ).bind(householdId).all<{
    id: string; name: string; created_at: string;
    total_items: number; checked_items: number;
  }>();

  return c.json({ lists: lists.results ?? [] });
});

app.post("/api/grocery/lists", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{ name?: string }>();
  const name = (body.name || "").trim();
  if (!name) return c.json({ error: "List name required" }, 400);

  const now = new Date().toISOString();
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO grocery_lists (id, household_id, name, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, householdId, name, userId, now, now).run();

  return c.json({ ok: true, id });
});

app.delete("/api/grocery/lists/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  await c.env.DB.prepare(`DELETE FROM grocery_items WHERE list_id = ?`).bind(id).run();
  await c.env.DB.prepare(
    `DELETE FROM grocery_lists WHERE id = ? AND household_id = ?`
  ).bind(id, householdId).run();

  return c.json({ ok: true });
});

app.get("/api/grocery/lists/:id/items", requireUser, async (c) => {
  const userId = c.get("userId");
  const listId = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ items: [] });

  const items = await c.env.DB.prepare(
    `SELECT gi.id, gi.name, gi.quantity, gi.category, gi.checked, gi.added_by,
     u.name as added_by_name
     FROM grocery_items gi
     LEFT JOIN users u ON u.id = gi.added_by
     WHERE gi.list_id = ? AND gi.household_id = ?
     ORDER BY gi.checked ASC, gi.created_at ASC`
  ).bind(listId, householdId).all<{
    id: string; name: string; quantity: string | null;
    category: string | null; checked: number;
    added_by: string; added_by_name: string | null;
  }>();

  return c.json({ items: items.results ?? [] });
});

app.post("/api/grocery/lists/:id/items", requireUser, async (c) => {
  const userId = c.get("userId");
  const listId = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{ name?: string; quantity?: string; category?: string }>();
  const name = (body.name || "").trim();
  if (!name) return c.json({ error: "Item name required" }, 400);

  const now = new Date().toISOString();
  const id = uid();
  await c.env.DB.prepare(
    `INSERT INTO grocery_items (id, list_id, household_id, name, quantity, category, checked, added_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(id, listId, householdId, name, body.quantity || null, body.category || null, userId, now, now).run();

  return c.json({ ok: true, id });
});

app.patch("/api/grocery/items/:id/check", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const item = await c.env.DB.prepare(
    `SELECT id, checked FROM grocery_items WHERE id = ? AND household_id = ? LIMIT 1`
  ).bind(id, householdId).first<{ id: string; checked: number }>();

  if (!item) return c.json({ error: "Not found" }, 404);

  const newChecked = item.checked === 1 ? 0 : 1;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE grocery_items SET checked = ?, checked_by = ?, updated_at = ? WHERE id = ?`
  ).bind(newChecked, newChecked === 1 ? userId : null, now, id).run();

  return c.json({ ok: true, checked: newChecked });
});

app.delete("/api/grocery/items/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  await c.env.DB.prepare(
    `DELETE FROM grocery_items WHERE id = ? AND household_id = ?`
  ).bind(id, householdId).run();

  return c.json({ ok: true });
});

app.post("/api/grocery/lists/:id/clear-checked", requireUser, async (c) => {
  const userId = c.get("userId");
  const listId = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  await c.env.DB.prepare(
    `DELETE FROM grocery_items WHERE list_id = ? AND household_id = ? AND checked = 1`
  ).bind(listId, householdId).run();

  return c.json({ ok: true });
});

// ---- CHORES ----

app.get("/api/chores", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ chores: [] });

  const rows = await c.env.DB.prepare(
    `SELECT ch.id, ch.title, ch.assigned_to, ch.frequency, ch.due_date,
     ch.completed, ch.completed_at, ch.created_at,
     COALESCE(u.name, cp.name) as assigned_to_name,
     CASE WHEN cp.id IS NOT NULL THEN 1 ELSE 0 END as assigned_to_is_child
     FROM chores ch
     LEFT JOIN users u ON u.id = ch.assigned_to
     LEFT JOIN child_profiles cp ON cp.id = ch.assigned_to
     WHERE ch.household_id = ?
     ORDER BY ch.completed ASC, ch.due_date ASC, ch.created_at ASC`
  ).bind(householdId).all<{
    id: string; title: string; assigned_to: string | null;
    frequency: string; due_date: string | null;
    completed: number; completed_at: string | null;
    created_at: string; assigned_to_name: string | null;
  }>();

  return c.json({ chores: rows.results ?? [] });
});

app.post("/api/chores", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{
    title?: string; assignedTo?: string;
    frequency?: string; dueDate?: string;
  }>();

  const title = (body.title || "").trim();
  if (!title) return c.json({ error: "Title required" }, 400);

  const frequency = body.frequency || "weekly";
  const now = new Date().toISOString();
  const id = uid();

  await c.env.DB.prepare(
    `INSERT INTO chores (id, household_id, title, assigned_to, frequency, due_date, completed, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(id, householdId, title, body.assignedTo || null, frequency, body.dueDate || null, userId, now, now).run();

  return c.json({ ok: true, id });
});

app.patch("/api/chores/:id/complete", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const chore = await c.env.DB.prepare(
    `SELECT id, completed FROM chores WHERE id = ? AND household_id = ? LIMIT 1`
  ).bind(id, householdId).first<{ id: string; completed: number }>();

  if (!chore) return c.json({ error: "Not found" }, 404);

  const newCompleted = chore.completed === 1 ? 0 : 1;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE chores SET completed = ?, completed_by = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(newCompleted, newCompleted === 1 ? userId : null, newCompleted === 1 ? now : null, now, id).run();

  return c.json({ ok: true, completed: newCompleted });
});

app.patch("/api/chores/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  const body = await c.req.json<{
    title?: string; assignedTo?: string | null;
    frequency?: string; dueDate?: string | null;
  }>();

  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.title !== undefined) {
    const t = (body.title || "").trim();
    if (!t) return c.json({ error: "Title required" }, 400);
    sets.push("title = ?"); binds.push(t);
  }
  if (body.assignedTo !== undefined) { sets.push("assigned_to = ?"); binds.push(body.assignedTo); }
  if (body.frequency !== undefined) { sets.push("frequency = ?"); binds.push(body.frequency); }
  if (body.dueDate !== undefined) { sets.push("due_date = ?"); binds.push(body.dueDate); }

  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);

  const now = new Date().toISOString();
  sets.push("updated_at = ?"); binds.push(now);

  await c.env.DB.prepare(
    `UPDATE chores SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`
  ).bind(...binds, id, householdId).run();

  return c.json({ ok: true });
});

app.delete("/api/chores/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);

  await c.env.DB.prepare(
    `DELETE FROM chores WHERE id = ? AND household_id = ?`
  ).bind(id, householdId).run();

  return c.json({ ok: true });
});

// ---- TODO LISTS ----

function todayReset2amUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0)).toISOString();
}

function validResetBefore(raw: string | undefined): string {
  if (!raw) return todayReset2amUTC();
  const d = new Date(raw);
  if (isNaN(d.getTime())) return todayReset2amUTC();
  // Clamp: must be within ±14 hours of UTC midnight today to be a plausible "2am local"
  const nowUtc = Date.now();
  const diff = Math.abs(nowUtc - d.getTime());
  if (diff > 14 * 60 * 60 * 1000 * 2) return todayReset2amUTC(); // sanity check
  return d.toISOString();
}

app.get("/api/todo/lists", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ lists: [] });
  // Return family lists (owner_user_id IS NULL) + this user's personal lists
  const rows = await c.env.DB.prepare(
    `SELECT tl.id, tl.title, tl.list_type, tl.owner_user_id,
            u.name AS owner_name, tl.created_at
     FROM todo_lists tl
     LEFT JOIN users u ON u.id = tl.owner_user_id
     WHERE tl.household_id = ?
       AND (tl.owner_user_id IS NULL OR tl.owner_user_id = ?)
     ORDER BY tl.owner_user_id IS NOT NULL ASC, tl.created_at ASC`
  ).bind(householdId, userId).all<{
    id: string; title: string; list_type: string;
    owner_user_id: string | null; owner_name: string | null; created_at: string;
  }>();
  return c.json({ lists: rows.results ?? [] });
});

app.post("/api/todo/lists", requireUser, async (c) => {
  const userId = c.get("userId");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);
  const body = await c.req.json<{ title?: string; listType?: string; ownerUserId?: string | null }>();
  const title = (body.title || "").trim();
  if (!title) return c.json({ error: "Title required" }, 400);
  const listType = body.listType === "daily" ? "daily" : "onetime";
  // null = family/shared; a userId = personal to that member
  let ownerUserId: string | null = null;
  if (body.ownerUserId && body.ownerUserId !== "family") {
    // Verify the target user is in the same household
    const member = await c.env.DB.prepare(
      `SELECT user_id FROM household_members WHERE user_id = ? AND household_id = ? LIMIT 1`
    ).bind(body.ownerUserId, householdId).first<{ user_id: string }>();
    if (member) ownerUserId = body.ownerUserId;
  }
  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO todo_lists (id, household_id, title, list_type, owner_user_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, householdId, title, listType, ownerUserId, userId, now).run();
  return c.json({ ok: true, id });
});

app.patch("/api/todo/lists/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);
  const body = await c.req.json<{ title?: string }>();
  const title = (body.title || "").trim();
  if (!title) return c.json({ error: "Title required" }, 400);
  await c.env.DB.prepare(
    `UPDATE todo_lists SET title = ? WHERE id = ? AND household_id = ?`
  ).bind(title, id, householdId).run();
  return c.json({ ok: true });
});

app.delete("/api/todo/lists/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);
  await c.env.DB.prepare(
    `DELETE FROM todo_lists WHERE id = ? AND household_id = ?`
  ).bind(id, householdId).run();
  return c.json({ ok: true });
});

app.get("/api/todo/lists/:id/items", requireUser, async (c) => {
  const userId = c.get("userId");
  const listId = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ items: [], listType: "onetime" });
  const list = await c.env.DB.prepare(
    `SELECT list_type FROM todo_lists WHERE id = ? AND household_id = ? LIMIT 1`
  ).bind(listId, householdId).first<{ list_type: string }>();
  if (!list) return c.json({ error: "Not found" }, 404);
  if (list.list_type === "daily") {
    const resetBefore = validResetBefore(c.req.query("resetBefore"));
    await c.env.DB.prepare(
      `UPDATE todo_items SET completed = 0, completed_at = NULL
       WHERE list_id = ? AND completed = 1 AND completed_at < ?`
    ).bind(listId, resetBefore).run();
  }
  const rows = await c.env.DB.prepare(
    `SELECT id, title, completed, completed_at, created_at
     FROM todo_items WHERE list_id = ? ORDER BY created_at ASC`
  ).bind(listId).all<{ id: string; title: string; completed: number; completed_at: string | null; created_at: string }>();
  return c.json({ items: rows.results ?? [], listType: list.list_type });
});

app.post("/api/todo/lists/:id/items", requireUser, async (c) => {
  const userId = c.get("userId");
  const listId = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);
  const body = await c.req.json<{ title?: string }>();
  const title = (body.title || "").trim();
  if (!title) return c.json({ error: "Title required" }, 400);
  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO todo_items (id, list_id, household_id, title, completed, created_at) VALUES (?, ?, ?, ?, 0, ?)`
  ).bind(id, listId, householdId, title, now).run();
  return c.json({ ok: true, id });
});

app.patch("/api/todo/items/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);
  const item = await c.env.DB.prepare(
    `SELECT completed FROM todo_items WHERE id = ? AND household_id = ? LIMIT 1`
  ).bind(id, householdId).first<{ completed: number }>();
  if (!item) return c.json({ error: "Not found" }, 404);
  const newCompleted = item.completed ? 0 : 1;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE todo_items SET completed = ?, completed_at = ? WHERE id = ? AND household_id = ?`
  ).bind(newCompleted, newCompleted ? now : null, id, householdId).run();
  return c.json({ ok: true });
});

app.delete("/api/todo/items/:id", requireUser, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const householdId = await getUserHouseholdId(c.env.DB, userId);
  if (!householdId) return c.json({ error: "No household" }, 400);
  await c.env.DB.prepare(
    `DELETE FROM todo_items WHERE id = ? AND household_id = ?`
  ).bind(id, householdId).run();
  return c.json({ ok: true });
});

// ---- ADMIN API ----

const admin = new Hono<{ Bindings: Bindings }>();

// CORS for admin: allow null (file://) and the app origin
admin.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const isAllowed = origin === "null" || origin === APP_ORIGIN || origin === APP_ORIGIN_LEGACY;

  if (isAllowed) {
    c.header("Access-Control-Allow-Origin", origin!);
    c.header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
    c.header("Access-Control-Allow-Methods", "GET,OPTIONS");
    c.header("Vary", "Origin");
  }

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
});

// ADMIN_KEY auth middleware
admin.use("*", async (c, next) => {
  const key = c.req.header("X-Admin-Key");
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

admin.get("/stats", async (c) => {
  try {
    const db = c.env.DB;

    const [
      usersRow,
      householdsRow,
      multiRow,
      spendsRow,
      billsRow,
      goalsRow,
      debtsRow,
      eventsRow,
      sessionsRow,
      signupsRows,
    ] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as n FROM users`).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) as n FROM households`).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) as n FROM (SELECT household_id FROM household_members GROUP BY household_id HAVING COUNT(*) > 1)`
      ).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) as n FROM manual_spends`).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) as n FROM bills`).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) as n FROM goals`).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) as n FROM debts`).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) as n FROM calendar_events`).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) as n FROM sessions WHERE expires_at > datetime('now')`
      ).first<{ n: number }>(),
      db.prepare(
        `SELECT strftime('%Y-%m-%d', created_at) as day, COUNT(*) as signups FROM users GROUP BY day ORDER BY day ASC`
      ).all<{ day: string; signups: number }>(),
    ]);

    return c.json({
      stats: {
        total_users: usersRow?.n ?? 0,
        total_households: householdsRow?.n ?? 0,
        multi_member_households: multiRow?.n ?? 0,
        total_spends: spendsRow?.n ?? 0,
        total_bills: billsRow?.n ?? 0,
        total_goals: goalsRow?.n ?? 0,
        total_debts: debtsRow?.n ?? 0,
        total_events: eventsRow?.n ?? 0,
        active_sessions: sessionsRow?.n ?? 0,
      },
      signups_by_day: signupsRows.results ?? [],
    });
  } catch {
    return c.json({ error: "Internal error" }, 500);
  }
});

admin.get("/users", async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT
        u.name,
        u.email,
        u.created_at,
        h.name as household_name,
        (SELECT COUNT(*) FROM manual_spends ms WHERE ms.user_id = u.id) as spend_count,
        (SELECT COUNT(*) FROM bills b
         JOIN household_members hm2 ON hm2.household_id = b.household_id
         WHERE hm2.user_id = u.id LIMIT 1) as has_bills,
        (SELECT COUNT(*) FROM goals g WHERE g.user_id = u.id) as goal_count
       FROM users u
       LEFT JOIN household_members hm ON hm.user_id = u.id
       LEFT JOIN households h ON h.id = hm.household_id
       ORDER BY u.created_at DESC`
    ).all<{
      name: string;
      email: string;
      created_at: string;
      household_name: string | null;
      spend_count: number;
      has_bills: number;
      goal_count: number;
    }>();

    return c.json({ users: rows.results ?? [] });
  } catch {
    return c.json({ error: "Internal error" }, 500);
  }
});

app.route("/api/admin", admin);

export default { fetch: app.fetch };
