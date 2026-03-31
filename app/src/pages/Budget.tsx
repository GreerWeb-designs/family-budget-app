import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Category = { id: string; name: string };

type BudgetCurrentRes = { budget: Record<string, number> };

type SummaryRow = Category & { budgeted: number; spent: number; remaining: number };
type SummaryRes = { byCategory: SummaryRow[]; totalRemaining: number };

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}$${v.toFixed(2)}`;
}

function pillClasses(n: number) {
  return n < 0
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function barPct(budgeted: number, remaining: number) {
  const spent = budgeted - remaining;
  if (budgeted <= 0) return 0;
  const pct = (spent / budgeted) * 100;
  return Math.max(0, Math.min(100, pct));
}

export default function Budget() {
  const [cats, setCats] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryRes | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [setAmount, setSetAmount] = useState("");
  const [deltaAmount, setDeltaAmount] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const [, s] = await Promise.all([
      api<BudgetCurrentRes>("/api/budget/current"),
      api<SummaryRes>("/api/spend/summary"),
    ]);
    setSummary(s);
  }

  useEffect(() => {
    (async () => {
      const c = await api<{ categories: Category[] }>("/api/categories");
      setCats(c.categories);
      if (c.categories[0]) setCategoryId(c.categories[0].id);
      await refresh();
    })();
  }, []);

  const rows = useMemo(() => {
    if (!summary) return [];
    // keep your categories order by name for now
    return [...summary.byCategory].sort((a, b) => a.name.localeCompare(b.name));
  }, [summary]);

  const selectedRow = useMemo(() => {
    if (!summary) return null;
    return summary.byCategory.find((r) => r.id === categoryId) || null;
  }, [summary, categoryId]);

  const selectedName = useMemo(
    () => cats.find((c) => c.id === categoryId)?.name || "Select a category",
    [cats, categoryId]
  );

  const toBeBudgeted = useMemo(() => {
    // Placeholder until Plaid is hooked up:
    // shows how much is currently left across categories.
    return summary?.totalRemaining ?? 0;
  }, [summary]);

  async function doSet(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const n = Number(setAmount);
    if (!categoryId || !setAmount || Number.isNaN(n)) {
      setMsg("Enter a set amount.");
      return;
    }

    setBusy(true);
    try {
      await api("/api/budget/set", {
        method: "POST",
        body: JSON.stringify({ categoryId, amount: n }),
      });
      setSetAmount("");
      setMsg("Set ✅");
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error setting budget.");
    } finally {
      setBusy(false);
    }
  }

  async function doAdjust(sign: 1 | -1) {
    setMsg(null);

    const n = Number(deltaAmount);
    if (!categoryId || !deltaAmount || Number.isNaN(n)) {
      setMsg("Enter a modify amount.");
      return;
    }

    const delta = sign * n;

    setBusy(true);
    try {
      await api("/api/budget/adjust", {
        method: "POST",
        body: JSON.stringify({ categoryId, delta }),
      });
      setDeltaAmount("");
      setMsg(sign === 1 ? "Added ✅" : "Subtracted ✅");
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error modifying budget.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            
              
           
            <div className="text-sm font-semibold text-zinc-900">Budget</div>
           
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold ${
              toBeBudgeted < 0 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
            title="Placeholder until Plaid is wired"
          >
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">To Be Budgeted</span>
            <span>{money(toBeBudgeted)}</span>
          </div>
        </div>

        <div className="mt-1 text-xs text-zinc-500">
        
        </div>
      </div>

      {/* Main layout: table + inspector */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Table */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_120px_120px_140px] gap-3 border-b border-zinc-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <div>Category</div>
            <div className="text-right">Budgeted</div>
            <div className="text-right">Activity</div>
            <div className="text-right">Available</div>
          </div>

          {!summary && <div className="px-5 py-10 text-sm text-zinc-500">Loading…</div>}

          {summary && (
            <div className="divide-y divide-zinc-200">
              {rows.map((r) => {
                const isSelected = r.id === categoryId;
                const pct = barPct(r.budgeted, r.remaining);

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setCategoryId(r.id)}
                    className={`w-full text-left transition ${
                      isSelected ? "bg-zinc-50" : "bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <div className="grid grid-cols-[1fr_120px_120px_140px] gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-900">{r.name}</div>

                        {/* progress bar */}
                        <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                          <div
                            className="h-2 rounded-full bg-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right text-sm font-semibold text-zinc-900">{money(r.budgeted)}</div>
                      <div className="text-right text-sm text-zinc-700">{money(r.spent)}</div>

                      <div className="flex items-center justify-end gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${pillClasses(r.remaining)}`}>
                          {r.remaining < 0 ? `Over ${money(r.remaining)}` : `Avail ${money(r.remaining)}`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Inspector */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">{selectedName}</div>
              <div className="mt-1 text-sm text-zinc-500">Adjust the budget for the selected category.</div>
            </div>
          </div>

          {/* Snapshot */}
          <div className="mt-4 grid gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Budgeted</span>
              <span className="font-semibold text-zinc-900">{money(selectedRow?.budgeted ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Activity</span>
              <span className="font-semibold text-zinc-900">{money(selectedRow?.spent ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Available</span>
              <span className={`font-semibold ${selectedRow && selectedRow.remaining < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {money(selectedRow?.remaining ?? 0)}
              </span>
            </div>
          </div>

          {/* Category selector (optional but useful) */}
          <div className="mt-4">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Category</span>
              <select
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Set */}
          <form onSubmit={doSet} className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold text-zinc-900">Set budget (overwrite)</div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                value={setAmount}
                onChange={(e) => setSetAmount(e.target.value)}
                placeholder="1000"
                inputMode="decimal"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                Set
              </button>
            </div>
          </form>

          {/* Modify */}
          <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold text-zinc-900">Modify budget</div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                value={deltaAmount}
                onChange={(e) => setDeltaAmount(e.target.value)}
                placeholder="100"
                inputMode="decimal"
              />

              <button
                type="button"
                disabled={busy}
                onClick={() => doAdjust(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                title="Add"
              >
                +
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => doAdjust(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-white text-xl font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                title="Subtract"
              >
                −
              </button>
            </div>

            {msg && <div className="text-sm text-zinc-600">{msg}</div>}
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            Next: once Plaid is connected, “To Be Budgeted” will reflect your real cash balance.
          </div>
        </div>
      </div>
    </div>
  );
}
