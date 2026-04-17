import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { cn, money } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { canAccess } from "../lib/permissions";

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

const inputCls = "h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

export default function Budget() {
  const { user } = useUser();
  const [cats, setCats]           = useState<Category[]>([]);
  const [summary, setSummary]     = useState<SummaryRes | null>(null);
  const [totals, setTotals]       = useState<TotalsRes | null>(null);
  const [account, setAccount]     = useState<AccountRes | null>(null);
  const [months, setMonths]       = useState<MonthEntry[]>([]);
  const [activeMonth, setActiveMonth] = useState(currentMonthKey());
  const [categoryId, setCategoryId]   = useState("");
  const [setAmount, setSetAmount]     = useState("");
  const [bankInput, setBankInput]     = useState("");
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatInputValue, setNewCatInputValue] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [closingMonth, setClosingMonth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  // Transaction panel state
  const [txDirection, setTxDirection] = useState<"out" | "in">("out");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txAmount, setTxAmount]   = useState("");
  const [txDate, setTxDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [txNote, setTxNote]       = useState("");
  const [txBusy, setTxBusy]       = useState(false);
  const [txMsg, setTxMsg]         = useState<string | null>(null);

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
    const uniqueCats = Array.from(
      new Map((catRes.categories ?? []).map((c: Category) => [c.id, c])).values()
    ) as Category[];
    const nonIncome = uniqueCats.filter((c) => c.id !== "income" && c.direction !== "inflow");

    const deduped = Object.values(
      (sumRes.byCategory ?? []).reduce((acc: Record<string, SummaryRow>, row: SummaryRow) => {
        if (!acc[row.id] || row.budgeted > acc[row.id].budgeted) acc[row.id] = row;
        return acc;
      }, {})
    ) as SummaryRow[];
    sumRes.byCategory = deduped;

    setCats(nonIncome); setSummary(sumRes); setTotals(totRes); setAccount(accRes);
    setMonths(monRes.months ?? []);
    setBankInput(String(accRes.bankBalance ?? 0));
    setCategoryId((prev) => { if (prev && nonIncome.some((c) => c.id === prev)) return prev; return nonIncome[0]?.id ?? ""; });
    setTxCategoryId((prev) => { if (prev && nonIncome.some((c) => c.id === prev)) return prev; return nonIncome[0]?.id ?? ""; });
  }

  if (!canAccess(user, "can_see_budget")) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-sm font-medium text-ink-900 mb-1">Budget is restricted</p>
        <p className="text-xs text-ink-500">Ask your household admin to grant access.</p>
      </div>
    );
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
      await refresh(activeMonth);
      if (result.id) setCategoryId(result.id);
      setMsg(`"${name}" added.`);
    } catch (err: any) { setMsg(err?.message || "Failed to create category."); }
    finally { setAddingCat(false); }
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

  async function submitTransaction(e: React.FormEvent) {
    e.preventDefault();
    setTxMsg(null);
    const n = Number(txAmount);
    if (!txAmount || Number.isNaN(n)) { setTxMsg("Enter an amount."); return; }
    if (!txCategoryId) { setTxMsg("Pick a category."); return; }
    setTxBusy(true);
    try {
      await api("/api/spend", {
        method: "POST",
        body: JSON.stringify({ categoryId: txCategoryId, amount: n, date: txDate, note: txNote, direction: txDirection }),
      });
      setTxAmount(""); setTxNote("");
      setTxMsg(txDirection === "in" ? "Income saved" : "Transaction saved");
      await refresh(activeMonth);
    } catch (err: any) { setTxMsg(err?.message || "Error saving."); }
    finally { setTxBusy(false); }
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
          className="h-9 w-9 rounded-xl border border-cream-200 text-ink-500 hover:bg-cream-50 transition-all flex items-center justify-center">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <div className="font-display text-base font-semibold text-ink-900">{monthLabel(activeMonth)}</div>
          {isReadOnly
            ? <div className="text-xs text-ink-500 mt-0.5">Closed · View only</div>
            : isCurrentMonth
            ? <div className="text-xs mt-0.5 text-teal-600">Current month</div>
            : <div className="text-xs text-rust-600 mt-0.5">Viewing past month</div>}
        </div>
        <button type="button" onClick={() => setActiveMonth(getNextMonth(activeMonth))} disabled={isCurrentMonth}
          className="h-9 w-9 rounded-xl border border-cream-200 text-ink-500 hover:bg-cream-50 disabled:opacity-30 transition-all flex items-center justify-center">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Log a Transaction (dark panel) ───────────── */}
      <div className="rounded-2xl p-5 shadow-lg" style={{ background: "#1B4243" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-rust-500 animate-pulse" />
          <span className="text-sm font-semibold text-white">Log a Transaction</span>
          <span className="text-xs text-teal-300 ml-auto">Quick entry</span>
        </div>

        {/* Direction toggle */}
        <div className="inline-flex rounded-xl border border-teal-900 bg-teal-800 p-1 mb-4">
          <button type="button" onClick={() => {
            setTxDirection("out");
            setTxCategoryId(cats[0]?.id ?? "");
          }}
            className={cn("rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
              txDirection === "out" ? "text-white shadow-sm" : "text-ink-500 hover:text-white")}
            style={txDirection === "out" ? { background: "#C17A3F" } : {}}>
            Outflow
          </button>
          <button type="button" onClick={() => {
            setTxDirection("in");
            const income = cats.find((c) => c.direction === "inflow");
            if (income) setTxCategoryId(income.id);
          }}
            className={cn("rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
              txDirection === "in" ? "text-white shadow-sm" : "text-ink-500 hover:text-white")}
            style={txDirection === "in" ? { background: "#2D6E70" } : {}}>
            Income
          </button>
        </div>

        <form onSubmit={submitTransaction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">Category</span>
              <select
                className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                value={txCategoryId}
                onChange={(e) => setTxCategoryId(e.target.value)}
                disabled={txDirection === "in"}>
                {(txDirection === "in"
                  ? cats.filter((c) => c.direction === "inflow")
                  : cats.filter((c) => c.direction !== "inflow")
                ).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">Amount</span>
              <input
                className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all tabular-nums"
                value={txAmount} onChange={(e) => setTxAmount(e.target.value)}
                placeholder="0.00" inputMode="decimal" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">Date</span>
              <input type="date"
                className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">Note (optional)</span>
            <input
              className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
              value={txNote} onChange={(e) => setTxNote(e.target.value)}
              placeholder={txDirection === "in" ? "Paycheck, transfer, etc." : "Walmart, gas, etc."} />
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={txBusy}
              className="h-10 w-full rounded-xl text-sm font-semibold text-ink-900 hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: "#C17A3F" }}>
              {txBusy ? "Saving…" : txDirection === "in" ? "Add income" : "Record"}
            </button>
          </div>
          {txMsg && (
            <div className={cn("text-sm text-center", txMsg.includes("Error") || txMsg.includes("error") ? "text-rust-600" : "text-teal-300")}>
              {txMsg}
            </div>
          )}
        </form>
      </div>

      {/* Bank + TBB stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Bank balance</div>
          <div className="font-display text-3xl font-semibold text-ink-900 tabular-nums">{money(bankBalance)}</div>
          {isCurrentMonth && !isReadOnly && (
            <form onSubmit={handleResetBankBalance} className="mt-3 flex gap-2">
              <input value={bankInput} onChange={(e) => setBankInput(e.target.value)} inputMode="decimal"
                className={cn(inputCls, "flex-1 min-w-0 bg-cream-50 tabular-nums")} />
              <button type="submit" disabled={busy}
                className="h-10 rounded-xl border border-cream-200 px-3 text-xs font-semibold text-ink-500 hover:bg-cream-50 disabled:opacity-60 transition-all">
                Update
              </button>
            </form>
          )}
        </div>

        <div className={cn("rounded-2xl border p-4", tbbPositive ? "bg-white" : "bg-rust-50")}
          style={{ borderColor: tbbPositive ? "var(--color-border)" : "rgba(184,121,31,0.4)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Ready to assign</div>
          <div className={cn("font-display text-3xl font-semibold tabular-nums", tbbPositive ? "text-teal-600" : "text-rust-600")}>
            {money(toBeBudgeted)}
          </div>
          {!tbbPositive && (
            <div className="text-xs text-rust-600 mt-1">Over-assigned — trim a category</div>
          )}
          {isCurrentMonth && !isReadOnly && (
            <button type="button" onClick={handleCloseMonth} disabled={closingMonth || busy}
              className="mt-3 h-9 w-full rounded-xl border border-rust-300/40 bg-rust-50 px-3 text-xs font-semibold text-rust-600 hover:bg-rust-50 disabled:opacity-60 transition-all">
              {closingMonth ? "Closing…" : "Start next month →"}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-sm",
          msg.includes("ailed") || msg.includes("Error")
            ? "bg-rust-50 border-rust-600/30 text-rust-600"
            : "bg-teal-50 border-teal-500/30 text-teal-600")}>
          {msg}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_300px]">

        {/* Category cards */}
        <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          {/* Header row — desktop */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_100px_100px_110px_32px] gap-3 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider text-ink-500"
            style={{ borderColor: "var(--color-border)" }}>
            <div>Category</div>
            <div className="text-right">Planned</div>
            <div className="text-right">Spent</div>
            <div className="text-right">Remaining</div>
            <div />
          </div>

          {loading && (
            <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="flex justify-between mb-2">
                    <div className="h-3.5 w-28 rounded-full bg-cream-100" />
                    <div className="h-3.5 w-16 rounded-full bg-cream-100" />
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-cream-100" />
                </div>
              ))}
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-ink-500">
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
                      isSelected ? "bg-teal-50/40" : "bg-white hover:bg-cream-50/60"
                    )}>
                    {/* Mobile */}
                    <div className="lg:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink-900 truncate max-w-[60%]">{row.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold tabular-nums", over ? "text-rust-600" : "text-teal-600")}>
                            {money(row.available)}
                          </span>
                          {!isReadOnly && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                              disabled={deletingCategoryId === row.id}
                              className="rounded-lg p-1 text-ink-500 hover:text-rust-600 hover:bg-rust-50 transition-colors disabled:opacity-40">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-cream-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <div className="flex gap-3 text-xs text-ink-500">
                        <span>Budget <span className="font-medium text-ink-500 tabular-nums">{money(row.budgeted)}</span></span>
                        <span>Spent <span className="font-medium text-ink-500 tabular-nums">{money(row.activity)}</span></span>
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden lg:contents">
                      <div className="lg:grid lg:grid-cols-[1fr_100px_100px_110px_32px] gap-3 items-center">
                        <div className="space-y-1.5">
                          <span className="text-sm font-medium text-ink-900">{row.name}</span>
                          <div className="h-1 w-full rounded-full bg-cream-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums text-ink-500">{money(row.budgeted)}</div>
                        <div className="text-right text-sm tabular-nums text-ink-500">{money(row.activity)}</div>
                        <div className={cn("text-right text-sm font-semibold tabular-nums", over ? "text-rust-600" : "text-teal-600")}>
                          {money(row.available)}
                        </div>
                        <div className="flex justify-end">
                          {!isReadOnly && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                              disabled={deletingCategoryId === row.id}
                              className="rounded-lg p-1 text-ink-500 hover:text-rust-600 hover:bg-rust-50 transition-colors disabled:opacity-40">
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
            <div className="text-sm font-semibold text-ink-900 mb-0.5">{selectedName}</div>
            <div className="text-xs text-ink-500 mb-4">
              {isReadOnly ? "This month is closed. View only." : "Click any category, then set a budget"}
            </div>

            <div className="space-y-2 rounded-xl bg-cream-50 border border-cream-100 p-3 text-sm mb-4">
              {([["Budgeted", selectedRow?.budgeted], ["Activity", selectedRow?.activity], ["Available", selectedRow?.available]] as [string, number | undefined][]).map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-ink-500">{label}</span>
                  <span className={cn("font-semibold tabular-nums",
                    label === "Available" && Number(val ?? 0) < 0 ? "text-rust-600" :
                    label === "Available" ? "text-teal-600" : "text-ink-900")}>
                    {money(Number(val ?? 0))}
                  </span>
                </div>
              ))}
            </div>

            {!isReadOnly && (
              <div className="space-y-2">
                <div className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Category</span>
                  <select
                    value={showNewCatInput ? "__new__" : categoryId}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setShowNewCatInput(true);
                        setNewCatInputValue("");
                      } else {
                        setShowNewCatInput(false);
                        setCategoryId(e.target.value);
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-cream-200 bg-white px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                    <option value="__new__">＋ New category</option>
                    <option disabled value="">──────────────</option>
                    {cats.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {showNewCatInput && (
                    <div className="flex gap-2 items-center">
                      <input
                        autoFocus
                        value={newCatInputValue}
                        onChange={(e) => setNewCatInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); handleCreateCategoryInline(); }
                          if (e.key === "Escape") { setShowNewCatInput(false); setNewCatInputValue(""); }
                        }}
                        placeholder="Category name"
                        className="h-10 flex-1 min-w-0 rounded-xl border border-cream-200 bg-cream-100 px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder-[#5C6B7A]"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategoryInline}
                        disabled={addingCat || !newCatInputValue.trim()}
                        className="h-10 rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-all">
                        {addingCat ? "…" : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewCatInput(false); setNewCatInputValue(""); }}
                        className="h-10 w-10 rounded-xl border border-cream-200 text-ink-500 hover:bg-cream-100 text-sm transition-all flex items-center justify-center">
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSetBudget} className="flex gap-2">
                  <input value={setAmount} onChange={(e) => setSetAmount(e.target.value)}
                    placeholder="Amount" inputMode="decimal"
                    className={cn(inputCls, "flex-1 min-w-0 bg-cream-50 tabular-nums")} />
                  <button type="submit" disabled={busy}
                    className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 transition-all"
                    style={{ background: "#1B4243" }}>
                    Save
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Month history */}
          {months.length > 0 && (
            <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="text-sm font-semibold text-ink-900 mb-3">Past months</div>
              <div className="space-y-1">
                {months.map((m) => (
                  <button key={m.month} type="button" onClick={() => setActiveMonth(m.month)}
                    className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all",
                      m.month === activeMonth ? "text-white" : "text-ink-900 hover:bg-cream-100")}
                    style={m.month === activeMonth ? { background: "#1B4243" } : {}}>
                    <span>{monthLabel(m.month)}</span>
                    <span className={cn("text-xs", m.month === activeMonth ? "opacity-70" : m.closed_at ? "text-ink-500" : "text-teal-600")}>
                      {m.closed_at ? "Closed" : "Current"}
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
