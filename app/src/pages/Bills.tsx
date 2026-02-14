import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Bill = {
  id: string;
  name: string;
  amount: number;
  mode: "auto" | "manual";
  due_date: string; // YYYY-MM-DD
  paidToday?: boolean;
};

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const r = await api<{ bills: Bill[] }>("/api/bills");
    setBills(r.bills);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const n = Number(amount);
    if (!name.trim() || Number.isNaN(n)) {
      setMsg("Enter a name and amount.");
      return;
    }

    await api("/api/bills", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), amount: n, mode, dueDate }),
    });

    setName("");
    setAmount("");
    setMsg("Saved ✅");
    await refresh();
  }

  async function markPaid(id: string) {
    await api(`/api/bills/${id}/pay`, { method: "POST" });
    await refresh();
  }

  async function remove(id: string) {
    await api(`/api/bills/${id}`, { method: "DELETE" });
    await refresh();
  }

  const sorted = useMemo(() => [...bills].sort((a, b) => a.due_date.localeCompare(b.due_date)), [bills]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Bills</h1>
        <p className="text-sm text-zinc-500">Add upcoming bills and manage due-date reminders.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <form onSubmit={addBill} className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Bill name</span>
            <input
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Internet, Car Insurance, etc."
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Amount</span>
            <input
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="120"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Due date</span>
            <input
              type="date"
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Mode</span>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <div className="flex items-end">
            <button className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800">
              Add Bill
            </button>
          </div>

          {msg && <div className="text-sm text-zinc-600 md:col-span-4">{msg}</div>}
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-800">Upcoming</div>
        <div className="divide-y divide-zinc-200">
          {sorted.length === 0 && <div className="px-5 py-6 text-sm text-zinc-500">No bills yet.</div>}
          {sorted.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-[220px]">
                <div className="font-medium text-zinc-900">{b.name}</div>
                <div className="text-sm text-zinc-500">
                  {b.mode.toUpperCase()} • Due {b.due_date} • ${b.amount.toFixed(2)}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => markPaid(b.id)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Mark paid today
                </button>
                <button
                  onClick={() => remove(b.id)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
