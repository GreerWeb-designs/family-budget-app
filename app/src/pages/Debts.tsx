import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Debt = { id: string; name: string; balance: number; apr: number; payment: number; created_at: string; updated_at: string };

function money(n: number) { return n.toLocaleString(undefined, { style: "currency", currency: "USD" }); }
function parseNum(s: string) { const n = Number(String(s).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : NaN; }
function addMonths(d: Date, months: number) { const c = new Date(d); const day = c.getDate(); c.setMonth(c.getMonth() + months); if (c.getDate() !== day) c.setDate(0); return c; }
function fmtDate(d: Date) { return d.toLocaleDateString(undefined, { year: "numeric", month: "short" }); }

function simulateSnowball(debts: { id: string; name: string; balance: number; apr: number; payment: number }[], extraPerMonth: number, startDate: Date) {
  const state = debts.map((d) => ({ ...d, balance: Math.max(0, d.balance), totalInterest: 0, paidOffMonthIndex: null as number | null }));
  const MAX_MONTHS = 1200; let month = 0;
  while (month < MAX_MONTHS) {
    const remaining = state.filter((d) => d.balance > 0);
    if (remaining.length === 0) break;
    for (const d of remaining) { const r = (d.apr / 100) / 12; const interest = d.balance * r; d.totalInterest += interest; d.balance += interest; }
    for (const d of remaining) { const pay = Math.min(Math.max(0, d.payment), d.balance); d.balance -= pay; }
    const extra = Math.max(0, extraPerMonth);
    if (extra > 0) { const rem2 = state.filter((d) => d.balance > 0).sort((a, b) => a.balance - b.balance); if (rem2[0]) { rem2[0].balance -= Math.min(extra, rem2[0].balance); } }
    for (const d of state) { if (d.paidOffMonthIndex == null && d.balance <= 0.00001) { d.balance = 0; d.paidOffMonthIndex = month + 1; } }
    month += 1;
  }
  const out = new Map<string, { months: number | null; totalInterest: number | null; payoffDate: string | null; warning?: string }>();
  for (const d of state) {
    if (d.balance > 0) out.set(d.id, { months: null, totalInterest: null, payoffDate: null, warning: "Payment too low — increase to pay off." });
    else { const m = d.paidOffMonthIndex ?? 0; out.set(d.id, { months: m, totalInterest: d.totalInterest, payoffDate: fmtDate(addMonths(startDate, m)) }); }
  }
  return out;
}

export default function Debts() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [extra, setExtra] = useState("0");
  const [extraSaved, setExtraSaved] = useState(0);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; balance: string; apr: string; payment: string }>>({});

  async function refresh() {
    setBusy(true); setMsg(null);
    try {
      const [d, s] = await Promise.all([api<{ debts: Debt[] }>("/api/debts"), api<{ extraMonthly: number }>("/api/debts/settings")]);
      setDebts(d.debts); setExtraSaved(Number(s.extraMonthly || 0)); setExtra(String(Number(s.extraMonthly || 0).toFixed(2)));
      const nd: typeof drafts = {};
      for (const row of d.debts) nd[row.id] = { name: row.name, balance: String(row.balance), apr: String(row.apr), payment: String(row.payment) };
      setDrafts(nd);
    } catch (err: any) { setMsg(err?.message || "Error loading."); } finally { setBusy(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function saveExtra() {
    const n = parseNum(extra);
    if (Number.isNaN(n) || n < 0) { setMsg("Must be ≥ 0"); return; }
    setBusy(true); setMsg(null);
    try { await api("/api/debts/settings", { method: "POST", body: JSON.stringify({ extraMonthly: n }) }); setExtraSaved(n); setMsg("Saved ✅"); }
    catch (err: any) { setMsg(err?.message || "Error."); } finally { setBusy(false); }
  }

  async function addDebt() {
    setBusy(true); setMsg(null);
    try { await api("/api/debts", { method: "POST", body: JSON.stringify({ name: "New Debt", balance: 0, apr: 0, payment: 0 }) }); await refresh(); }
    catch (err: any) { setMsg(err?.message || "Error."); } finally { setBusy(false); }
  }

  async function removeDebt(id: string) {
    if (!window.confirm("Delete this debt?")) return;
    setBusy(true); setMsg(null);
    try { await api(`/api/debts/${id}`, { method: "DELETE" }); await refresh(); }
    catch (err: any) { setMsg(err?.message || "Error."); } finally { setBusy(false); }
  }

  async function saveDebt(id: string) {
    const d = drafts[id]; if (!d) return;
    const name = (d.name || "").trim(); const balance = parseNum(d.balance); const apr = parseNum(d.apr); const payment = parseNum(d.payment);
    if (!name || Number.isNaN(balance) || Number.isNaN(apr) || Number.isNaN(payment)) { setMsg("Fix the values before saving."); return; }
    setBusy(true); setMsg(null);
    try { await api(`/api/debts/${id}`, { method: "PATCH", body: JSON.stringify({ name, balance, apr, payment }) }); setMsg("Saved ✅"); await refresh(); }
    catch (err: any) { setMsg(err?.message || "Error."); } finally { setBusy(false); }
  }

  const extraPerMonth = useMemo(() => { const n = parseNum(extra); return Number.isFinite(n) ? Math.max(0, n) : 0; }, [extra]);

  const calc = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    const usable = debts.filter((d) => Number.isFinite(d.balance) && Number.isFinite(d.apr) && Number.isFinite(d.payment));
    const base = simulateSnowball(usable, 0, start);
    const withExtra = simulateSnowball(usable, extraPerMonth, start);
    const baseMonths = usable.map((d) => base.get(d.id)?.months).filter((m): m is number => typeof m === "number");
    const extraMonths = usable.map((d) => withExtra.get(d.id)?.months).filter((m): m is number => typeof m === "number");
    const baseMax = baseMonths.length === usable.length ? Math.max(...baseMonths) : null;
    const extraMax = extraMonths.length === usable.length ? Math.max(...extraMonths) : null;
    const baseInterest = usable.map((d) => base.get(d.id)?.totalInterest).filter((x): x is number => typeof x === "number").reduce((a, b) => a + b, 0);
    const extraInterest = usable.map((d) => withExtra.get(d.id)?.totalInterest).filter((x): x is number => typeof x === "number").reduce((a, b) => a + b, 0);
    return { base, withExtra, baseMax, extraMax, baseInterest, extraInterest };
  }, [debts, extraPerMonth]);

  return (
    <div className="space-y-5">

      {/* Header + extra payment */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Debt Snowball</div>
            <div className="text-xs text-slate-400 mt-0.5">Extra payment goes to lowest balance first</div>
          </div>
          <div className="flex gap-2 items-end">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Extra monthly</span>
              <input className="h-11 w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </label>
            <button type="button" onClick={saveExtra} disabled={busy}
              className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all">
              Save
            </button>
          </div>
        </div>
        {msg && <div className="mt-3 text-sm text-slate-600">{msg}</div>}
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Baseline (min payments)</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total interest</span><span className="font-mono font-semibold text-rose-600">{money(calc.baseInterest)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Payoff in</span><span className="font-mono font-semibold text-slate-900">{calc.baseMax ? `${calc.baseMax} mo` : "—"}</span></div>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-3">With +{money(extraSaved)}/mo extra</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-emerald-800/70">Total interest</span><span className="font-mono font-semibold text-emerald-800">{money(calc.extraInterest)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-800/70">Payoff in</span><span className="font-mono font-semibold text-emerald-800">{calc.extraMax ? `${calc.extraMax} mo` : "—"}</span></div>
          </div>
          {calc.baseMax && calc.extraMax && calc.baseMax > calc.extraMax && (
            <div className="mt-3 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-lg px-2.5 py-1.5">
              💰 Save {calc.baseMax - calc.extraMax} months & {money(calc.baseInterest - calc.extraInterest)} interest
            </div>
          )}
        </div>
      </div>

      {/* Debt rows */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Your Debts</div>
          <button type="button" onClick={addDebt} disabled={busy}
            className="h-8 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-all">
            + Add Debt
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {debts.length === 0 && <div className="px-5 py-8 text-sm text-slate-400">No debts. Add one to start planning.</div>}
          {debts.map((row) => {
            const d = drafts[row.id] || { name: row.name, balance: String(row.balance), apr: String(row.apr), payment: String(row.payment) };
            const base = calc.base.get(row.id);
            const ext = calc.withExtra.get(row.id);
            const setD = (patch: Partial<typeof d>) => setDrafts((prev) => ({ ...prev, [row.id]: { ...d, ...patch } }));

            return (
              <div key={row.id} className="p-4 md:p-5">
                <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_0.6fr_1fr_auto]">
                  <input className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    value={d.name} onChange={(e) => setD({ name: e.target.value })} placeholder="Debt name" />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={d.balance} onChange={(e) => setD({ balance: e.target.value })} placeholder="Balance" inputMode="decimal" />
                  </div>
                  <div className="relative">
                    <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-7 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={d.apr} onChange={(e) => setD({ apr: e.target.value })} placeholder="APR" inputMode="decimal" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={d.payment} onChange={(e) => setD({ payment: e.target.value })} placeholder="Payment" inputMode="decimal" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => saveDebt(row.id)}
                      className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all">
                      Save
                    </button>
                    <button type="button" disabled={busy} onClick={() => removeDebt(row.id)}
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-60 transition-all">
                      ✕
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-slate-400 mb-2">Baseline</div>
                    {base?.warning ? <div className="text-xs text-rose-600">{base.warning}</div> : (
                      <div className="space-y-1">
                        {[["Interest", money(base?.totalInterest ?? 0)], ["Months", base?.months ?? "—"], ["Payoff", base?.payoffDate ?? "—"]].map(([l, v]) => (
                          <div key={String(l)} className="flex justify-between"><span className="text-slate-500">{l}</span><span className="font-mono font-medium text-slate-900">{String(v)}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm">
                    <div className="text-xs font-semibold text-emerald-700 mb-2">With Extra</div>
                    {ext?.warning ? <div className="text-xs text-rose-600">{ext.warning}</div> : (
                      <div className="space-y-1">
                        {[["Interest", money(ext?.totalInterest ?? 0)], ["Months", ext?.months ?? "—"], ["Payoff", ext?.payoffDate ?? "—"]].map(([l, v]) => (
                          <div key={String(l)} className="flex justify-between"><span className="text-emerald-800/70">{l}</span><span className="font-mono font-medium text-emerald-900">{String(v)}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">Monthly compounding (APR÷12). Great for planning and comparison.</div>
      </div>
    </div>
  );
}