import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare, Send, Trash2, TrendingUp,
  Calendar, Target, Receipt, Clock, Plus, Minus,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { api } from "../lib/api";
import { cn, money } from "../lib/utils";

/* ── Types ──────────────────────────────────────────── */
type Category   = { id: string; name: string; direction?: string };
type SummaryRow = Category & { budgeted: number; activity: number; available: number };
type SummaryRes = { byCategory: SummaryRow[] };
type SpendRow   = { id: string; category_id: string; amount: number; direction?: "in" | "out"; date: string; note: string | null; created_at: string };
type SpendListRes = { spends: SpendRow[] };
type UpcomingBill  = { id: string; name: string; mode: "auto" | "manual"; day_of_month: number };
type UpcomingEvent = { id: string; title: string; start_at: string; end_at: string | null; location: string | null };
type HomeUpcomingRes = { bills: UpcomingBill[]; events: UpcomingEvent[] };
type UpcomingMeal = { id: string; planned_date: string; meal_type: string; recipe_title: string; recipe_type: string };
type Goal = { id: string; title: string; status: "active" | "done"; due_date: string | null; notes: string | null };
type Note = { id: string; user_id: string; body: string; created_at: string; author_name?: string };
type AccountRes = { bankBalance: number; toBeBudgeted: number };

/* ── Helpers ────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function UserAvatar({ name, size = 6 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn(`h-${size} w-${size} rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold`)}
      style={{ background: "#C8A464", color: "#0B2A4A" }}>
      {initials}
    </div>
  );
}

/* ── Card shell ─────────────────────────────────────── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-white p-4 md:p-5", className)}
      style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function CardHeader({ title, sub, icon: Icon }: { title: string; sub?: string; icon?: React.FC<{ size?: number; className?: string }> }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-stone-400 shrink-0" />}
        <div>
          <div className="text-sm font-semibold text-stone-900">{title}</div>
          {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Input / select styling ─────────────────────────── */
const inputCls = "h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/15 transition-all w-full";
const selectCls = inputCls;

/* ── Pill for category snapshot ─────────────────────── */
function AvailPill({ val }: { val: number | null | undefined }) {
  if (val == null) return null;
  const over = val < 0;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums border",
      over
        ? "bg-[#FDF3E3] text-[#B8791F] border-[#B8791F]/30"
        : "bg-[#EBF3EF] text-[#2F6B52] border-[#2F6B52]/30")}>
      {over ? `Over ${money(Math.abs(val))}` : `Left ${money(val)}`}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════ */
