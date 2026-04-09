import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Category = { id: string; name: string; direction?: string };
type SummaryRow = { id: string; name: string; budgeted: number; activity: number; available: number };
type SummaryRes = { byCategory: SummaryRow[] };
type TotalsRes = { bankBalance: number; totalIncome: number; totalBudgeted: number; toBeBudgeted: number };
type AccountRes = { bankBalance: number; toBeBudgeted: number };
type MonthEntry = { month: string; closed_at: string | null };

function money(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function toBeBudgetedColor(n: number) {
  if (n < 0) return "text-red-700";
  if (n === 0) return "text-emerald-700";
  return "text-zinc-900";
}

function availableColor(n: number) {
  return n < 0 ? "text-red-700" : "text-emerald-700";
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [year, month] = m.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function getNextMonth(m: string) {
  const [year, month] = m.split("-").map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getPrevMonth(m: string) {
  const [year, month] = m.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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
    const [categoriesRes, summaryRes, totalsRes, accountRes, monthsRes] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<SummaryRes>(`/api/spend/summary?month=${month}`),
      api<TotalsRes>("/api/totals"),
      api<AccountRes>("/api/account"),
      api<{ months: MonthEntry[] }>("/api/budget/months"),
    ]);

    const nonIncome = (categoriesRes.categories ?? []).filter(
      (cat) => cat.id !== "income" && cat.direction !== "inflow"
    );

    setCats(nonIncome);
    setSummary(summaryRes);
    setTotals(totalsRes);
    setAccount(accountRes);
    setMonths(monthsRes.months ?? []);
    setBankInput(String(accountRes.bankBalance ?? 0));

    setCategoryId((prev) => {
      if (prev && nonIncome.some((c) => c.id === prev)) return prev;
      return nonIncome[0]?.id ?? "";
    });
  }

  useEffect(() => {
    setLoading(true);
    setMsg(null);
    refresh(activeMonth)
      .catch((err: any) => setMsg(err?.message || "Failed to load budget."))
      .finally(() => setLoading(false));
  }, [activeMonth]);

  const rows = useMemo(
    () => [...(summary?.byCategory ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [summary]
  );

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === categoryId) ?? null,
    [rows, categoryId]
  );

  const selectedCategoryName = useMemo(
    () => cats.find((c) => c.id === categoryId)?.name ?? "Select a category",
    [cats, categoryId]
  );

  const bankBalance = Number(account?.bankBalance ?? totals?.bankBalance ?? 0);
  const toBeBudgeted = Number(account?.toBeBudgeted ?? totals?.toBeBudgeted ?? 0);

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) return;
    setMsg(null);
    const amount = Number(setAmount);
    if (!categoryId || Number.isNaN(amount)) { setMsg("Enter a valid budget amount."); return; }
    setBusy(true);
    try {
      await api("/api/budget/set", {
        method: "POST",
        body: JSON.stringify({ categoryId, amount, month: activeMonth }),
      });
      setSetAmount("");
      setMsg("Budget updated.");
      await refresh(activeMonth);
    } catch (err: any) {
      setMsg(err?.message || "Failed to set budget.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetBankBalance(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const amount = Number(bankInput);
    if (Number.isNaN(amount)) { setMsg("Enter a valid bank balance."); return; }
    if (!window.confirm("Are you sure you want to set your bank balance?")) return;
    setBusy(true);
    try {
      await api("/api/account/set", { method: "POST", body: JSON.stringify({ bankBalance: amount }) });
      setMsg("Bank balance updated.");
      await refresh(activeMonth);
    } catch (err: any) {
      setMsg(err?.message || "Failed to update bank balance.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const name = newCategoryName.trim();
    if (!name) { setMsg("Enter a category name."); return; }
    setCreatingCategory(true);
    try {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name, direction: "outflow" }),
      });
      setNewCategoryName("");
      setMsg("Category created.");
      await refresh(activeMonth);
    } catch (err: any) {
      setMsg(err?.message || "Failed to create category.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    setMsg(null);
    if (!window.confirm(`Delete category "${name}"?`)) return;
    setDeletingCategoryId(id);
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      if (categoryId === id) setCategoryId("");
      setMsg("Category deleted.");
      await refresh(activeMonth);
    } catch (err: any) {
      setMsg(err?.message || "Failed to delete category.");
    } finally {
      setDeletingCategoryId(null);
    }
  }

  async function handleCloseMonth() {
    setMsg(null);
    const next = getNextMonth(activeMonth);
    if (!window.confirm(
      `Close ${monthLabel(activeMonth)} and start ${monthLabel(next)}?\n\nAll budgets will reset to $0. Your bank balance carries over.`
    )) return;
    setClosingMonth(true);
    try {
      await api("/api/budget/month/close", {
        method: "POST",
        body: JSON.stringify({ currentMonth: activeMonth, nextMonth: next }),
      });
      setMsg(`${monthLabel(next)} started!`);
      setActiveMonth(next);
    } catch (err: any) {
      setMsg(err?.message || "Failed to close month.");
    } finally {
      setClosingMonth(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* Month selector */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveMonth(getPrevMonth(activeMonth))}
          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          ←
        </button>

        <div className="text-center">
          <div className="text-sm font-semibold text-zinc-900">{monthLabel(activeMonth)}</div>
          {isReadOnly && <div className="mt-0.5 text-xs text-zinc-400">Read-only • Closed</div>}
          {isCurrentMonth && !isReadOnly && <div className="mt-0.5 text-xs text-emerald-600">Current month</div>}
        </div>

        <button
          type="button"
          onClick={() => setActiveMonth(getNextMonth(activeMonth))}
          disabled={isCurrentMonth}
          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {/* Main header */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Budget</div>
            <div className="mt-1 text-sm text-zinc-500">
              Income increases To Be Budgeted. Budgeted categories reduce To Be Budgeted.
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">To Be Budgeted</div>
            <div className={`mt-1 text-2xl font-bold ${toBeBudgetedColor(toBeBudgeted)}`}>
              {money(toBeBudgeted)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 md:grid md:grid-cols-[1fr_auto] md:items-end">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bank Balance</div>
            <div className="mt-1 text-xl font-semibold text-zinc-900">{money(bankBalance)}</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {isCurrentMonth && !isReadOnly && (
              <form onSubmit={handleResetBankBalance} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={bankInput}
                  onChange={(e) => setBankInput(e.target.value)}
                  placeholder="Enter bank balance"
                  inputMode="decimal"
                  className="h-11 min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Set Bank Balance
                </button>
              </form>
            )}
            {isCurrentMonth && !isReadOnly && (
              <button
                type="button"
                onClick={handleCloseMonth}
                disabled={closingMonth || busy}
                className="h-11 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {closingMonth ? "Closing…" : `Close ${monthLabel(activeMonth)} →`}
              </button>
            )}
          </div>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">
          {msg}
        </div>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_360px]">

        {/* Category table */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1fr_120px_120px_140px] gap-3 border-b border-zinc-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
            <div>Category</div>
            <div className="text-right">Budgeted</div>
            <div className="text-right">Activity</div>
            <div className="text-right">Available</div>
          </div>

          {loading && <div className="px-5 py-10 text-sm text-zinc-500">Loading…</div>}
          {!loading && rows.length === 0 && (
            <div className="px-5 py-10 text-sm text-zinc-500">No categories found.</div>
          )}

          {!loading && rows.length > 0 && (
            <div className="divide-y divide-zinc-200">
              {rows.map((row) => {
                const isSelected = row.id === categoryId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setCategoryId(row.id)}
                    className={`block w-full px-4 py-4 text-left transition md:grid md:grid-cols-[1fr_120px_120px_140px] md:gap-3 md:px-5 md:py-3 ${
                      isSelected ? "bg-zinc-50" : "bg-white hover:bg-zinc-50"
                    }`}
                  >
                    {/* Mobile */}
                    <div className="md:hidden">
                      <div className="mb-2 truncate text-sm font-medium text-zinc-900">{row.name}</div>
                      <div className="space-y-1">
                        <div className="text-sm text-zinc-700">
                          <span className="mr-2 text-zinc-500">Budgeted:</span>
                          <span className="font-semibold text-zinc-900">{money(row.budgeted)}</span>
                        </div>
                        <div className="text-sm text-zinc-700">
                          <span className="mr-2 text-zinc-500">Activity:</span>
                          {money(row.activity)}
                        </div>
                        <div className={`text-sm font-semibold ${availableColor(row.available)}`}>
                          <span className="mr-2 font-normal text-zinc-500">Available:</span>
                          {money(row.available)}
                        </div>
                      </div>
                      {!isReadOnly && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                            disabled={deletingCategoryId === row.id}
                            className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                          >Delete</button>
                        </div>
                      )}
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:flex md:items-center md:justify-between">
                      <div className="truncate text-sm font-medium text-zinc-900">{row.name}</div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteCategory(row.id, row.name); }}
                          disabled={deletingCategoryId === row.id}
                          className="ml-3 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >Delete</button>
                      )}
                    </div>
                    <div className="hidden text-right text-sm font-semibold text-zinc-900 md:block">{money(row.budgeted)}</div>
                    <div className="hidden text-right text-sm text-zinc-700 md:block">{money(row.activity)}</div>
                    <div className={`hidden text-right text-sm font-semibold md:block ${availableColor(row.available)}`}>{money(row.available)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <div>
            <div className="text-sm font-semibold text-zinc-900">{selectedCategoryName}</div>
            <div className="mt-1 text-sm text-zinc-500">
              {isReadOnly ? "This month is closed. View only." : "Set the budget for the selected category."}
            </div>
          </div>

          {!isReadOnly && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Add Category</div>
              <div className="mt-1 text-sm text-zinc-500">Create a custom budget category.</div>
              <form onSubmit={handleCreateCategory} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                />
                <button
                  type="submit"
                  disabled={creatingCategory}
                  className="h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                >Add</button>
              </form>
            </div>
          )}

          <div className="mt-4 grid gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Budgeted</span>
              <span className="font-semibold text-zinc-900">{money(selectedRow?.budgeted)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Activity</span>
              <span className="font-semibold text-zinc-900">{money(selectedRow?.activity)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Available</span>
              <span className={`font-semibold ${availableColor(selectedRow?.available ?? 0)}`}>
                {money(selectedRow?.available)}
              </span>
            </div>
          </div>

          {!isReadOnly && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-zinc-700">Category</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                >
                  {cats.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </label>
              <form onSubmit={handleSetBudget} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={setAmount}
                  onChange={(e) => setSetAmount(e.target.value)}
                  placeholder="Enter budget amount"
                  inputMode="decimal"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >Set</button>
              </form>
            </div>
          )}

          {/* Month history */}
          {months.length > 0 && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Month History</div>
              <div className="mt-2 space-y-1">
                {months.map((m) => (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setActiveMonth(m.month)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                      m.month === activeMonth ? "bg-zinc-900 text-white" : "hover:bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    <span>{monthLabel(m.month)}</span>
                    <span className="text-xs opacity-60">{m.closed_at ? "Closed" : "Active"}</span>
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