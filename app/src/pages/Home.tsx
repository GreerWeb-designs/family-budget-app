import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Category = { id: string; name: string; direction?: string };
type SummaryRow = Category & { budgeted: number; activity: number; available: number };
type SummaryRes = { byCategory: SummaryRow[] };
type SpendRow = { id: string; category_id: string; amount: number; direction?: "in" | "out"; date: string; note: string | null; created_at: string };
type SpendListRes = { spends: SpendRow[] };
type UpcomingBill = { id: string; name: string; mode: "auto" | "manual"; due_date: string };
type UpcomingEvent = { id: string; title: string; start_at: string; end_at: string | null; location: string | null };
type HomeUpcomingRes = { bills: UpcomingBill[]; events: UpcomingEvent[] };
type Goal = { id: string; title: string; status: "active" | "done"; due_date: string | null; notes: string | null; };
type Note = { id: string; user_id: string; body: string; created_at: string; };

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function availablePill(available: number | undefined) {
  if (available == null) return "border-slate-200 bg-slate-50 text-slate-500";
  return available < 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function Home() {
  const [cats, setCats] = useState<Category[]>([]);
  const INCOME_ID = useMemo(() => cats.find((c) => c.direction === "inflow")?.id ?? "income", [cats]);
  const [summary, setSummary] = useState<SummaryRes | null>(null);
  const [spends, setSpends] = useState<SpendRow[]>([]);
  const [upcoming, setUpcoming] = useState<HomeUpcomingRes | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "category">("date");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSpendId, setLastSpendId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");

  const current = useMemo(() => summary?.byCategory.find((c) => c.id === categoryId) ?? null, [summary, categoryId]);
  const catNameById = useMemo(() => { const m: Record<string, string> = {}; for (const c of cats) m[c.id] = c.name; return m; }, [cats]);
  const catAvailableById = useMemo(() => { const m: Record<string, number> = {}; for (const r of summary?.byCategory ?? []) m[r.id] = Number(r.available ?? 0); return m; }, [summary]);

  const upcomingGoals = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
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
        if (an !== bn) return an.localeCompare(bn);
        return b.date.localeCompare(a.date);
      });
    } else {
      copy.sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.created_at.localeCompare(a.created_at));
    }
    return copy;
  }, [spends, sortBy, catNameById]);

  async function refresh() {
    const [catRes, sumRes, spendRes, upRes, goalsRes, notesRes] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<SummaryRes>("/api/spend/summary"),
      api<SpendListRes>("/api/spend"),
      api<HomeUpcomingRes>("/api/home/upcoming?billsDays=3&calDays=7"),
      api<{ goals: Goal[] }>("/api/goals"),
      api<{ notes: Note[] }>("/api/notes"),
    ]);
    const allCats = catRes.categories ?? [];
    setCats(allCats);
    setSummary(sumRes);
    setSpends(spendRes.spends ?? []);
    setUpcoming(upRes);
    setGoals(goalsRes.goals ?? []);
    setNotes(notesRes.notes ?? []);
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
      setMsg(direction === "in" ? "Income saved ✅" : "Transaction saved ✅");
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error saving.");
    } finally { setBusy(false); }
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
      if (lastSpendId === id) setLastSpendId(null);
      setMsg(isUndo ? "Undone ✅" : "Removed ✅");
      await refresh();
    } catch (err: any) { setMsg(err?.message || "Error."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">

      {/* Family Notes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4">
          <div className="text-sm font-semibold text-slate-900">📝 Family Notes</div>
          <div className="text-xs text-slate-400 mt-0.5">Shared message board</div>
        </div>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              rows={2}
              maxLength={500}
              placeholder="Leave a note for the family…"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postNote(); }}
            />
            <span className="absolute bottom-2 right-3 text-xs text-slate-300">{noteInput.length}/500</span>
          </div>
          <button
            type="button"
            onClick={postNote}
            disabled={!noteInput.trim()}
            className="self-end h-10 px-4 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-40 transition-all shadow-sm shadow-emerald-500/20"
          >
            Send
          </button>
        </div>
        <div className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-slate-400">No notes yet. Be the first to leave one!</p>
          ) : notes.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900 whitespace-pre-wrap wrap-break-word">{n.body}</p>
                <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteNote(n.id)}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-all"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-900">📄 Bills due soon</div>
            <span className="text-xs text-slate-400">3 days</span>
          </div>
          <div className="space-y-2">
            {!upcoming || upcoming.bills.length === 0 ? (
              <p className="text-sm text-slate-400">No bills due soon.</p>
            ) : upcoming.bills.map((bill) => {
              const today = new Date(); today.setHours(0,0,0,0);
              const due = new Date(`${bill.due_date}T00:00:00`);
              const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
              const isAuto = bill.mode === "auto";
              const text = isAuto
                ? diff === 0 ? `${bill.name} autodrafted today` : `${bill.name} autodrafts in ${diff}d`
                : diff === 0 ? `${bill.name} due today` : `${bill.name} due in ${diff}d`;
              return (
                <div key={bill.id} className={`rounded-xl px-3 py-2 text-sm font-medium ${isAuto ? "bg-blue-50 text-blue-800 border border-blue-100" : "bg-amber-50 text-amber-800 border border-amber-100"}`}>
                  {text}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-900">📅 Upcoming events</div>
            <span className="text-xs text-slate-400">7 days</span>
          </div>
          <div className="space-y-2">
            {!upcoming || upcoming.events.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing scheduled.</p>
            ) : upcoming.events.map((ev) => {
              const d = new Date(ev.start_at);
              const pretty = d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
              return (
                <div key={ev.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <div className="font-medium text-slate-900">{ev.title}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{pretty}{ev.location ? ` · ${ev.location}` : ""}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-900">🎯 Goal reminders</div>
            <span className="text-xs text-slate-400">30 days</span>
          </div>
          <div className="space-y-2">
            {upcomingGoals.length === 0 ? (
              <p className="text-sm text-slate-400">No goals due in the next 30 days.</p>
            ) : upcomingGoals.map((g) => {
              const today = new Date(); today.setHours(0,0,0,0);
              const due = new Date(`${g.due_date!}T00:00:00`);
              const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
              return (
                <div key={g.id} className={`rounded-xl px-3 py-2 text-sm border ${
                  daysLeft <= 7 ? "bg-rose-50 border-rose-100 text-rose-800"
                  : daysLeft <= 14 ? "bg-amber-50 border-amber-100 text-amber-800"
                  : "bg-emerald-50 border-emerald-100 text-emerald-800"
                }`}>
                  <div className="font-medium truncate">{g.title}</div>
                  <div className="text-xs mt-0.5 opacity-75">
                    {daysLeft === 0 ? "Due today!" : daysLeft === 1 ? "Due tomorrow" : `${daysLeft} days left`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Transaction */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Log Transaction</div>
            <div className="text-xs text-slate-400 mt-0.5">{direction === "out" ? "Outflow · reduces category balance" : "Income · increases To Be Budgeted"}</div>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setDirection("out")}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${direction === "out" ? "bg-rose-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              Out
            </button>
            <button type="button" onClick={() => setDirection("in")}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${direction === "in" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              In
            </button>
          </div>
        </div>

        <form onSubmit={submitSpend} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category</span>
              <select
                disabled={direction === "in"}
                className={`h-11 rounded-xl border px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${direction === "in" ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-900"}`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {(direction === "in" ? cats.filter((c) => c.id === INCOME_ID) : cats.filter((c) => c.id !== INCOME_ID)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Amount</span>
              <input
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" inputMode="decimal"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Date</span>
              <input type="date"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={date} onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Note (optional)</span>
            <input
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={direction === "in" ? "Paycheck, transfer, etc." : "Walmart, gas, etc."}
            />
          </label>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy}
              className={`h-11 px-6 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-sm ${direction === "in" ? "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20" : "bg-rose-500 hover:bg-rose-400 shadow-rose-500/20"}`}>
              {busy ? "Saving…" : direction === "in" ? "Add Income" : "Add Transaction"}
            </button>
            <button type="button" onClick={() => deleteSpend(lastSpendId!, true)} disabled={busy || !lastSpendId}
              className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
              Undo last
            </button>
            {msg && <span className="text-sm text-slate-600">{msg}</span>}
          </div>
        </form>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Category Snapshot</div>
          {current ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-900">{current.name}</span>
                <span className={`text-xs font-semibold rounded-full border px-2.5 py-1 ${availablePill(current.available)}`}>
                  {current.available < 0 ? `Over ${money(Math.abs(current.available))}` : `Left ${money(current.available)}`}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                {[["Budgeted", current.budgeted], ["Activity", current.activity], ["Available", current.available]].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-mono font-medium ${label === "Available" && Number(val) < 0 ? "text-rose-600" : label === "Available" ? "text-emerald-600" : "text-slate-900"}`}>{money(Number(val))}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-2">Select a category above to view details.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Available</div>
          <div className="text-xs text-slate-400 mb-3">Across all budget categories</div>
          <div className="text-3xl font-mono font-bold text-slate-900">
            {loading ? "—" : money((summary?.byCategory ?? []).reduce((s, r) => s + Number(r.available ?? 0), 0))}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 md:px-5">
          <div>
            <div className="text-sm font-semibold text-slate-900">Transaction History</div>
            <div className="text-xs text-slate-400">Most recent 200 entries</div>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["date", "category"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSortBy(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${sortBy === s ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {sortedSpends.length === 0 && <div className="px-5 py-8 text-sm text-slate-400">No entries yet.</div>}
          {sortedSpends.map((row) => {
            const catName = catNameById[row.category_id] || row.category_id;
            const available = catAvailableById[row.category_id];
            const isIncome = row.category_id === INCOME_ID || row.direction === "in";
            return (
              <div key={row.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors md:px-5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${isIncome ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {isIncome ? "+" : "−"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono font-semibold text-sm ${isIncome ? "text-emerald-700" : "text-slate-900"}`}>
                      {isIncome ? "+" : ""}{money(row.amount)}
                    </span>
                    <span className={`text-xs font-medium rounded-full border px-2 py-0.5 ${availablePill(available)}`}>
                      {available == null ? "—" : available < 0 ? `Over ${money(Math.abs(available))}` : `Left ${money(available)}`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {catName} · {row.date}{row.note ? ` · ${row.note}` : ""}
                  </div>
                </div>
                <button type="button" disabled={busy} onClick={() => deleteSpend(row.id)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-all">
                  Undo
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}