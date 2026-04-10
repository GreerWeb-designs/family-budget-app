import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PlusCircle, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { cn, money } from "../lib/utils";

type Category   = { id: string; name: string; direction?: string };
type SummaryRow = { id: string; name: string; budgeted: number; activity: number; available: number };
type SummaryRes = { byCategory: SummaryRow[] };
type TotalsRes  = { bankBalance: number; totalIncome: number; totalBudgeted: number; toBeBudgeted: number };
type AccountRes = { bankBalance: number; toBeBudgeted: number };
type MonthEntry = { month: string; closed_at: string | null };

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}
function getNextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getPrevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const inputCls = "h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

export default function Budget() {
  const [cats, setCats]           = useState<Category[]>([]);
  const [summary, setSummary]     = useState<SummaryRes | null>(null);
  const [totals, setTotals]       = useState<TotalsRes | null>(null);
  const [account, setAccount]     = useState<AccountRes | null>(null);
  const [months, setMonths]       = useState<MonthEntry[]>([]);
  const [activeMonth, setActiveMonth] = useState(currentMonthKey());
  const [categoryId, setCategoryId]   = useState("");
  const [setAmount, setSetAmount]     = useState("");
  const [bankInput, setBankInput]     = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [closingMonth, setClosingMonth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

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
  const selectedRow  = useMemo(() => rows.find((r) => r.id === categoryId) ?? null, [rows, categoryId]);
  const selectedName = useMemo(() => cats.find((c) => c.id === categoryId)?.name ?? "Select a category", [cats, categoryId]);
  const bankBalance  = Number(account?.bankBalance ?? totals?.bankBalance ?? 0);
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
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingCategoryId(id);
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      if (categoryId === id) setCategoryId("");
      setMsg("Category deleted."); await refresh(activeMonth);
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

  const tbbPositive = toBeBudgeted >= 0;

  return (
    <div className="space-y-4">

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3"
        style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
        <button type="button" onClick={() => setActiveMonth(getPrevMonth(activeMonth))}
          className="h-9 w-9 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <div className="font-display text-base font-semibold text-stone-900">{monthLabel(activeMonth)}</div>
          {isReadOnly
            ? <div className="text-xs text-stone-400 mt-0.5">Closed · Read-only</div>
            : isCurrentMonth
            ? <div className="text-xs mt-0.5" style={{ color: "var(--color-primary)" }}>Current month</div>
            : <div className="text-xs text-amber-600 mt-0.5">Viewing past month</div>}
        </div>
        <button type="button" onClick={() => setActiveMonth(getNextMonth(activeMonth))} disabled={isCurrentMonth}
          className="h-9 w-9 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30 transition-all flex items-center justify-center">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Bank + TBB stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Bank Balance</div>
          <div className="font-display text-3xl font-semibold text-stone-900 tabular-nums">{money(bankBalance)}</div>
          {isCurrentMonth && !isReadOnly && (
            <form onSubmit={handleResetBankBalance} className="mt-3 flex gap-2">
              <input value={bankInput} onChange={(e) => setBankInput(e.target.value)} inputMode="decimal"
                className={cn(inputCls, "flex-1 min-w-0 bg-stone-50 tabular-nums")} />
              <button type="submit" disabled={busy}
                className="h-10 rounded-xl border border-stone-200 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 transition-all">
                Update
              </button>
            </form>
          )}
        </div>

        <div className={cn("rounded-2xl border p-4", tbbPositive ? "bg-white" : "bg-red-50")}
          style={{ borderColor: tbbPositive ? "var(--color-border)" : "#FCA5A5", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">To Be Budgeted</div>
          <div className={cn("font-display text-3xl font-semibold tabular-nums", tbbPositive ? "text-stone-900" : "text-red-600")}>
            {money(toBeBudgeted)}
          </div>
          {!tbbPositive && (
            <div className="text-xs text-red-500 mt-1">Over-budgeted — reduce some categories</div>
          )}
          {isCurrentMonth && !isReadOnly && (
            <button type="button" onClick={handleCloseMonth} disabled={closingMonth || busy}
              className="mt-3 h-9 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-all">
              {closingMonth ? "Closing…" : `Close ${monthLabel(activeMonth)} →`}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-sm",
          msg.includes("ailed") || msg.includes("Error")
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-teal-50 border-teal-200 text-teal-700")}>
          {msg}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_300px]">

        {/* Category cards */}
        <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          {/* Header row — desktop */}
          <div className="hidden md:grid md:grid-cols-[1fr_100px_100px_110px_32px] gap-3 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider text-stone-400"
            style={{ borderColor: "var(--color-border)" }}>
            <div>Category</div>
            <div className="text-right">Budgeted</div>
            <div className="text-right">Spent</div>
            <div className="text-right">Available</div>
            <div />
          </div>

          {loading && (
            <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="flex justify-between mb-2">
                    <div className="h-3.5 w-28 rounded-full bg-stone-100" />
                    <div className="h-3.5 w-16 rounded-full bg-stone-100" />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-stone-100" />
                </div>
              ))}
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-stone-400">
              No categories yet — add one below.
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {rows.map((row) => {
                const pct      = row.budgeted > 0 ? Math.min((row.activity / row.budgeted) * 100, 100) : 0;
                const over     = row.budgeted > 0 && row.activity > row.budgeted;
                const warn     = !over && pct >= 85;
                const barColor = over ? "#EF4444" : warn ? "#F59E0B" : "var(--color-primary)";
                const isSelected = row.id === categoryId;

                return (
                  <button key={row.id} type="button" onClick={() => setCategoryId(row.id)}
                    className={cn(
                      "w-full text-left transition-colors px-5 py-4",
                      isSelected ? "bg-teal-50/60" : "bg-white hover:bg-stone-50/60"
                    )}>
                    {/* Mobile */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-stone-900 truncate max-w-[60%]">{row.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold tabular-nums", over ? "text-red-600" : "text-teal-700")}>
                            {money(row.available)}
                          </span>
                          {!isReadOnly && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                              disabled={deletingCategoryId === row.id}
                              className="rounded-lg p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <div className="flex gap-3 text-xs text-stone-400">
                        <span>Budget <span className="font-medium text-stone-600 tabular-nums">{money(row.budgeted)}</span></span>
                        <span>Spent <span className="font-medium text-stone-600 tabular-nums">{money(row.activity)}</span></span>
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:contents">
                      <div className="md:grid md:grid-cols-[1fr_100px_100px_110px_32px] gap-3 items-center">
                        <div className="space-y-1.5">
                          <span className="text-sm font-medium text-stone-900">{row.name}</span>
                          <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums text-stone-600">{money(row.budgeted)}</div>
                        <div className="text-right text-sm tabular-nums text-stone-500">{money(row.activity)}</div>
                        <div className={cn("text-right text-sm font-semibold tabular-nums", over ? "text-red-600" : "text-teal-700")}>
                          {money(row.available)}
                        </div>
                        <div className="flex justify-end">
                          {!isReadOnly && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                              disabled={deletingCategoryId === row.id}
                              className="rounded-lg p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-3">

          {/* Selected category */}
          <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="text-sm font-semibold text-stone-900 mb-0.5">{selectedName}</div>
            <div className="text-xs text-stone-400 mb-4">
              {isReadOnly ? "Read-only — month closed" : "Click any category, then set a budget"}
            </div>

            <div className="space-y-2 rounded-xl bg-stone-50 border border-stone-100 p-3 text-sm mb-4">
              {([["Budgeted", selectedRow?.budgeted], ["Activity", selectedRow?.activity], ["Available", selectedRow?.available]] as [string, number | undefined][]).map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-stone-500">{label}</span>
                  <span className={cn("font-semibold tabular-nums",
                    label === "Available" && Number(val ?? 0) < 0 ? "text-red-600" :
                    label === "Available" ? "text-teal-700" : "text-stone-900")}>
                    {money(Number(val ?? 0))}
                  </span>
                </div>
              ))}
            </div>

            {!isReadOnly && (
              <div className="space-y-2">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className={cn(inputCls, "w-full")}>
                  {cats.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <form onSubmit={handleSetBudget} className="flex gap-2">
                  <input value={setAmount} onChange={(e) => setSetAmount(e.target.value)}
                    placeholder="Amount" inputMode="decimal"
                    className={cn(inputCls, "flex-1 min-w-0 bg-stone-50 tabular-nums")} />
                  <button type="submit" disabled={busy}
                    className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 transition-all"
                    style={{ background: "var(--color-primary)" }}>
                    Set
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Add category */}
          {!isReadOnly && (
            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-3">
                <PlusCircle size={15} className="text-stone-400" />
                <div className="text-sm font-semibold text-stone-900">New Category</div>
              </div>
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Groceries"
                  className={cn(inputCls, "flex-1 min-w-0 bg-stone-50")} />
                <button type="submit" disabled={creatingCategory}
                  className="h-10 rounded-xl border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 transition-all">
                  Add
                </button>
              </form>
            </div>
          )}

          {/* Month history */}
          {months.length > 0 && (
            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="text-sm font-semibold text-stone-900 mb-3">Month History</div>
              <div className="space-y-1">
                {months.map((m) => (
                  <button key={m.month} type="button" onClick={() => setActiveMonth(m.month)}
                    className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all",
                      m.month === activeMonth ? "text-white" : "text-stone-700 hover:bg-stone-50")}
                    style={m.month === activeMonth ? { background: "var(--color-primary)" } : {}}>
                    <span>{monthLabel(m.month)}</span>
                    <span className={cn("text-xs", m.month === activeMonth ? "opacity-70" : m.closed_at ? "text-stone-400" : "text-teal-600")}>
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