export default function Home() {
  const [cats, setCats]         = useState<Category[]>([]);
  const INCOME_ID = useMemo(() => cats.find((c) => c.direction === "inflow")?.id ?? "income", [cats]);
  const [summary, setSummary]   = useState<SummaryRes | null>(null);
  const [account, setAccount]   = useState<AccountRes | null>(null);
  const [spends, setSpends]     = useState<SpendRow[]>([]);
  const [upcoming, setUpcoming] = useState<HomeUpcomingRes | null>(null);
  const [sortBy, setSortBy]     = useState<"date" | "category">("date");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount]     = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote]         = useState("");
  const [msg, setMsg]           = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [lastSpendId, setLastSpendId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [notes, setNotes]       = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [myUserId, setMyUserId] = useState<string>("");
  const [upcomingMeals, setUpcomingMeals] = useState<UpcomingMeal[]>([]);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatInputValue, setNewCatInputValue] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  const catNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of cats) m[c.id] = c.name;
    return m;
  }, [cats]);

  const catAvailableById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of summary?.byCategory ?? []) m[r.id] = Number(r.available ?? 0);
    return m;
  }, [summary]);

  const upcomingGoals = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30   = new Date(today.getTime() + 30 * 86400000);
    return goals.filter((g) => {
      if (g.status !== "active" || !g.due_date) return false;
      const due = new Date(`${g.due_date}T00:00:00`);
      return due >= today && due <= in30;
    }).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  }, [goals]);

  const sortedSpends = useMemo(() => {
    const copy = [...spends];
    if (sortBy === "category") {
      copy.sort((a, b) => {
        const an = (catNameById[a.category_id] || a.category_id).toLowerCase();
        const bn = (catNameById[b.category_id] || b.category_id).toLowerCase();
        return an !== bn ? an.localeCompare(bn) : b.date.localeCompare(a.date);
      });
    } else {
      copy.sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.created_at.localeCompare(a.created_at));
    }
    return copy;
  }, [spends, sortBy, catNameById]);

  const totalAvailable = useMemo(() =>
    (summary?.byCategory ?? [])
      .filter(c => c.id !== INCOME_ID)
      .reduce((s, r) => s + Number(r.available ?? 0), 0),
    [summary, INCOME_ID]);

  const totalIncome   = useMemo(() =>
    spends.filter(s => s.category_id === INCOME_ID || s.direction === "in").reduce((s, r) => s + Number(r.amount), 0),
    [spends, INCOME_ID]);
  const totalSpending = useMemo(() =>
    spends.filter(s => s.category_id !== INCOME_ID && s.direction !== "in").reduce((s, r) => s + Number(r.amount), 0),
    [spends, INCOME_ID]);

  /* Month progress */
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth  = new Date().getDate();
  const monthPct    = Math.round((dayOfMonth / daysInMonth) * 100);

  /* Bank balance and TBB */
  const bankBalance  = Number(account?.bankBalance ?? 0);
  const toBeBudgeted = Number(account?.toBeBudgeted ?? 0);

  /* Motivational subtitle */
  const summaryLine = useMemo(() => {
    if (loading) return { text: "", cls: "" };
    if (toBeBudgeted === 0) return {
      text: "Every dollar has a job. Well done.",
      cls: "text-[#2F6B52]",
    };
    if (toBeBudgeted > 0) return {
      text: `You have ${money(toBeBudgeted)} left to assign. Give it a purpose.`,
      cls: "text-[#5C6B7A]",
    };
    return {
      text: `You've assigned ${money(Math.abs(toBeBudgeted))} more than you have. Trim a category.`,
      cls: "text-[#B8791F]",
    };
  }, [toBeBudgeted, loading]);

  async function refresh() {
    const [catRes, sumRes, spendRes, upRes, goalsRes, notesRes, meRes, accRes, mealsRes] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<SummaryRes>("/api/spend/summary"),
      api<SpendListRes>("/api/spend"),
      api<HomeUpcomingRes>("/api/home/upcoming?billsDays=3&calDays=7"),
      api<{ goals: Goal[] }>("/api/goals"),
      api<{ notes: Note[] }>("/api/notes"),
      api<{ userId: string }>("/api/auth/me"),
      api<AccountRes>("/api/account"),
      api<{ meals: UpcomingMeal[] }>("/api/meals/upcoming").catch(() => ({ meals: [] })),
    ]);
    const allCats = Array.from(
      new Map((catRes.categories ?? []).map((c: Category) => [c.id, c])).values()
    ) as Category[];
    setCats(allCats);
    setSummary(sumRes);
    setSpends(spendRes.spends ?? []);
    setUpcoming(upRes);
    setGoals(goalsRes.goals ?? []);
    setNotes(notesRes.notes ?? []);
    if (meRes.userId) setMyUserId(meRes.userId);
    setAccount(accRes);
    setUpcomingMeals(mealsRes.meals ?? []);
    setCategoryId((prev) => {
      if (prev === INCOME_ID) return prev;
      const nonIncome = allCats.filter((c) => c.id !== INCOME_ID);
      if (prev && nonIncome.some((c) => c.id === prev)) return prev;
      return nonIncome[0]?.id ?? "";
    });
  }

  useEffect(() => {
    setLoading(true);
    refresh().catch((e: any) => setMsg(e?.message || "Failed to load.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (direction === "in") { setCategoryId(INCOME_ID); return; }
    setCategoryId((prev) => {
      if (prev !== INCOME_ID) return prev;
      return cats.find((x) => x.id !== INCOME_ID)?.id ?? prev;
    });
  }, [direction, cats, INCOME_ID]);

  useEffect(() => {
    const id = setInterval(() => {
      api<{ notes: Note[] }>("/api/notes").then((r) => setNotes(r.notes ?? [])).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  async function handleCreateCategoryInline() {
    const name = newCatInputValue.trim();
    if (!name) return;
    setAddingCat(true); setMsg(null);
    try {
      const result = await api<{ ok: boolean; id: string }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name, direction: "outflow" }),
      });
      setNewCatInputValue(""); setShowNewCatInput(false);
      await refresh();
      if (result.id) { setCategoryId(result.id); setDirection("out"); }
      setMsg(`"${name}" added.`);
    } catch (err: any) { setMsg(err?.message || "Failed to create category."); }
    finally { setAddingCat(false); }
  }

  async function submitSpend(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = Number(amount);
    if (!amount || Number.isNaN(n)) { setMsg("Enter an amount."); return; }
    if (!categoryId) { setMsg("Pick a category."); return; }
    setBusy(true);
    try {
      const res = await api<{ ok: true; id: string }>("/api/spend", {
        method: "POST",
        body: JSON.stringify({ categoryId, amount: n, date, note, direction }),
      });
      setLastSpendId(res.id);
      setAmount(""); setNote("");
      setMsg(direction === "in" ? "Income saved" : "Transaction saved");
      await refresh();
    } catch (err: any) { setMsg(err?.message || "Error saving."); }
    finally { setBusy(false); }
  }

  async function deleteSpend(id: string, isUndo = false) {
    setBusy(true); setMsg(null);
    try {
      await api(`/api/spend/${id}`, { method: "DELETE" });
      if (lastSpendId === id) setLastSpendId(null);
      setMsg(isUndo ? "Undone" : "Removed");
      await refresh();
    } catch (err: any) { setMsg(err?.message || "Error."); }
    finally { setBusy(false); }
  }

  async function postNote() {
    const text = noteInput.trim();
    if (!text) return;
    await api("/api/notes", { method: "POST", body: JSON.stringify({ body: text }) });
    setNoteInput("");
    await refresh();
  }

  async function deleteNote(id: string) {
    await api(`/api/notes/${id}`, { method: "DELETE" });
    await refresh();
  }

  const barData = [
    { name: "Income",   value: totalIncome,  color: "#2F6B52" },
    { name: "Spending", value: totalSpending, color: "#F59E0B" },
  ];

  /* Skeleton loader */
  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="rounded-2xl bg-white border h-36" style={{ borderColor: "var(--color-border)" }} />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1,2].map(i => <div key={i} className="rounded-2xl bg-white border h-48" style={{ borderColor: "var(--color-border)" }} />)}
        </div>
        <div className="rounded-2xl bg-white border h-48" style={{ borderColor: "var(--color-border)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Hero: Bank Balance ─────────────────────────── */}
      <div className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">Bank Balance</div>
            <div className={cn("font-display text-5xl md:text-6xl font-semibold tabular-nums leading-none",
              bankBalance < 0 ? "text-[#B8791F]" : "text-stone-900")}>
              {money(bankBalance)}
            </div>
            {!loading && summaryLine.text && (
              <p className={cn("mt-3 text-sm max-w-lg", summaryLine.cls)}>{summaryLine.text}</p>
            )}
          </div>
          {/* Month progress */}
          <div className="shrink-0 text-right">
            <div className="text-xs text-stone-400 mb-1.5">Month {monthPct}% done · Day {dayOfMonth} of {daysInMonth}</div>
            <div className="w-40 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${monthPct}%`, background: "var(--color-primary)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Record a transaction ──────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-[#0B2A4A]">Record a transaction</div>
            <div className="text-xs text-[#5C6B7A] mt-0.5">
              {direction === "out" ? "Outflow · reduces category balance" : "Income · increases ready to assign"}
            </div>
          </div>
          <div className="inline-flex rounded-xl border border-[#E8E2D9] bg-[#F5F1EA] p-1">
            <button type="button" onClick={() => setDirection("out")}
              className={cn("rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                direction === "out" ? "bg-[#B8791F] text-white shadow-sm" : "text-[#5C6B7A] hover:text-[#0B2A4A]")}>
              Outflow
            </button>
            <button type="button" onClick={() => setDirection("in")}
              className={cn("rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                direction === "in" ? "text-white shadow-sm" : "text-[#5C6B7A] hover:text-[#0B2A4A]")}
              style={direction === "in" ? { background: "#2F6B52" } : {}}>
              Income
            </button>
          </div>
        </div>

        <form onSubmit={submitSpend} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6B7A]">Where did it go?</span>
              <select className={selectCls} disabled={direction === "in"}
                value={showNewCatInput ? "__new__" : categoryId}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setShowNewCatInput(true);
                    setNewCatInputValue("");
                  } else {
                    setShowNewCatInput(false);
                    setCategoryId(e.target.value);
                  }
                }}>
                {direction === "out" && <option value="__new__">＋ New category</option>}
                {direction === "out" && <option disabled value="">──────────────</option>}
                {(direction === "in"
                  ? cats.filter((c) => c.id === INCOME_ID)
                  : cats.filter((c) => c.id !== INCOME_ID)
                ).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {showNewCatInput && direction === "out" && (
                <div className="flex gap-2 items-center mt-1">
                  <input
                    autoFocus
                    value={newCatInputValue}
                    onChange={(e) => setNewCatInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleCreateCategoryInline(); }
                      if (e.key === "Escape") { setShowNewCatInput(false); setNewCatInputValue(""); }
                    }}
                    placeholder="Category name"
                    className="h-10 flex-1 min-w-0 rounded-xl border border-[#E8E2D9] bg-[#F5F1EA] px-3 text-sm text-[#0B2A4A] outline-none focus:ring-2 focus:ring-[#C8A464]/20 focus:border-[#C8A464] transition-all placeholder-[#5C6B7A]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategoryInline}
                    disabled={addingCat || !newCatInputValue.trim()}
                    className="h-10 rounded-xl bg-[#0B2A4A] px-3 text-xs font-semibold text-white hover:bg-[#0F3360] disabled:opacity-50 transition-all">
                    {addingCat ? "…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewCatInput(false); setNewCatInputValue(""); }}
                    className="h-10 w-10 rounded-xl border border-[#E8E2D9] text-[#5C6B7A] hover:bg-[#F5F1EA] text-sm transition-all flex items-center justify-center">
                    ×
                  </button>
                </div>
              )}
            </div>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6B7A]">Amount</span>
              <input className={inputCls + " tabular-nums"} value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6B7A]">Date</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6B7A]">Note (optional)</span>
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={direction === "in" ? "Paycheck, transfer, etc." : "Walmart, gas, etc."} />
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={busy}
              className="h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: direction === "in" ? "#2F6B52" : "#0B2A4A" }}>
              {busy ? "Saving…" : direction === "in" ? "Add income" : "Record"}
            </button>
            <button type="button" disabled={busy || !lastSpendId} onClick={() => deleteSpend(lastSpendId!, true)}
              className="h-10 px-4 rounded-xl border border-[#E8E2D9] text-sm font-medium text-[#5C6B7A] hover:bg-[#F5F1EA] disabled:opacity-40 transition-all">
              Undo
            </button>
            {msg && (
              <span className={cn("text-sm", msg.includes("Error") || msg.includes("error") ? "text-[#B8791F]" : "text-[#2F6B52]")}>
                {msg}
              </span>
            )}
          </div>
        </form>
      </Card>

      {/* ── Cards grid ────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* This Month */}
        <Card>
          <CardHeader title="This Month" sub="Income vs. spending" icon={TrendingUp} />
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barCategoryGap="30%" margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716C" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#A8A29E" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  formatter={(v) => [money(Number(v)), ""]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E7E5E4", fontSize: 12 }}
                  cursor={{ fill: "#F5F5F4" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-[#5C6B7A]">
            <div><span className="font-semibold text-[#2F6B52]">{money(totalIncome)}</span> in</div>
            <div><span className="font-semibold text-[#B8791F]">{money(totalSpending)}</span> spent</div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader title="Recent activity" sub="Last 5 transactions" icon={Clock} />
          {sortedSpends.length === 0 ? (
            <div className="text-sm text-stone-400 py-4 text-center">No transactions yet.</div>
          ) : (
            <div className="space-y-2">
              {sortedSpends.slice(0, 5).map((row) => {
                const isIncome = row.category_id === INCOME_ID || row.direction === "in";
                const catName  = catNameById[row.category_id] || row.category_id;
                return (
                  <div key={row.id} className="flex items-center gap-3">
                    <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      isIncome ? "bg-[#EBF3EF] text-[#2F6B52]" : "bg-[#F5F1EA] text-[#5C6B7A]")}>
                      {isIncome ? <Plus size={12} /> : <Minus size={12} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[#0B2A4A] truncate">{catName}{row.note ? ` · ${row.note}` : ""}</div>
                      <div className="text-[10px] text-[#5C6B7A]">{row.date}</div>
                    </div>
                    <div className={cn("text-xs font-semibold tabular-nums shrink-0", isIncome ? "text-[#2F6B52]" : "text-[#0B2A4A]")}>
                      {isIncome ? "+" : "-"}{money(row.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Upcoming (combined) ───────────────────────── */}
      <Card>
        <div className="text-sm font-semibold text-stone-900 mb-4">Upcoming</div>

        {/* Bills */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Receipt size={13} className="text-stone-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bills</span>
            </div>
            <span className="text-xs text-stone-400">3 days</span>
          </div>
          <div className="space-y-2">
            {!upcoming || upcoming.bills.length === 0 ? (
              <p className="text-sm text-[#5C6B7A]">Clear skies — no bills due soon.</p>
            ) : upcoming.bills.map((bill) => {
              const diff    = bill.day_of_month - new Date().getDate();
              const isAuto  = bill.mode === "auto";
              const urgency = diff === 0 ? "today" : `in ${diff}d`;
              return (
                <div key={bill.id} className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                  isAuto ? "bg-blue-50 border border-blue-100" : "bg-amber-50 border border-amber-100"
                )}>
                  <span className={cn("font-medium truncate", isAuto ? "text-blue-800" : "text-amber-800")}>{bill.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={cn("text-xs", isAuto ? "text-blue-600" : "text-amber-600")}>{urgency}</span>
                    <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-0.5",
                      isAuto ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
                      {isAuto ? "auto" : "manual"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-b border-stone-100 mb-4" />

        {/* Events */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-stone-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[#5C6B7A]">Upcoming events</span>
            </div>
            <span className="text-xs text-stone-400">7 days</span>
          </div>
          <div className="space-y-2">
            {!upcoming || upcoming.events.length === 0 ? (
              <p className="text-sm text-[#5C6B7A]">Nothing on the horizon.</p>
            ) : upcoming.events.map((ev) => {
              const d = new Date(ev.start_at);
              const pretty = d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
              return (
                <div key={ev.id} className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                  <div className="text-sm font-medium text-stone-800">{ev.title}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{pretty}{ev.location ? ` · ${ev.location}` : ""}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-b border-stone-100 mb-4" />

        {/* Goals */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target size={13} className="text-stone-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[#5C6B7A]">Goals due soon</span>
            </div>
            <span className="text-xs text-stone-400">30 days</span>
          </div>
          <div className="space-y-2">
            {upcomingGoals.length === 0 ? (
              <p className="text-sm text-[#5C6B7A]">No goals on the near horizon.</p>
            ) : upcomingGoals.map((g) => {
              const today    = new Date(); today.setHours(0, 0, 0, 0);
              const due      = new Date(`${g.due_date!}T00:00:00`);
              const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
              const urgent   = daysLeft <= 7;
              return (
                <div key={g.id} className={cn("rounded-xl border px-3 py-2",
                  urgent ? "bg-[#FDF3E3] border-[#B8791F]/20" : "bg-[#EBF3EF]/70 border-[#2F6B52]/20")}>
                  <div className={cn("text-sm font-medium truncate", urgent ? "text-[#B8791F]" : "text-[#2F6B52]")}>{g.title}</div>
                  <div className={cn("text-xs mt-0.5", urgent ? "text-[#B8791F]" : "text-[#2F6B52]")}>
                    {daysLeft === 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : `${daysLeft} days left`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-b border-stone-100 mb-4 mt-4" />

        {/* Dinner plans */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#5C6B7A]">🍽️ Dinner plans</span>
            <span className="text-xs text-stone-400">7 days</span>
          </div>
          <div className="space-y-1.5">
            {upcomingMeals.length === 0 ? (
              <p className="text-sm text-[#5C6B7A]">Nothing planned yet.</p>
            ) : upcomingMeals.map((meal) => {
              const date = new Date(`${meal.planned_date}T00:00:00`);
              const label = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={meal.id} className="rounded-xl bg-[#FDF8F0] border border-[#C8A464]/20 px-3 py-2 text-sm">
                  <span className="font-medium text-[#0B2A4A]">{meal.recipe_title}</span>
                  <span className="text-[#5C6B7A] text-xs ml-2">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ── Family Notes ──────────────────────────────── */}
      <Card>
        <CardHeader title="Crew notes" sub="Visible to your whole household" icon={MessageSquare} />
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <textarea
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#C8A464]/15 focus:border-[#C8A464] transition-all resize-none text-stone-900 placeholder-stone-400"
              rows={2} maxLength={500}
              placeholder="Leave a note for the family…"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postNote(); }}
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-stone-300">{noteInput.length}/500</span>
          </div>
          <button type="button" onClick={postNote} disabled={!noteInput.trim()}
            className="self-end h-10 px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all flex items-center gap-1.5"
            style={{ background: "#0B2A4A" }}>
            <Send size={13} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <div className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-[#5C6B7A] text-center py-4">No notes yet. Be the first to leave one.</p>
          ) : notes.map((note) => {
            const authorDisplay = note.author_name || (note.user_id === myUserId ? "You" : "Family member");
            return (
              <div key={note.id} className="rounded-xl border border-[#E8E2D9] bg-[#F5F1EA] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={authorDisplay} size={6} />
                    <span className="text-xs font-semibold text-[#0B2A4A]">{authorDisplay}</span>
                    <span className="text-[#5C6B7A] text-xs">·</span>
                    <span className="text-xs text-[#5C6B7A]">{timeAgo(note.created_at)}</span>
                  </div>
                  <button type="button" onClick={() => deleteNote(note.id)}
                    className="text-stone-300 hover:text-[#B8791F] transition-colors p-1 rounded-lg hover:bg-[#FDF3E3]">
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">{note.body}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Budget snapshot + total ────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5C6B7A] mb-3">Category detail</div>
          {summary?.byCategory.find(c => c.id === categoryId) ? (() => {
            const cur = summary!.byCategory.find(c => c.id === categoryId)!;
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-stone-900">{cur.name}</span>
                  <AvailPill val={cur.available} />
                </div>
                <div className="space-y-2 text-sm">
                  {([["Budgeted", cur.budgeted], ["Activity", cur.activity], ["Available", cur.available]] as [string, number][]).map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between">
                      <span className="text-stone-500">{lbl}</span>
                      <span className={cn("font-semibold tabular-nums",
                        lbl === "Available" && val < 0 ? "text-[#B8791F]" :
                        lbl === "Available" ? "text-[#2F6B52]" : "text-stone-900")}>
                        {money(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })() : <p className="text-sm text-stone-400 mt-2">Select a category above to view details.</p>}
        </Card>

        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Total Available</div>
          <div className="text-xs text-stone-400 mb-4">Across all budget categories</div>
          <div className={cn("font-display text-4xl font-semibold tabular-nums",
            totalAvailable < 0 ? "text-[#B8791F]" : "text-stone-900")}>
            {money(totalAvailable)}
          </div>
        </Card>
      </div>

      {/* ── Transaction History ───────────────────────── */}
      <Card className="p-0! overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <div className="text-sm font-semibold text-[#0B2A4A]">Recent transactions</div>
            <div className="text-xs text-[#5C6B7A]">Most recent 200 entries</div>
          </div>
          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1">
            {(["date", "category"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSortBy(s)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                  sortBy === s ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {sortedSpends.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-[#5C6B7A]">Nothing recorded yet. Add your first transaction above.</div>
          )}
          {sortedSpends.map((row) => {
            const catName  = catNameById[row.category_id] || row.category_id;
            const available = catAvailableById[row.category_id];
            const isIncome  = row.category_id === INCOME_ID || row.direction === "in";
            return (
              <div key={row.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F5F1EA] transition-colors">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                  isIncome ? "bg-[#EBF3EF] text-[#2F6B52]" : "bg-[#F5F1EA] text-[#5C6B7A]")}>
                  {isIncome ? <Plus size={13} /> : <Minus size={13} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("font-semibold text-sm tabular-nums", isIncome ? "text-[#2F6B52]" : "text-[#0B2A4A]")}>
                      {isIncome ? "+" : ""}{money(row.amount)}
                    </span>
                    <AvailPill val={available} />
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5 truncate">
                    {catName} · {row.date}{row.note ? ` · ${row.note}` : ""}
                  </div>
                </div>
                <button type="button" disabled={busy} onClick={() => deleteSpend(row.id)}
                  className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 disabled:opacity-40 transition-all">
                  Undo
                </button>
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}
