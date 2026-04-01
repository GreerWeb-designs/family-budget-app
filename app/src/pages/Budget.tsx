import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Category = { id: string; name: string };

type SummaryRow = Category & {
  budgeted: number;
  activity: number;
  available: number;
};

type SummaryRes = {
  byCategory: SummaryRow[];
};

type TotalsRes = {
  totalIncome: number;
  totalBudgeted: number;
};

type AccountRes = {
  bankBalance: number;
};

function money(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function availableColor(n: number) {
  return n < 0 ? "text-red-700" : "text-emerald-700";
}

function tbbClasses(n: number) {
  if (n < 0) return "text-red-700";
  if (n === 0) return "text-emerald-700";
  return "text-zinc-900";
}

export default function Budget() {
  const [cats, setCats] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryRes | null>(null);
  const [totals, setTotals] = useState<TotalsRes | null>(null);
  const [account, setAccount] = useState<AccountRes | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [setAmount, setSetAmount] = useState("");

  const [bankInput, setBankInput] = useState("");

  async function refresh() {
    const [s, t, a] = await Promise.all([
      api<SummaryRes>("/api/spend/summary"),
      api<TotalsRes>("/api/totals"),
      api<AccountRes>("/api/account"),
    ]);

    setSummary(s);
    setTotals(t);
    setAccount(a);
    setBankInput(String(a.bankBalance));
  }

  useEffect(() => {
    (async () => {
      const c = await api<{ categories: Category[] }>("/api/categories");
      setCats(c.categories);
      if (c.categories[0]) setCategoryId(c.categories[0].id);
      await refresh();
    })();
  }, []);

  const bankBalance = account?.bankBalance ?? 0;
  const totalIncome = totals?.totalIncome ?? 0;
  const totalBudgeted = totals?.totalBudgeted ?? 0;

  // 🔥 CORRECT MODEL
  const toBeBudgeted = useMemo(() => {
    return bankBalance + totalIncome - totalBudgeted;
  }, [bankBalance, totalIncome, totalBudgeted]);

  async function setBudget(e: React.FormEvent) {
    e.preventDefault();

    const n = Number(setAmount);
    if (!categoryId || Number.isNaN(n)) return;

    await api("/api/budget/set", {
      method: "POST",
      body: JSON.stringify({ categoryId, amount: n }),
    });

    setSetAmount("");
    await refresh();
  }

  async function resetBank(e: React.FormEvent) {
    e.preventDefault();

    const n = Number(bankInput);
    if (Number.isNaN(n)) return;

    if (!window.confirm("Are you sure you want to reset your bank balance?")) return;

    await api("/api/account/set", {
      method: "POST",
      body: JSON.stringify({ bankBalance: n }),
    });

    await refresh();
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm font-semibold">Budget</div>
        </div>

        <div className={`text-lg font-bold ${tbbClasses(toBeBudgeted)}`}>
          TO BE BUDGETED {money(toBeBudgeted)}
        </div>
      </div>

      {/* BANK BALANCE */}
      <div className="rounded-xl border p-4 flex justify-between items-center">
        <div>
          <div className="text-xs text-zinc-500">Bank Balance</div>
          <div className="text-lg font-semibold">{money(bankBalance)}</div>
        </div>

        <form onSubmit={resetBank} className="flex gap-2">
          <input
            value={bankInput}
            onChange={(e) => setBankInput(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <button className="border px-3 py-1 rounded">Reset</button>
        </form>
      </div>

      {/* CATEGORY TABLE */}
      <div className="rounded-xl border bg-white">
        <div className="grid grid-cols-[1fr_120px_120px_140px] p-3 text-xs font-semibold text-zinc-500">
          <div>Category</div>
          <div className="text-right">Budgeted</div>
          <div className="text-right">Activity</div>
          <div className="text-right">Available</div>
        </div>

        {summary?.byCategory.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_120px_120px_140px] p-3 border-t"
          >
            <div>{r.name}</div>
            <div className="text-right">{money(r.budgeted)}</div>
            <div className="text-right">{money(r.activity)}</div>
            <div className={`text-right font-semibold ${availableColor(r.available)}`}>
              {money(r.available)}
            </div>
          </div>
        ))}
      </div>

      {/* SET BUDGET */}
      <div className="rounded-xl border p-4">
        <div className="text-sm font-semibold mb-2">Set Budget</div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="border p-2 w-full mb-2"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <form onSubmit={setBudget} className="flex gap-2">
          <input
            value={setAmount}
            onChange={(e) => setSetAmount(e.target.value)}
            placeholder="100"
            className="border p-2 flex-1"
          />
          <button className="bg-black text-white px-4 rounded">Set</button>
        </form>
      </div>
    </div>
  );
}