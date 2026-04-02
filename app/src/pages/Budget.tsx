import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Category = {
  id: string;
  name: string;
};

type SummaryRow = Category & {
  budgeted: number;
  activity: number;
  available: number;
};

type SummaryRes = {
  byCategory: SummaryRow[];
};

type TotalsRes = {
  bankBalance: number;
  totalIncome: number;
  totalBudgeted: number;
  toBeBudgeted: number;
};

type AccountRes = {
  bankBalance: number;
  toBeBudgeted: number;
};

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

export default function Budget() {
  const [cats, setCats] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryRes | null>(null);
  const [totals, setTotals] = useState<TotalsRes | null>(null);
  const [account, setAccount] = useState<AccountRes | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [setAmount, setSetAmount] = useState("");
  const [bankInput, setBankInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const [categoriesRes, summaryRes, totalsRes, accountRes] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<SummaryRes>("/api/spend/summary"),
      api<TotalsRes>("/api/totals"),
      api<AccountRes>("/api/account"),
    ]);

    const nonIncomeCategories = (categoriesRes.categories ?? []).filter((cat) => cat.id !== "income");

    setCats(nonIncomeCategories);
    setSummary(summaryRes);
    setTotals(totalsRes);
    setAccount(accountRes);

    if (!categoryId && nonIncomeCategories.length) {
      setCategoryId(nonIncomeCategories[0].id);
    }

    setBankInput(String(accountRes.bankBalance ?? 0));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        await refresh();
      } catch (err: any) {
        setMsg(err?.message || "Failed to load budget.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    return [...(summary?.byCategory ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [summary]);

  const selectedRow = useMemo(() => {
    return rows.find((r) => r.id === categoryId) ?? null;
  }, [rows, categoryId]);

  const selectedCategoryName = useMemo(() => {
    return cats.find((c) => c.id === categoryId)?.name ?? "Select a category";
  }, [cats, categoryId]);

  const bankBalance = Number(account?.bankBalance ?? totals?.bankBalance ?? 0);
  const toBeBudgeted = Number(account?.toBeBudgeted ?? totals?.toBeBudgeted ?? 0);

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const amount = Number(setAmount);

    if (!categoryId || Number.isNaN(amount)) {
      setMsg("Enter a valid budget amount.");
      return;
    }

    setBusy(true);
    try {
      await api("/api/budget/set", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          amount,
        }),
      });

      setSetAmount("");
      setMsg("Budget updated.");
      await refresh();
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

    if (Number.isNaN(amount)) {
      setMsg("Enter a valid bank balance.");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to reset your bank balance?");
    if (!confirmed) return;

    setBusy(true);
    try {
      await api("/api/account/set", {
        method: "POST",
        body: JSON.stringify({
          bankBalance: amount,
        }),
      });

      setMsg("Bank balance updated.");
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Failed to update bank balance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Budget</div>
            <div className="mt-1 text-sm text-zinc-500">
              Income increases To Be Budgeted. Budgeted categories reduce To Be Budgeted.
              Spending affects Activity and Available.
            </div>
          </div>

          <div className="text-left md:text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              To Be Budgeted
            </div>
            <div className={`mt-1 text-2xl font-bold ${toBeBudgetedColor(toBeBudgeted)}`}>
              {money(toBeBudgeted)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 md:grid md:grid-cols-[1fr_auto] md:items-end">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Bank Balance
            </div>
            <div className="mt-1 text-xl font-semibold text-zinc-900">{money(bankBalance)}</div>
          </div>

          <form onSubmit={handleResetBankBalance} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
              Reset Bank Balance
            </button>
          </form>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">
          {msg}
        </div>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_360px]">
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
                    <div className="mb-2 truncate text-sm font-medium text-zinc-900 md:mb-0">
                      {row.name}
                    </div>

                    <div className="space-y-1 md:hidden">
                      <div className="text-sm text-zinc-700">
                        <span className="mr-2 text-zinc-500">Budgeted:</span>
                        <span className="font-semibold text-zinc-900">{money(row.budgeted)}</span>
                      </div>
                      <div className="text-sm text-zinc-700">
                        <span className="mr-2 text-zinc-500">Activity:</span>
                        {money(row.activity)}
                      </div>
                      <div className={`text-sm font-semibold ${availableColor(row.available)}`}>
                        <span className="mr-2 text-zinc-500 font-normal">Available:</span>
                        {money(row.available)}
                      </div>
                    </div>

                    <div className="hidden text-right text-sm font-semibold text-zinc-900 md:block">
                      {money(row.budgeted)}
                    </div>
                    <div className="hidden text-right text-sm text-zinc-700 md:block">
                      {money(row.activity)}
                    </div>
                    <div className={`hidden text-right text-sm font-semibold md:block ${availableColor(row.available)}`}>
                      {money(row.available)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <div>
            <div className="text-sm font-semibold text-zinc-900">{selectedCategoryName}</div>
            <div className="mt-1 text-sm text-zinc-500">
              Set the budget for the selected category.
            </div>
          </div>

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

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-700">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
              >
                {cats.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
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
              >
                Set
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}