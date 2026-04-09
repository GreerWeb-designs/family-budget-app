import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Category = { id: string; name: string; direction?: string };
type SummaryRow = { id: string; name: string; budgeted: number; activity: number; available: number };
type SummaryRes = { byCategory: SummaryRow[] };
type TotalsRes = { bankBalance: number; totalIncome: number; totalBudgeted: number; toBeBudgeted: number };
type AccountRes = { bankBalance: number; toBeBudgeted: number };
type MonthEntry = { month: string; closed_at: string | null };

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}
function tbbColor(n: number) { return n < 0 ? "text-rose-600" : n === 0 ? "text-emerald-600" : "text-slate-900"; }
function availColor(n: number) { return n < 0 ? "text-rose-600" : "text-emerald-600"; }
function currentMonthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthLabel(m: string) { const [y, mo] = m.split("-"); return new Date(Number(y), Number(mo)-1, 1).toLocaleString("default", { month: "long", year: "numeric" }); }
function getNextMonth(m: string) { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function getPrevMonth(m: string) { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo-2, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }

export default function Budget() {
  const [cats, setCats] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryRes | null>(null);
  const [totals, setTotals] = useState<TotalsRes | null>(null);
  const [account, setAccount] = useState<AccountRes | null>(null);
  const [months, setMonths] = useState<MonthEntry[]>([]);
  const [activeMonth, setActiveMonth] = useState(currentMonthKey());
  const [categoryId, setCategoryId] = useState("");
  const [setAmount, setSetAmount] = useState("");
  const [bankInput, setBankInput] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [closingMonth, setClosingMonth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isCurrentMonth = activeMonth === currentMonthKey();
  const activeMonthData = months.find((m) => m.month === activeMonth);
  const isReadOnly = !!activeMonthData?.closed_at;

  async function refresh(month: string) {
    const [catRes, sumRes, totRes, accRes, monRes] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<SummaryRes>(`/api/spend/summary?month=${month}`),
      api<TotalsRes>("/api/totals"),
      api<AccountRes>("/api/account"),
      api<{ months: MonthEntry[] }>("/api/budget/months"),
    ]);
    const nonIncome = (catRes.categories ?? []).filter((c) => c.id !== "income" && c.direction !== "inflow");
    setCats(nonIncome); setSummary(sumRes); setTotals(totRes); setAccount(accRes);
    setMonths(monRes.months ?? []);
    setBankInput(String(accRes.bankBalance ?? 0));
    setCategoryId((prev) => { if (prev && nonIncome.some((c) => c.id === prev)) return prev; return nonIncome[0]?.id ?? ""; });
  }

  useEffect(() => {
    setLoading(true); setMsg(null);
    refresh(activeMonth).catch((e: any) => setMsg(e?.message || "Failed to load.")).finally(() => setLoading(false));
  }, [activeMonth]);

  const rows = useMemo(() => [...(summary?.byCategory ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [summary]);
  const selectedRow = useMemo(() => rows.find((r) => r.id === categoryId) ?? null, [rows, categoryId]);
  const selectedName = useMemo(() => cats.find((c) => c.id === categoryId)?.name ?? "Select a category", [cats, categoryId]);
  const bankBalance = Number(account?.bankBalance ?? totals?.bankBalance ?? 0);
  const toBeBudgeted = Number(account?.toBeBudgeted ?? totals?.toBeBudgeted ?? 0);

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault(); if (isReadOnly) return; setMsg(null);
    const amount = Number(setAmount);
    if (!categoryId || Number.isNaN(amount)) { setMsg("Enter a valid amount."); return; }
    setBusy(true);
    try {
      await api("/api/budget/set", { method: "POST", body: JSON.stringify({ categoryId, amount, month: activeMonth }) });
      setSetAmount(""); setMsg("Budget updated."); await refresh(activeMonth);
    } catch (err: any) { setMsg(err?.message || "Failed."); } finally { setBusy(false); }
  }

  async function handleResetBankBalance(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const amount = Number(bankInput);
    if (Number.isNaN(amount)) { setMsg("Enter a valid balance."); return; }
    if (!window.confirm("Set bank balance?")) return;
    setBusy(true);
    try {
      await api("/api/account/set", { method: "POST", body: JSON.stringify({ bankBalance: amount }) });
      setMsg("Bank balance updated."); await refresh(activeMonth);
    } catch (err: any) { setMsg(err?.message || "Failed."); } finally { setBusy(false); }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const name = newCategoryName.trim();
    if (!name) { setMsg("Enter a category name."); return; }
    setCreatingCategory(true);
    try {
      await api("/api/categories", { method: "POST", body: JSON.stringify({ name, direction: "outflow" }) });
      setNewCategoryName(""); setMsg("Category created."); await refresh(activeMonth);
    } catch (err: any) { setMsg(err?.message || "Failed."); } finally { setCreatingCategory(false); }
  }

  async function handleDeleteCategory(id: string, name: string) {
    setMsg(null);
    if (!window.confirm(`Delete "${name}"?`)) return;
    setDeletingCategoryId(id);
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      if (categoryId === id) setCategoryId("");
      setMsg("Deleted."); await refresh(activeMonth);
    } catch (err: any) { setMsg(err?.message || "Failed."); } finally { setDeletingCategoryId(null); }
  }

  async function handleCloseMonth() {
    setMsg(null);
    const next = getNextMonth(activeMonth);
    if (!window.confirm(`Close ${monthLabel(activeMonth)} and start ${monthLabel(next)}?\n\nAll budgets reset to $0.`)) return;
    setClosingMonth(true);
    try {
      await api("/api/budget/month/close", { method: "POST", body: JSON.stringify({ currentMonth: activeMonth, nextMonth: next }) });
      setMsg(`${monthLabel(next)} started!`); setActiveMonth(next);
    } catch (err: any) { setMsg(err?.message || "Failed."); } finally { setClosingMonth(false); }
  }

  return (
    <div className="space-y-4">

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => setActiveMonth(getPrevMonth(activeMonth))}
          className="h-9 w-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center text-sm font-bold">
          ‹
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-900">{monthLabel(activeMonth)}</div>
          {isReadOnly ? <div className="text-xs text-slate-400 mt-0.5">Closed · Read-only</div>
            : isCurrentMonth ? <div className="text-xs text-emerald-600 mt-0.5">Current month</div>
            : <div className="text-xs text-amber-600 mt-0.5">Viewing past month</div>}
        </div>
        <button type="button" onClick={() => setActiveMonth(getNextMonth(activeMonth))} disabled={isCurrentMonth}
          className="h-9 w-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all flex items-center justify-center text-sm font-bold">
          ›
        </button>
      </div>

      {/* Bank balance + TBB */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Bank Balance</div>
          <div className="text-2xl font-mono font-bold text-slate-900">{money(bankBalance)}</div>
          {isCurrentMonth && !isReadOnly && (
            <form onSubmit={handleResetBankBalance} className="mt-3 flex gap-2">
              <input value={bankInput} onChange={(e) => setBankInput(e.target.value)} inputMode="decimal"
                className="h-9 flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              <button type="submit" disabled={busy} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-all">
                Update
              </button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">To Be Budgeted</div>
          <div className={`text-2xl font-mono font-bold ${tbbColor(toBeBudgeted)}`}>{money(toBeBudgeted)}</div>
          {isCurrentMonth && !isReadOnly && (
            <button type="button" onClick={handleCloseMonth} disabled={closingMonth || busy}
              className="mt-3 h-9 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-all">
              {closingMonth ? "Closing…" : `Close ${monthLabel(activeMonth)} →`}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">{msg}</div>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_320px]">

        {/* Category table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="hidden grid-cols-[1fr_110px_110px_120px] gap-2 border-b border-slate-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid">
            <div>Category</div>
            <div className="text-right">Budgeted</div>
            <div className="text-right">Activity</div>
            <div className="text-right">Available</div>
          </div>

          {loading && <div className="px-5 py-10 text-sm text-slate-400">Loading…</div>}
          {!loading && rows.length === 0 && <div className="px-5 py-10 text-sm text-slate-400">No categories found.</div>}

          {!loading && rows.length > 0 && (
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <button key={row.id} type="button" onClick={() => setCategoryId(row.id)}
                  className={`block w-full text-left transition-colors md:grid md:grid-cols-[1fr_110px_110px_120px] md:gap-2 md:px-5 md:py-3 px-4 py-3.5 ${row.id === categoryId ? "bg-slate-50" : "bg-white hover:bg-slate-50/50"}`}>

                  {/* Mobile layout */}
                  <div className="md:hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-900 truncate">{row.name}</span>
                      <span className={`text-sm font-mono font-semibold ${availColor(row.available)}`}>{money(row.available)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Budget <span className="font-mono text-slate-600">{money(row.budgeted)}</span></span>
                      <span>Spent <span className="font-mono text-slate-600">{money(row.activity)}</span></span>
                    </div>
                    {!isReadOnly && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                        disabled={deletingCategoryId === row.id}
                        className="mt-2 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-all">
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:flex md:items-center md:justify-between">
                    <span className="text-sm font-medium text-slate-900 truncate">{row.name}</span>
                    {!isReadOnly && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                        disabled={deletingCategoryId === row.id}
                        className="ml-2 rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 transition-all">
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="hidden md:block text-right text-sm font-mono font-medium text-slate-900">{money(row.budgeted)}</div>
                  <div className="hidden md:block text-right text-sm font-mono text-slate-500">{money(row.activity)}</div>
                  <div className={`hidden md:block text-right text-sm font-mono font-semibold ${availColor(row.available)}`}>{money(row.available)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-3">

          {/* Selected category detail */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900 mb-0.5">{selectedName}</div>
            <div className="text-xs text-slate-400 mb-3">{isReadOnly ? "Read-only — month closed" : "Click a category then set amount"}</div>

            <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
              {[["Budgeted", selectedRow?.budgeted], ["Activity", selectedRow?.activity], ["Available", selectedRow?.available]].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className={`font-mono font-medium ${label === "Available" && Number(val ?? 0) < 0 ? "text-rose-600" : label === "Available" ? "text-emerald-600" : "text-slate-900"}`}>{money(Number(val ?? 0))}</span>
                </div>
              ))}
            </div>

            {!isReadOnly && (
              <div className="mt-3">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all mb-2">
                  {cats.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <form onSubmit={handleSetBudget} className="flex gap-2">
                  <input value={setAmount} onChange={(e) => setSetAmount(e.target.value)} placeholder="Amount" inputMode="decimal"
                    className="h-10 flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                  <button type="submit" disabled={busy}
                    className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all">
                    Set
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Add category */}
          {!isReadOnly && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Add Category</div>
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name"
                  className="h-10 flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                <button type="submit" disabled={creatingCategory}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-all">
                  Add
                </button>
              </form>
            </div>
          )}

          {/* Month history */}
          {months.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Month History</div>
              <div className="space-y-1">
                {months.map((m) => (
                  <button key={m.month} type="button" onClick={() => setActiveMonth(m.month)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all ${m.month === activeMonth ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}>
                    <span>{monthLabel(m.month)}</span>
                    <span className={`text-xs ${m.month === activeMonth ? "opacity-60" : m.closed_at ? "text-slate-400" : "text-emerald-600"}`}>
                      {m.closed_at ? "Closed" : "Active"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}