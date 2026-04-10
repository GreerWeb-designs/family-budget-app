import { useEffect, useMemo, useState } from "react";
import { Zap, Hand, Trash2, PlusCircle, Receipt } from "lucide-react";
import { api } from "../lib/api";
import { cn, money } from "../lib/utils";

type Bill = { id: string; name: string; amount: number; mode: "auto" | "manual"; day_of_month: number };

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const inputCls = "h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

export default function Bills() {
  const [bills, setBills]         = useState<Bill[]>([]);
  const [name, setName]           = useState("");
  const [amount, setAmount]       = useState("");
  const [mode, setMode]           = useState<"auto" | "manual">("auto");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [msg, setMsg]             = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const [showForm, setShowForm]   = useState(false);

  async function refresh() {
    const r = await api<{ bills: Bill[] }>("/api/bills");
    setBills(r.bills ?? []);
  }

  useEffect(() => { refresh(); }, []);

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n   = Number(amount);
    const day = Number(dayOfMonth);
    if (!name.trim() || Number.isNaN(n) || n <= 0) { setMsg("Enter a name and a valid amount."); return; }
    if (day < 1 || day > 31 || !Number.isInteger(day)) { setMsg("Due day must be 1–31."); return; }
    setBusy(true);
    try {
      await api("/api/bills", { method: "POST", body: JSON.stringify({ name: name.trim(), amount: n, mode, dayOfMonth: day }) });
      setName(""); setAmount(""); setDayOfMonth("1");
      setMsg("Bill added.");
      setShowForm(false);
      await refresh();
    } catch (err: any) { setMsg(err?.message || "Failed to add bill."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this recurring bill?")) return;
    setBusy(true);
    try { await api(`/api/bills/${id}`, { method: "DELETE" }); await refresh(); }
    finally { setBusy(false); }
  }

  const sorted       = useMemo(() => [...bills].sort((a, b) => a.day_of_month - b.day_of_month), [bills]);
  const totalMonthly = useMemo(() => bills.reduce((s, b) => s + Number(b.amount), 0), [bills]);
  const autoDraft    = useMemo(() => bills.filter(b => b.mode === "auto").reduce((s, b) => s + Number(b.amount), 0), [bills]);

  return (
    <div className="space-y-5">

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Monthly Total", value: money(totalMonthly), sub: `${bills.length} bill${bills.length !== 1 ? "s" : ""}` },
          { label: "Auto-draft",    value: money(autoDraft),    sub: `${bills.filter(b => b.mode === "auto").length} bills` },
          { label: "Manual pay",    value: money(totalMonthly - autoDraft), sub: `${bills.filter(b => b.mode === "manual").length} bills` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">{label}</div>
            <div className="font-display text-2xl font-semibold text-stone-900 tabular-nums">{value}</div>
            <div className="text-xs text-stone-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-sm",
          msg.includes("ailed") ? "bg-red-50 border-red-200 text-red-700" : "bg-teal-50 border-teal-200 text-teal-700")}>
          {msg}
        </div>
      )}

      {/* Bills list */}
      <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-stone-400" />
            <div className="text-sm font-semibold text-stone-900">Recurring Bills</div>
          </div>
          <button type="button" onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ background: "var(--color-primary)" }}>
            <PlusCircle size={13} />
            Add bill
          </button>
        </div>

        {/* Add form (collapsible) */}
        {showForm && (
          <div className="px-5 py-4 border-b bg-stone-50/50" style={{ borderColor: "var(--color-border)" }}>
            <form onSubmit={addBill} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Bill name</span>
                <input className={inputCls + " bg-white"} value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="Internet, mortgage…" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Amount</span>
                <input className={inputCls + " bg-white tabular-nums"} value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="120.00" inputMode="decimal" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Due day (1–31)</span>
                <input className={inputCls + " bg-white tabular-nums"} type="number" min={1} max={31}
                  value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} placeholder="15" />
              </label>
              <div className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Mode</span>
                <div className="flex gap-2">
                  <select className={inputCls + " bg-white flex-1"} value={mode}
                    onChange={(e) => setMode(e.target.value as "auto" | "manual")}>
                    <option value="auto">Auto-draft</option>
                    <option value="manual">Manual pay</option>
                  </select>
                  <button type="submit" disabled={busy}
                    className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 transition-all"
                    style={{ background: "var(--color-primary)" }}>
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {sorted.length === 0 && (
            <div className="px-5 py-12 text-center">
              <Receipt size={28} className="mx-auto text-stone-200 mb-2" />
              <div className="text-sm text-stone-400">No recurring bills yet.</div>
              <div className="text-xs text-stone-300 mt-0.5">Add one to track monthly obligations.</div>
            </div>
          )}
          {sorted.map((b) => {
            const isAuto = b.mode === "auto";
            const today  = new Date().getDate();
            const diff   = b.day_of_month - today;
            const dueSoon = diff >= 0 && diff <= 3;

            return (
              <div key={b.id} className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50/60 transition-colors">
                {/* Mode icon */}
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isAuto ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600")}>
                  {isAuto ? <Zap size={16} /> : <Hand size={16} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-stone-900">{b.name}</span>
                    <span className="font-semibold text-sm tabular-nums text-stone-700">{money(b.amount)}</span>
                    <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5",
                      isAuto ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
                      {isAuto ? "Auto" : "Manual"}
                    </span>
                    {dueSoon && (
                      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-red-100 text-red-700">
                        {diff === 0 ? "Today!" : `in ${diff}d`}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-400">Due the {ordinal(b.day_of_month)} of each month</div>
                </div>

                <button onClick={() => remove(b.id)} disabled={busy}
                  className="shrink-0 rounded-xl p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
