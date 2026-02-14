import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Category = { id: string; name: string };
type SummaryRow = Category & { budgeted: number; spent: number; remaining: number };
type SummaryRes = { byCategory: SummaryRow[]; totalRemaining: number };

type SpendRow = {
  id: string;
  category_id: string;
  amount: number;
  direction?: "in" | "out"; // may be missing until backend sends it
  date: string; // YYYY-MM-DD
  note: string | null;
  created_at: string; // ISO
};
type SpendListRes = { spends: SpendRow[] };

type UpcomingBill = { id: string; name: string; mode: "auto" | "manual"; due_date: string };
type UpcomingEvent = { id: string; title: string; start_at: string; end_at: string | null; location: string | null };
type HomeUpcomingRes = { bills: UpcomingBill[]; events: UpcomingEvent[] };

export default function Home() {
  const INCOME_CATEGORY_ID = "income";

  const [cats, setCats] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryRes | null>(null);

  const [spends, setSpends] = useState<SpendRow[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "category">("date");

  const [upcoming, setUpcoming] = useState<HomeUpcomingRes | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Undo-last support
  const [lastSpendId, setLastSpendId] = useState<string | null>(null);

  const current = useMemo(() => {
    if (!summary) return null;
    return summary.byCategory.find((c) => c.id === categoryId) || null;
  }, [summary, categoryId]);

  const catNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of cats) m[c.id] = c.name;
    return m;
  }, [cats]);

  const catRemainingById = useMemo(() => {
    const m: Record<string, number> = {};
    if (!summary) return m;
    for (const r of summary.byCategory) m[r.id] = r.remaining;
    return m;
  }, [summary]);

  const sortedSpends = useMemo(() => {
    const copy = [...spends];

    if (sortBy === "category") {
      copy.sort((a, b) => {
        const an = (catNameById[a.category_id] || a.category_id).toLowerCase();
        const bn = (catNameById[b.category_id] || b.category_id).toLowerCase();
        if (an !== bn) return an.localeCompare(bn);
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.created_at.localeCompare(a.created_at);
      });
      return copy;
    }

    // date sort (newest first)
    copy.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.created_at.localeCompare(a.created_at);
    });
    return copy;
  }, [spends, sortBy, catNameById]);

  function pillClasses(remaining: number | undefined) {
    if (remaining == null) return "border-zinc-200 bg-zinc-50 text-zinc-700";
    return remaining < 0
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  async function refresh() {
    const [s, list, up] = await Promise.all([
      api<SummaryRes>("/api/spend/summary"),
      api<SpendListRes>("/api/spend"),
      api<HomeUpcomingRes>("/api/home/upcoming?billsDays=3&calDays=7"),
    ]);

    setSummary(s);
    setSpends(list.spends);
    setUpcoming(up);
  }

  useEffect(() => {
    (async () => {
      const c = await api<{ categories: Category[] }>("/api/categories");
      setCats(c.categories);

      // default category: first non-income
      const firstNonIncome = c.categories.find((x) => x.id !== INCOME_CATEGORY_ID) || c.categories[0];
      if (firstNonIncome) setCategoryId(firstNonIncome.id);

      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep category consistent with direction
  useEffect(() => {
    if (direction === "in") {
      setCategoryId(INCOME_CATEGORY_ID);
      return;
    }
    if (direction === "out" && categoryId === INCOME_CATEGORY_ID) {
      const firstNonIncome = cats.find((x) => x.id !== INCOME_CATEGORY_ID);
      if (firstNonIncome) setCategoryId(firstNonIncome.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, cats]);

  async function submitSpend(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const n = Number(amount);
    if (!amount || Number.isNaN(n)) {
      setMsg("Enter an amount.");
      return;
    }
    if (!categoryId) {
      setMsg("Pick a category.");
      return;
    }
    if (direction === "in" && categoryId !== INCOME_CATEGORY_ID) {
      setMsg("Income entries must use the Income category.");
      return;
    }
    if (direction === "out" && categoryId === INCOME_CATEGORY_ID) {
      setMsg("Spending entries cannot use the Income category.");
      return;
    }

    setBusy(true);
    try {
      const r = await api<{ ok: true; id: string }>("/api/spend", {
        method: "POST",
        body: JSON.stringify({ categoryId, amount: n, date, note, direction }),
      });

      setLastSpendId(r.id);
      setAmount("");
      setNote("");
      setMsg(direction === "in" ? "Income saved ✅" : "Spend saved ✅");
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error saving entry.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSpend(id: string, isUndoLast = false) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/spend/${id}`, { method: "DELETE" });
      if (lastSpendId === id) setLastSpendId(null);
      setMsg(isUndoLast ? "Undone ✅" : "Removed ✅");
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error removing entry.");
    } finally {
      setBusy(false);
    }
  }

  async function undoLast() {
    if (!lastSpendId) return;
    await deleteSpend(lastSpendId, true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Spend Entry</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Add spending or income and instantly see what’s left in that category.
        </p>
      </div>

      {/* Upcoming: Bills + Calendar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Upcoming</h3>
          <div className="text-xs text-zinc-500">Bills (3 days) • Calendar (7 days)</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-semibold text-zinc-900">Bills</div>
            <div className="mt-2 space-y-2">
              {!upcoming || upcoming.bills.length === 0 ? (
                <div className="text-sm text-zinc-500">No bills due in the next few days.</div>
              ) : (
                upcoming.bills.map((b) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const due = new Date(b.due_date + "T00:00:00");
                  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                  const text =
                    b.mode === "auto"
                      ? diff === 0
                        ? `${b.name} was autodrafted today.`
                        : `${b.name} will be autodrafted in ${diff} day${diff === 1 ? "" : "s"}.`
                      : diff === 0
                      ? `${b.name} is due today: Pay Now`
                      : `${b.name} is due in ${diff} day${diff === 1 ? "" : "s"}.`;

                  const cls =
                    b.mode === "auto"
                      ? "border-blue-200 bg-blue-50 text-blue-900"
                      : "border-amber-200 bg-amber-50 text-amber-900";

                  return (
                    <div key={b.id} className={`rounded-xl border px-3 py-2 text-sm ${cls}`}>
                      {text}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-semibold text-zinc-900">Calendar</div>
            <div className="mt-2 space-y-2">
              {!upcoming || upcoming.events.length === 0 ? (
                <div className="text-sm text-zinc-500">No events scheduled this week.</div>
              ) : (
                upcoming.events.map((ev) => {
                  const d = new Date(ev.start_at);
                  const pretty = d.toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div key={ev.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
                      <div className="font-medium text-zinc-900">{ev.title}</div>
                      <div className="text-zinc-500">
                        {pretty}
                        {ev.location ? ` • ${ev.location}` : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Entry form */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <form onSubmit={submitSpend} className="grid gap-4 max-w-xl">
          {/* Entry type + Category */}
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Entry Type</div>
                <div className="text-xs text-zinc-500">
                  {direction === "out"
                    ? "Money going out (spending)."
                    : "Money coming in (adds to To Be Budgeted, does not change Plaid total)."}
                </div>
              </div>

              <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setDirection("out")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    direction === "out" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Out
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("in")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    direction === "in" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  In
                </button>
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Category</span>
              <select
                disabled={direction === "in"}
                className={`h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4 ${
                  direction === "in" ? "bg-zinc-100 text-zinc-500" : "bg-zinc-50"
                }`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {(direction === "in"
                  ? cats.filter((c) => c.id === INCOME_CATEGORY_ID)
                  : cats.filter((c) => c.id !== INCOME_CATEGORY_ID)
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {direction === "in" && (
                <div className="text-xs text-zinc-500">Income entries always go to the Income category.</div>
              )}
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Amount</span>
              <input
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={direction === "in" ? "250.00" : "25.43"}
                inputMode="decimal"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Date</span>
              <input
                type="date"
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Note (optional)</span>
            <input
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={direction === "in" ? "Paycheck, refund, etc." : "Walmart, etc."}
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              title={direction === "in" ? "Add income" : "Add spend"}
            >
              +
            </button>

            <button
              type="button"
              onClick={undoLast}
              disabled={busy || !lastSpendId}
              className="h-11 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Undo last
            </button>

            {msg && <div className="text-sm text-zinc-600">{msg}</div>}
          </div>
        </form>
      </div>

      {/* Snapshot + Total */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Category Snapshot</h3>
              <p className="mt-1 text-sm text-zinc-500">{current ? current.name : "Select a category to view details."}</p>
            </div>

            {current && (
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${pillClasses(
                  current.remaining
                )}`}
              >
                {current.remaining < 0 ? "Over" : "Left"}: ${Math.abs(current.remaining).toFixed(2)}
              </span>
            )}
          </div>

          {current ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Budgeted</span>
                <span className="font-semibold text-zinc-900">${current.budgeted.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Spent</span>
                <span className="font-semibold text-zinc-900">${current.spent.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Remaining</span>
                <span className={current.remaining < 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
                  ${current.remaining.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-zinc-500">No category selected.</div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">Total Remaining</h3>
          <p className="mt-1 text-sm text-zinc-500">Across all categories</p>

          <div className="mt-4 text-3xl font-semibold text-zinc-900">{summary ? `$${summary.totalRemaining.toFixed(2)}` : "—"}</div>
        </div>
      </div>

      {/* Spend History */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Spend History</div>
            <div className="text-xs text-zinc-500">Most recent entries (up to 200)</div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Sort</span>
            <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setSortBy("date")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  sortBy === "date" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Date
              </button>
              <button
                type="button"
                onClick={() => setSortBy("category")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  sortBy === "category" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Category
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-zinc-200">
          {sortedSpends.length === 0 && <div className="px-5 py-8 text-sm text-zinc-500">No entries yet.</div>}

          {sortedSpends.map((r) => {
            const catName = catNameById[r.category_id] || r.category_id;
            const remaining = catRemainingById[r.category_id];
            const isIncome = r.category_id === INCOME_CATEGORY_ID || r.direction === "in";

            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-[260px]">
                  <div className="flex items-center gap-2">
                    <div className={`font-medium ${isIncome ? "text-emerald-700" : "text-zinc-900"}`}>
                      {isIncome ? "+" : ""}${Number(r.amount).toFixed(2)}
                    </div>

                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${pillClasses(remaining)}`}>
                      {remaining == null
                        ? "—"
                        : remaining < 0
                        ? `Over $${Math.abs(remaining).toFixed(0)}`
                        : `Left $${Math.abs(remaining).toFixed(0)}`}
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-zinc-500">
                    {catName} • {r.date}
                    {r.note ? ` • ${r.note}` : ""}
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteSpend(r.id)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    title="Remove this entry"
                  >
                    Undo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
