import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare, Send, Trash2, TrendingUp,
  Calendar, Target, Receipt, Plus, Minus,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { api } from "../lib/api";
import { cn, money, round2 } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { canAccess } from "../lib/permissions";

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
      style={{ background: "#2D6E70", color: "#FFFDF8" }}>
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
        {Icon && <Icon size={15} className="text-ink-500 shrink-0" />}
        <div>
          <div className="text-sm font-semibold text-ink-900">{title}</div>
          {sub && <div className="text-xs text-ink-500 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Pill for category snapshot ─────────────────────── */
function AvailPill({ val }: { val: number | null | undefined }) {
  if (val == null) return null;
  const over = val < 0;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums border",
      over
        ? "bg-rust-50 text-rust-600 border-rust-600/30"
        : "bg-teal-50 text-teal-600 border-teal-600/30")}>
      {over ? `Over ${money(Math.abs(val))}` : `Left ${money(val)}`}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════ */
export default function Home() {
  const { user } = useUser();
  const canSeeTransactions = canAccess(user, "can_see_transactions");
  const canViewNotes       = canAccess(user, "can_view_notes");
  const canPostNotes       = canAccess(user, "can_post_notes");
  const [cats, setCats]         = useState<Category[]>([]);
  const INCOME_ID = useMemo(() => cats.find((c) => c.direction === "inflow")?.id ?? "income", [cats]);
  const [summary, setSummary]   = useState<SummaryRes | null>(null);
  const [account, setAccount]   = useState<AccountRes | null>(null);
  const [spends, setSpends]     = useState<SpendRow[]>([]);
  const [upcoming, setUpcoming] = useState<HomeUpcomingRes | null>(null);
  const [sortBy, setSortBy]     = useState<"date" | "category">("date");
  const [categoryId, setCategoryId] = useState("");
  const [msg, setMsg]           = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [loading, setLoading]   = useState(true);
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [notes, setNotes]       = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [myUserId, setMyUserId] = useState<string>("");
  const [upcomingMeals, setUpcomingMeals] = useState<UpcomingMeal[]>([]);

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

  const totalIncome   = useMemo(() =>
    round2(spends.filter(s => s.category_id === INCOME_ID || s.direction === "in").reduce((s, r) => s + Number(r.amount), 0)),
    [spends, INCOME_ID]);
  const totalSpending = useMemo(() =>
    round2(spends.filter(s => s.category_id !== INCOME_ID && s.direction !== "in").reduce((s, r) => s + Number(r.amount), 0)),
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
      cls: "text-teal-600",
    };
    if (toBeBudgeted > 0) return {
      text: `You have ${money(toBeBudgeted)} left to assign. Give it a purpose.`,
      cls: "text-ink-500",
    };
    return {
      text: `You've assigned ${money(Math.abs(toBeBudgeted))} more than you have. Trim a category.`,
      cls: "text-rust-600",
    };
  }, [toBeBudgeted, loading]);

  async function refresh() {
    const [catRes, sumRes, spendRes, upRes, goalsRes, notesRes, meRes, accRes, mealsRes] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<SummaryRes>("/api/spend/summary"),
      api<SpendListRes>("/api/spend"),
      api<HomeUpcomingRes>("/api/home/upcoming?billsDays=31&calDays=30"),
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
      const nonIncome = allCats.filter((c) => c.direction !== "inflow");
      if (prev && nonIncome.some((c) => c.id === prev)) return prev;
      return nonIncome[0]?.id ?? "";
    });
  }

  useEffect(() => {
    setLoading(true);
    refresh().catch((e: any) => setMsg(e?.message || "Failed to load.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      api<{ notes: Note[] }>("/api/notes").then((r) => setNotes(r.notes ?? [])).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  async function deleteSpend(id: string, isUndo = false) {
    setBusy(true); setMsg(null);
    try {
      await api(`/api/spend/${id}`, { method: "DELETE" });
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
    { name: "Income",   value: totalIncome,  color: "#2D6E70" },
    { name: "Spending", value: totalSpending, color: "#F59E0B" },
  ];

  /* Skeleton loader */
  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="rounded-2xl bg-white border h-36" style={{ borderColor: "var(--color-border)" }} />
        <div className="rounded-2xl bg-white border h-64" style={{ borderColor: "var(--color-border)" }} />
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
            <div className="text-xs font-semibold uppercase tracking-widest text-ink-500 mb-1">Bank Balance</div>
            <div className={cn("font-display text-5xl md:text-6xl font-semibold tabular-nums leading-none",
              bankBalance < 0 ? "text-rust-600" : "text-ink-900")}>
              {money(bankBalance)}
            </div>
            {!loading && summaryLine.text && (
              <p className={cn("mt-3 text-sm max-w-lg", summaryLine.cls)}>{summaryLine.text}</p>
            )}
          </div>
          {/* Month progress */}
          <div className="shrink-0 text-right">
            <div className="text-xs text-ink-500 mb-1.5">Month {monthPct}% done · Day {dayOfMonth} of {daysInMonth}</div>
            <div className="w-40 h-1.5 rounded-full bg-cream-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${monthPct}%`, background: "var(--color-primary)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Day Planner ───────────────────────────────── */}
      <DayPlanner
        bills={upcoming?.bills ?? []}
        events={upcoming?.events ?? []}
        meals={upcomingMeals}
        goals={goals}
        onEventAdded={refresh}
      />

      {/* ── This Month ────────────────────────────────── */}
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
        <div className="mt-2 flex gap-4 text-xs text-ink-500">
          <div><span className="font-semibold text-teal-600">{money(totalIncome)}</span> in</div>
          <div><span className="font-semibold text-rust-600">{money(totalSpending)}</span> spent</div>
        </div>
      </Card>

      {/* ── Upcoming (combined) ───────────────────────── */}
      <Card>
        <div className="text-sm font-semibold text-ink-900 mb-4">Upcoming</div>

        {/* Bills */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Receipt size={13} className="text-ink-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Bills</span>
            </div>
            <span className="text-xs text-ink-500">3 days</span>
          </div>
          <div className="space-y-2">
            {!upcoming || upcoming.bills.length === 0 ? (
              <p className="text-sm text-ink-500">Clear skies — no bills due soon.</p>
            ) : upcoming.bills.filter(b => {
              const today = new Date().getDate();
              return b.day_of_month >= today && b.day_of_month <= today + 3;
            }).slice(0, 5).map((bill) => {
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

        <div className="border-b border-cream-100 mb-4" />

        {/* Events */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-ink-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Upcoming events</span>
            </div>
            <span className="text-xs text-ink-500">7 days</span>
          </div>
          <div className="space-y-2">
            {!upcoming || upcoming.events.length === 0 ? (
              <p className="text-sm text-ink-500">Nothing on the horizon.</p>
            ) : (() => {
              const cutoff = new Date(Date.now() + 7 * 86400000);
              const next7  = upcoming.events.filter(ev => new Date(ev.start_at) <= cutoff);
              if (next7.length === 0) return <p className="text-sm text-ink-500">Nothing on the horizon.</p>;
              return next7.slice(0, 5).map((ev) => {
                const d = new Date(ev.start_at);
                const pretty = d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                return (
                  <div key={ev.id} className="rounded-xl border border-cream-100 bg-cream-50 px-3 py-2">
                    <div className="text-sm font-medium text-ink-900">{ev.title}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{pretty}{ev.location ? ` · ${ev.location}` : ""}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="border-b border-cream-100 mb-4" />

        {/* Goals */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target size={13} className="text-ink-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Goals due soon</span>
            </div>
            <span className="text-xs text-ink-500">30 days</span>
          </div>
          <div className="space-y-2">
            {upcomingGoals.length === 0 ? (
              <p className="text-sm text-ink-500">No goals on the near horizon.</p>
            ) : upcomingGoals.map((g) => {
              const today    = new Date(); today.setHours(0, 0, 0, 0);
              const due      = new Date(`${g.due_date!}T00:00:00`);
              const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
              const urgent   = daysLeft <= 7;
              return (
                <div key={g.id} className={cn("rounded-xl border px-3 py-2",
                  urgent ? "bg-rust-50 border-rust-600/20" : "bg-teal-50/70 border-teal-600/20")}>
                  <div className={cn("text-sm font-medium truncate", urgent ? "text-rust-600" : "text-teal-600")}>{g.title}</div>
                  <div className={cn("text-xs mt-0.5", urgent ? "text-rust-600" : "text-teal-600")}>
                    {daysLeft === 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : `${daysLeft} days left`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-b border-cream-100 mb-4 mt-4" />

        {/* Dinner plans */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">🍽️ Dinner plans</span>
            <span className="text-xs text-ink-500">7 days</span>
          </div>
          <div className="space-y-1.5">
            {upcomingMeals.length === 0 ? (
              <p className="text-sm text-ink-500">Nothing planned yet.</p>
            ) : upcomingMeals.map((meal) => {
              const date = new Date(`${meal.planned_date}T00:00:00`);
              const label = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={meal.id} className="rounded-xl bg-rust-50 border border-rust-500/20 px-3 py-2 text-sm">
                  <span className="font-medium text-ink-900">{meal.recipe_title}</span>
                  <span className="text-ink-500 text-xs ml-2">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ── Family Notes ──────────────────────────────── */}
      {canViewNotes && <Card>
        <CardHeader title="Crew notes" sub="Visible to your whole household" icon={MessageSquare} />
        {canPostNotes && (
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <textarea
                className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-all resize-none text-ink-900 placeholder-ink-300"
                rows={2} maxLength={500}
                placeholder="Leave a note for the family…"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postNote(); }}
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-ink-500/40">{noteInput.length}/500</span>
            </div>
            <button type="button" onClick={postNote} disabled={!noteInput.trim()}
              className="self-end h-10 px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all flex items-center gap-1.5"
              style={{ background: "#1B4243" }}>
              <Send size={13} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        )}
        <div className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-4">No notes yet. Be the first to leave one.</p>
          ) : notes.map((note) => {
            const authorDisplay = note.author_name || (note.user_id === myUserId ? "You" : "Family member");
            return (
              <div key={note.id} className="rounded-xl border border-cream-200 bg-cream-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={authorDisplay} size={6} />
                    <span className="text-xs font-semibold text-ink-900">{authorDisplay}</span>
                    <span className="text-ink-500 text-xs">·</span>
                    <span className="text-xs text-ink-500">{timeAgo(note.created_at)}</span>
                  </div>
                  {canPostNotes && (
                    <button type="button" onClick={() => deleteNote(note.id)}
                      className="text-ink-500/40 hover:text-rust-600 transition-colors p-1 rounded-lg hover:bg-rust-50">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-ink-900 leading-relaxed">{note.body}</p>
              </div>
            );
          })}
        </div>
      </Card>}

      {/* ── Budget snapshot ────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">Category detail</div>
          {summary?.byCategory.find(c => c.id === categoryId) ? (() => {
            const cur = summary!.byCategory.find(c => c.id === categoryId)!;
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-ink-900">{cur.name}</span>
                  <AvailPill val={cur.available} />
                </div>
                <div className="space-y-2 text-sm">
                  {([["Budgeted", cur.budgeted], ["Activity", cur.activity], ["Available", cur.available]] as [string, number][]).map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between">
                      <span className="text-ink-500">{lbl}</span>
                      <span className={cn("font-semibold tabular-nums",
                        lbl === "Available" && val < 0 ? "text-rust-600" :
                        lbl === "Available" ? "text-teal-600" : "text-ink-900")}>
                        {money(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })() : <p className="text-sm text-ink-500 mt-2">Select a category to view details.</p>}
        </Card>
      </div>

      {/* ── Transaction History ───────────────────────── */}
      {canSeeTransactions && <Card className="p-0! overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <div className="text-sm font-semibold text-ink-900">Recent transactions</div>
            <div className="text-xs text-ink-500">Most recent 200 entries</div>
          </div>
          <div className="inline-flex rounded-xl border border-cream-200 bg-cream-50 p-1">
            {(["date", "category"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSortBy(s)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                  sortBy === s ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {sortedSpends.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-ink-500">Nothing recorded yet.</div>
          )}
          {sortedSpends.map((row) => {
            const catName  = catNameById[row.category_id] || row.category_id;
            const available = catAvailableById[row.category_id];
            const isIncome  = row.category_id === INCOME_ID || row.direction === "in";
            return (
              <div key={row.id} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-100 transition-colors">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                  isIncome ? "bg-teal-50 text-teal-600" : "bg-cream-100 text-ink-500")}>
                  {isIncome ? <Plus size={13} /> : <Minus size={13} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("font-semibold text-sm tabular-nums", isIncome ? "text-teal-600" : "text-ink-900")}>
                      {isIncome ? "+" : ""}{money(row.amount)}
                    </span>
                    <AvailPill val={available} />
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 truncate">
                    {catName} · {row.date}{row.note ? ` · ${row.note}` : ""}
                  </div>
                </div>
                <button type="button" disabled={busy} onClick={() => deleteSpend(row.id)}
                  className="shrink-0 rounded-lg border border-cream-200 px-2.5 py-1.5 text-xs font-medium text-ink-500 hover:bg-cream-100 disabled:opacity-40 transition-all">
                  Undo
                </button>
              </div>
            );
          })}
        </div>
      </Card>}

      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-sm",
          msg.includes("Error") || msg.includes("error") || msg.includes("Failed")
            ? "bg-rust-50 border-rust-600/30 text-rust-600"
            : "bg-teal-50 border-teal-500/30 text-teal-600")}>
          {msg}
        </div>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DayPlanner — artsy illustrated daily calendar
═══════════════════════════════════════════════════════ */

const PLANNER_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 am – 10 pm

function hourLabel(h: number) {
  if (h === 12) return "12 pm";
  return h > 12 ? `${h - 12} pm` : `${h} am`;
}

function toLocalDT(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function DayPlanner({
  bills, events, meals, goals, onEventAdded,
}: {
  bills: UpcomingBill[];
  events: UpcomingEvent[];
  meals: UpcomingMeal[];
  goals: Goal[];
  onEventAdded: () => void;
}) {
  const todayBase = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [selected, setSelected] = useState<Date>(() => new Date(todayBase));

  /* Add-event form state */
  const [showAdd, setShowAdd]     = useState(false);
  const [evTitle, setEvTitle]     = useState("");
  const [evStart, setEvStart]     = useState("");
  const [evEnd, setEvEnd]         = useState("");
  const [evLocation, setEvLocation] = useState("");
  const [evSaving, setEvSaving]   = useState(false);
  const [evErr, setEvErr]         = useState<string | null>(null);

  function openAddForm() {
    const start = new Date(selected); start.setHours(9, 0, 0, 0);
    const end   = new Date(selected); end.setHours(10, 0, 0, 0);
    setEvTitle(""); setEvStart(toLocalDT(start)); setEvEnd(toLocalDT(end));
    setEvLocation(""); setEvErr(null); setShowAdd(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault(); setEvErr(null);
    if (!evTitle.trim()) { setEvErr("Enter a title."); return; }
    setEvSaving(true);
    try {
      await api("/api/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: evTitle.trim(),
          startAt: new Date(evStart).toISOString(),
          endAt: evEnd ? new Date(evEnd).toISOString() : null,
          location: evLocation.trim() || undefined,
        }),
      });
      setShowAdd(false);
      onEventAdded();
    } catch (err: any) { setEvErr(err?.message || "Error saving."); }
    finally { setEvSaving(false); }
  }

  function shiftDay(n: number) {
    setSelected(d => { const next = new Date(d); next.setDate(next.getDate() + n); return next; });
  }

  const dateStr  = selected.toISOString().slice(0, 10);
  const isToday  = selected.getTime() === todayBase.getTime();

  /* Filter for selected day */
  const dayBills  = bills.filter(b => b.day_of_month === selected.getDate());
  const dayMeals  = meals.filter(m => m.planned_date === dateStr);
  const dayGoals  = goals.filter(g => g.status === "active" && g.due_date === dateStr);
  const dayEvents = events.filter(ev => ev.start_at.slice(0, 10) === dateStr);

  const hasContent = dayBills.length > 0 || dayMeals.length > 0 || dayGoals.length > 0 || dayEvents.length > 0;

  const dayName  = selected.toLocaleDateString(undefined, { weekday: "long" });
  const dateLabel = selected.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  /* 7-day strip starting today */
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayBase); d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="relative rounded-3xl overflow-hidden border" style={{
      borderColor: "#C9CBAA",
      background: "linear-gradient(160deg, #FDFAF2 0%, #F5EDD8 60%, #EAE4D0 100%)",
      boxShadow: "0 6px 32px rgba(27,66,67,0.10), 0 1px 0 rgba(255,255,255,0.9) inset",
    }}>

      {/* ── Decorative botanical blobs ─────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* top-right teal bloom */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-[0.12]"
          style={{ background: "radial-gradient(circle, #2D6E70 0%, transparent 70%)" }} />
        {/* bottom-left amber warmth */}
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full opacity-[0.10]"
          style={{ background: "radial-gradient(circle, #C17A3F 0%, transparent 70%)" }} />
        {/* center soft lavender */}
        <div className="absolute top-1/2 right-1/4 h-24 w-24 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #8B7EC8 0%, transparent 70%)" }} />
        {/* Tiny scatter dots */}
        {[
          { top: "18%", left: "8%",  size: 3,  color: "#2D6E70", opacity: 0.18 },
          { top: "72%", left: "91%", size: 4,  color: "#C17A3F", opacity: 0.20 },
          { top: "40%", left: "96%", size: 2.5,color: "#2D6E70", opacity: 0.14 },
          { top: "85%", left: "12%", size: 3,  color: "#8B7EC8", opacity: 0.15 },
          { top: "55%", left: "4%",  size: 2,  color: "#C17A3F", opacity: 0.18 },
        ].map((dot, i) => (
          <div key={i} className="absolute rounded-full" style={{
            top: dot.top, left: dot.left,
            width: dot.size, height: dot.size,
            background: dot.color, opacity: dot.opacity,
          }} />
        ))}
      </div>

      {/* ── Date header ───────────────────────────────── */}
      <div className="relative px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">

          <button type="button" onClick={() => shiftDay(-1)}
            className="relative h-10 w-10 rounded-full border-2 flex items-center justify-center text-xl font-light transition-all hover:scale-105 active:scale-95 shrink-0"
            style={{ borderColor: "#1B4243", color: "#1B4243", background: "rgba(255,255,255,0.6)" }}>
            ‹
          </button>

          <div className="text-center flex-1 min-w-0">
            {isToday && (
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 mb-1.5 text-[10px] font-black uppercase tracking-[0.15em]"
                style={{ background: "#1B4243", color: "#FFFDF8" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse inline-block" />
                Today
              </div>
            )}
            <div className="leading-none" style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
              fontWeight: 600,
              color: "#1B4243",
            }}>
              {dayName}
            </div>
            <div className="text-xs mt-1" style={{ color: "#5C7A7B", fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic" }}>
              {dateLabel}
            </div>
          </div>

          <button type="button" onClick={() => shiftDay(1)}
            className="relative h-10 w-10 rounded-full border-2 flex items-center justify-center text-xl font-light transition-all hover:scale-105 active:scale-95 shrink-0"
            style={{ borderColor: "#1B4243", color: "#1B4243", background: "rgba(255,255,255,0.6)" }}>
            ›
          </button>
        </div>

        {/* ── 7-day pill strip ───────────────────────── */}
        <div className="flex gap-1.5 mt-4 justify-center overflow-x-auto pb-0.5 scrollbar-none">
          {weekDays.map((d) => {
            const ds     = d.toISOString().slice(0, 10);
            const isSel  = ds === dateStr;
            const hasDot = bills.some(b => b.day_of_month === d.getDate()) ||
                           meals.some(m => m.planned_date === ds) ||
                           events.some(ev => ev.start_at.slice(0, 10) === ds) ||
                           goals.some(g => g.due_date === ds && g.status === "active");
            return (
              <button key={ds} type="button"
                onClick={() => setSelected(new Date(d))}
                className="flex flex-col items-center rounded-2xl px-2.5 py-2 transition-all min-w-[38px] relative shrink-0"
                style={isSel ? {
                  background: "#1B4243",
                  boxShadow: "0 2px 10px rgba(27,66,67,0.30)",
                } : {}}>
                <span className="text-[9px] font-extrabold uppercase tracking-wider"
                  style={{ color: isSel ? "rgba(255,255,255,0.6)" : "#5C7A7B" }}>
                  {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
                <span className="text-sm font-bold tabular-nums mt-0.5"
                  style={{ color: isSel ? "#FFFDF8" : "#1B4243" }}>
                  {d.getDate()}
                </span>
                {hasDot && !isSel && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full"
                    style={{ background: "#C17A3F" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day content ───────────────────────────────── */}
      <div className="relative px-4 pb-6 space-y-3">

        {/* Quiet day empty state */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-5xl mb-3 opacity-60">🌿</div>
            <p className="text-base font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif", color: "#1B4243" }}>
              A quiet day ahead
            </p>
            <p className="text-xs mt-1" style={{ color: "#5C7A7B", fontStyle: "italic" }}>
              Nothing scheduled — enjoy the open space.
            </p>
          </div>
        )}

        {/* ── Bills Due ─────────────────────────────── */}
        {dayBills.length > 0 && (
          <div className="rounded-2xl p-4 relative overflow-hidden" style={{
            background: "linear-gradient(135deg, rgba(201,222,223,0.55) 0%, rgba(168,207,209,0.40) 100%)",
            border: "1.5px solid rgba(45,110,112,0.20)",
            backdropFilter: "blur(4px)",
          }}>
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle, #2D6E70, transparent)", transform: "translate(40%,-40%)" }} />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📋</span>
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#1B4243",
              }}>Bills Due</span>
            </div>
            <div className="space-y-2">
              {dayBills.map(bill => (
                <div key={bill.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: bill.mode === "auto" ? "#2D6E70" : "#C17A3F" }} />
                    <span className="text-sm font-semibold" style={{ color: "#0F2A2B" }}>{bill.name}</span>
                  </div>
                  <span className="text-[10px] font-bold rounded-full px-2.5 py-0.5 uppercase tracking-wide" style={
                    bill.mode === "auto"
                      ? { background: "rgba(27,66,67,0.12)", color: "#1B4243" }
                      : { background: "rgba(193,122,63,0.15)", color: "#7A4A1E" }
                  }>{bill.mode}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Meals ─────────────────────────────────── */}
        {dayMeals.length > 0 && (
          <div className="rounded-2xl p-4 relative overflow-hidden" style={{
            background: "linear-gradient(135deg, rgba(240,217,192,0.60) 0%, rgba(232,194,158,0.40) 100%)",
            border: "1.5px solid rgba(193,122,63,0.25)",
          }}>
            <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full opacity-15 pointer-events-none"
              style={{ background: "radial-gradient(circle, #C17A3F, transparent)", transform: "translate(-30%,30%)" }} />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🍽️</span>
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#7A4A1E",
              }}>Meal Plans</span>
            </div>
            <div className="space-y-2">
              {dayMeals.map(meal => (
                <div key={meal.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: "#4A2E12" }}>{meal.recipe_title}</span>
                  <span className="text-[10px] font-bold capitalize rounded-full px-2.5 py-0.5 shrink-0 uppercase tracking-wide"
                    style={{ background: "rgba(193,122,63,0.15)", color: "#7A4A1E" }}>
                    {meal.meal_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Goals ─────────────────────────────────── */}
        {dayGoals.length > 0 && (
          <div className="rounded-2xl p-4 relative overflow-hidden" style={{
            background: "linear-gradient(135deg, rgba(200,190,230,0.40) 0%, rgba(178,165,218,0.30) 100%)",
            border: "1.5px solid rgba(139,126,200,0.30)",
          }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎯</span>
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#3D2E6B",
              }}>Goals Due Today</span>
            </div>
            <div className="space-y-1.5">
              {dayGoals.map(goal => (
                <div key={goal.id} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: "#7B6CC8" }} />
                  <span className="text-sm font-semibold" style={{ color: "#3D2E6B" }}>{goal.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Hour-by-hour schedule ─────────────────── */}
        <div className="rounded-2xl p-4 relative" style={{
          background: "rgba(255,255,255,0.45)",
          border: "1.5px dashed #C9CBAA",
          backdropFilter: "blur(4px)",
        }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🕐</span>
              <span style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#1B4243",
              }}>Schedule</span>
            </div>
            <button
              type="button"
              onClick={openAddForm}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: "rgba(27,66,67,0.10)", color: "#1B4243", border: "1.5px solid rgba(27,66,67,0.20)" }}
            >
              + Add event
            </button>
          </div>

          {/* Inline add-event form */}
          {showAdd && (
            <form onSubmit={saveEvent} className="mb-4 rounded-2xl p-4 space-y-3" style={{
              background: "rgba(255,255,255,0.70)",
              border: "1.5px solid rgba(27,66,67,0.20)",
              backdropFilter: "blur(4px)",
            }}>
              {evErr && <p className="text-xs text-rust-600">{evErr}</p>}
              <input
                autoFocus
                value={evTitle}
                onChange={e => setEvTitle(e.target.value)}
                placeholder="Event title"
                className="w-full h-9 rounded-xl border px-3 text-sm outline-none transition-all"
                style={{ borderColor: "rgba(27,66,67,0.25)", background: "rgba(255,255,255,0.8)", color: "#0F2A2B" }}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#5C7A7B" }}>Start</label>
                  <input
                    type="datetime-local"
                    value={evStart}
                    onChange={e => setEvStart(e.target.value)}
                    className="w-full h-9 rounded-xl border px-2 text-xs outline-none transition-all"
                    style={{ borderColor: "rgba(27,66,67,0.25)", background: "rgba(255,255,255,0.8)", color: "#0F2A2B" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#5C7A7B" }}>End</label>
                  <input
                    type="datetime-local"
                    value={evEnd}
                    onChange={e => setEvEnd(e.target.value)}
                    className="w-full h-9 rounded-xl border px-2 text-xs outline-none transition-all"
                    style={{ borderColor: "rgba(27,66,67,0.25)", background: "rgba(255,255,255,0.8)", color: "#0F2A2B" }}
                  />
                </div>
              </div>
              <input
                value={evLocation}
                onChange={e => setEvLocation(e.target.value)}
                placeholder="Location (optional)"
                className="w-full h-9 rounded-xl border px-3 text-sm outline-none transition-all"
                style={{ borderColor: "rgba(27,66,67,0.25)", background: "rgba(255,255,255,0.8)", color: "#0F2A2B" }}
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={evSaving}
                  className="h-9 flex-1 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: "#1B4243" }}>
                  {evSaving ? "Saving…" : "Save event"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="h-9 rounded-xl border px-4 text-xs font-semibold transition-all"
                  style={{ borderColor: "rgba(27,66,67,0.25)", color: "#5C7A7B" }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {dayEvents.length === 0 && !showAdd ? (
            <div className="text-center py-5">
              <p className="text-sm" style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontStyle: "italic",
                color: "#5C7A7B",
              }}>
                Open canvas — nothing timed today
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline spine */}
              <div className="absolute top-0 bottom-0 w-px" style={{ left: "56px", background: "linear-gradient(180deg, transparent 0%, #C9CBAA 10%, #C9CBAA 90%, transparent 100%)" }} />

              <div className="space-y-0.5">
                {PLANNER_HOURS.map(hour => {
                  const eventsAtHour = dayEvents.filter(ev => new Date(ev.start_at).getHours() === hour);
                  const label = hourLabel(hour);

                  if (eventsAtHour.length === 0) {
                    return (
                      <div key={hour} className="flex items-center" style={{ height: "28px" }}>
                        <span className="text-[10px] tabular-nums text-right shrink-0"
                          style={{ width: "48px", color: "#A8B8B9", paddingRight: "8px" }}>
                          {label}
                        </span>
                        <div className="h-px flex-1 mx-2" style={{ borderTop: "1px dotted #D8D0C0" }} />
                      </div>
                    );
                  }

                  return (
                    <div key={hour} className="flex gap-2 py-1.5">
                      <span className="text-[10px] font-bold tabular-nums text-right shrink-0 mt-2"
                        style={{ width: "48px", color: "#2D6E70", paddingRight: "8px" }}>
                        {label}
                      </span>
                      <div className="flex-1 space-y-1.5">
                        {eventsAtHour.map(ev => {
                          const start = new Date(ev.start_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                          const end   = ev.end_at ? new Date(ev.end_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
                          return (
                            <div key={ev.id} className="rounded-xl px-3 py-2.5 relative overflow-hidden" style={{
                              background: "linear-gradient(135deg, #C9DEDF, #A8CFD1)",
                              border: "1px solid rgba(45,110,112,0.30)",
                              boxShadow: "0 2px 8px rgba(27,66,67,0.12)",
                            }}>
                              <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: "#1B4243" }} />
                              <div className="text-xs font-bold pl-2" style={{ color: "#0F2A2B" }}>{ev.title}</div>
                              <div className="text-[10px] pl-2 mt-0.5 flex items-center gap-2" style={{ color: "#2D6E70" }}>
                                <span>{start}{end ? ` – ${end}` : ""}</span>
                                {ev.location && <span>📍 {ev.location}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
