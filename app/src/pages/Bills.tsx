import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Bill = { id: string; name: string; amount: number; mode: "auto" | "manual"; due_date: string; paidToday?: boolean };

function money(n: number) { return `$${n.toFixed(2)}`; }

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await api<{ bills: Bill[] }>("/api/bills");
    setBills(r.bills);
  }

  useEffect(() => { refresh(); }, []);

  async function addBill(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const n = Number(amount);
    if (!name.trim() || Number.isNaN(n)) { setMsg("Enter a name and amount."); return; }
    setBusy(true);
    try {
      await api("/api/bills", { method: "POST", body: JSON.stringify({ name: name.trim(), amount: n, mode, dueDate }) });
      setName(""); setAmount(""); setMsg("Bill added ✅"); await refresh();
    } finally { setBusy(false); }
  }

  async function markPaid(id: string) {
    setBusy(true);
    try { await api(`/api/bills/${id}/pay`, { method: "POST" }); await refresh(); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this bill?")) return;
    setBusy(true);
    try { await api(`/api/bills/${id}`, { method: "DELETE" }); await refresh(); }
    finally { setBusy(false); }
  }

  const sorted = useMemo(() => [...bills].sort((a, b) => a.due_date.localeCompare(b.due_date)), [bills]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">

      {/* Add bill form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="text-sm font-semibold text-slate-900 mb-4">Add a Bill</div>
        <form onSubmit={addBill} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bill name</span>
            <input className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={name} onChange={(e) => setName(e.target.value)} placeholder="Internet, mortgage…" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Amount</span>
            <input className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="120.00" inputMode="decimal" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due date</span>
            <input type="date" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <div className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mode</span>
            <div className="flex gap-2">
              <select className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="auto">Auto-draft</option>
                <option value="manual">Manual pay</option>
              </select>
              <button disabled={busy} className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all whitespace-nowrap">
                Add
              </button>
            </div>
          </div>
          {msg && <div className="text-sm text-slate-600 sm:col-span-2 lg:col-span-4">{msg}</div>}
        </form>
      </div>

      {/* Bills list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">All Bills</div>
          <div className="text-xs text-slate-400">{bills.length} total</div>
        </div>
        <div className="divide-y divide-slate-100">
          {sorted.length === 0 && <div className="px-5 py-8 text-sm text-slate-400">No bills yet. Add one above.</div>}
          {sorted.map((b) => {
            const isOverdue = b.due_date < today;
            const isDueToday = b.due_date === today;
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors md:px-5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${b.mode === "auto" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                  {b.mode === "auto" ? "A" : "M"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{b.name}</span>
                    <span className="font-mono text-sm font-medium text-slate-700">{money(b.amount)}</span>
                    {isDueToday && <span className="text-xs font-semibold rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Due today</span>}
                    {isOverdue && !isDueToday && <span className="text-xs font-semibold rounded-full bg-rose-100 text-rose-700 px-2 py-0.5">Overdue</span>}
                    {b.paidToday && <span className="text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">Paid today</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{b.mode === "auto" ? "Auto-draft" : "Manual"} · Due {b.due_date}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.mode === "manual" && !b.paidToday && (
                    <button onClick={() => markPaid(b.id)} disabled={busy}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-all">
                      Mark paid
                    </button>
                  )}
                  <button onClick={() => remove(b.id)} disabled={busy}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-all">
                    Delete
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