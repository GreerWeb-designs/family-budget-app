import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Trash2, CreditCard, TrendingDown } from "lucide-react";
import { api } from "../lib/api";
import { cn, money } from "../lib/utils";

type Debt     = { id: string; name: string; balance: number; apr: number; payment: number; paymentsRemaining: number; created_at: string; updated_at: string };
type DebtApiRow = { id: string; name: string; balance: number; apr: number; payment: number; payments_remaining?: number; created_at: string; updated_at: string };
type DraftDebt  = { name: string; balance: string; apr: string; payment: string; paymentsRemaining: string };
type Method     = "snowball" | "avalanche";
type SimResult  = { months: number | null; totalInterest: number; payoffDate: string | null; warning?: string };
type SimOutput  = { perDebt: Map<string, SimResult>; totalMonths: number | null; totalInterest: number };

function parseNum(s: string) {
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function addMonths(d: Date, months: number) {
  const c = new Date(d); const day = c.getDate();
  c.setMonth(c.getMonth() + months);
  if (c.getDate() !== day) c.setDate(0);
  return c;
}
function fmtDate(d: Date) { return d.toLocaleDateString(undefined, { year: "numeric", month: "short" }); }

function simulatePayoff(debts: { id: string; balance: number; apr: number; payment: number }[], extraPerMonth: number, method: Method): SimOutput {
  if (debts.length === 0) return { perDebt: new Map(), totalMonths: null, totalInterest: 0 };
  const priorityIds = [...debts].sort((a, b) => method === "snowball" ? a.balance - b.balance : b.apr - a.apr).map((d) => d.id);
  const state = debts.map((d) => ({ id: d.id, balance: Math.max(0, Number(d.balance)), minPayment: Math.max(0, Number(d.payment)), apr: Number(d.apr), totalInterest: 0, paidOffMonth: null as number | null }));
  for (const d of state) { if (d.balance <= 0.001) { d.balance = 0; d.paidOffMonth = 0; } }
  let snowball = Math.max(0, extraPerMonth);
  const MAX_MONTHS = 1200;
  for (let month = 1; month <= MAX_MONTHS; month++) {
    const active = state.filter((d) => d.balance > 0.001);
    if (active.length === 0) break;
    for (const d of active) { const interest = d.balance * (d.apr / 100 / 12); d.totalInterest += interest; d.balance += interest; }
    for (const d of active) {
      const pay = Math.min(d.minPayment, d.balance);
      d.balance = Math.max(0, d.balance - pay);
      if (d.balance <= 0.001 && d.paidOffMonth === null) { d.balance = 0; d.paidOffMonth = month; snowball += d.minPayment; }
    }
    const activeByPriority = state.filter((d) => d.balance > 0.001).sort((a, b) => priorityIds.indexOf(a.id) - priorityIds.indexOf(b.id));
    if (activeByPriority.length > 0 && snowball > 0.001) {
      const target = activeByPriority[0];
      const pay = Math.min(snowball, target.balance);
      target.balance = Math.max(0, target.balance - pay);
      if (target.balance <= 0.001 && target.paidOffMonth === null) { target.balance = 0; target.paidOffMonth = month; snowball += target.minPayment; }
    }
  }
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const perDebt = new Map<string, SimResult>();
  for (const d of state) {
    if (d.paidOffMonth === null) perDebt.set(d.id, { months: null, totalInterest: d.totalInterest, payoffDate: null, warning: "Payment too low to pay off." });
    else if (d.paidOffMonth === 0) perDebt.set(d.id, { months: 0, totalInterest: 0, payoffDate: fmtDate(now) });
    else perDebt.set(d.id, { months: d.paidOffMonth, totalInterest: d.totalInterest, payoffDate: fmtDate(addMonths(now, d.paidOffMonth)) });
  }
  const allMonths = state.map((d) => d.paidOffMonth).filter((m): m is number => m !== null);
  return { perDebt, totalMonths: allMonths.length === state.length ? Math.max(0, ...allMonths) : null, totalInterest: state.reduce((s, d) => s + d.totalInterest, 0) };
}

const BAR_COLORS = ["#0F766E","#14B8A6","#F59E0B","#6366F1","#EC4899","#06B6D4","#84CC16","#F97316"];
const inputCls = "h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

export default function Debts() {
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);
  const [debts, setDebts]       = useState<Debt[]>([]);
  const [drafts, setDrafts]     = useState<Record<string, DraftDebt>>({});
  const [extra, setExtra]       = useState("0");
  const [extraSaved, setExtraSaved] = useState(0);
  const [method, setMethod]     = useState<Method>("snowball");
  const [savingMethod, setSavingMethod] = useState(false);

  async function refresh() {
    setBusy(true); setMsg(null);
    try {
      const [d, s] = await Promise.all([
        api<{ debts: DebtApiRow[] }>("/api/debts"),
        api<{ extraMonthly: number; method?: string }>("/api/debts/settings"),
      ]);
      const mapped: Debt[] = d.debts.map((row) => ({
        id: row.id, name: row.name, balance: row.balance, apr: row.apr,
        payment: row.payment, paymentsRemaining: Number(row.payments_remaining ?? 0),
        created_at: row.created_at, updated_at: row.updated_at,
      }));
      setDebts(mapped);
      setExtraSaved(Number(s.extraMonthly || 0));
      setExtra(String(Number(s.extraMonthly || 0).toFixed(2)));
      setMethod((s.method === "avalanche" ? "avalanche" : "snowball") as Method);
      const nd: Record<string, DraftDebt> = {};
      for (const row of mapped) nd[row.id] = { name: row.name, balance: String(row.balance), apr: String(row.apr), payment: String(row.payment), paymentsRemaining: String(row.paymentsRemaining) };
      setDrafts(nd);
    } catch (err: any) { setMsg(err?.message || "Error loading."); }
    finally { setBusy(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function saveExtra() {
    const n = parseNum(extra);
    if (Number.isNaN(n) || n < 0) { setMsg("Must be ≥ 0"); return; }
    setBusy(true); setMsg(null);
    try {
      await api("/api/debts/settings", { method: "POST", body: JSON.stringify({ extraMonthly: n }) });
      setExtraSaved(n); setMsg("Saved.");
    } catch (err: any) { setMsg(err?.message || "Error."); }
    finally { setBusy(false); }
  }

  async function saveMethod(m: Method) {
    setMethod(m); setSavingMethod(true);
    try { await api("/api/debts/settings", { method: "POST", body: JSON.stringify({ method: m }) }); }
    catch { /* silent */ }
    finally { setSavingMethod(false); }
  }

  async function addDebt() {
    setBusy(true); setMsg(null);
    try {
      await api("/api/debts", { method: "POST", body: JSON.stringify({ name: "New Debt", balance: 0, apr: 0, payment: 0, paymentsRemaining: 0 }) });
      await refresh();
    } catch (err: any) { setMsg(err?.message || "Error."); }
    finally { setBusy(false); }
  }

  async function removeDebt(id: string) {
    if (!window.confirm("Delete this debt?")) return;
    setBusy(true); setMsg(null);
    try { await api(`/api/debts/${id}`, { method: "DELETE" }); await refresh(); }
    catch (err: any) { setMsg(err?.message || "Error."); }
    finally { setBusy(false); }
  }

  async function saveDebt(id: string) {
    const d = drafts[id]; if (!d) return;
    const name = (d.name || "").trim();
    const balance = parseNum(d.balance), apr = parseNum(d.apr), payment = parseNum(d.payment);
    const paymentsRemaining = Number(d.paymentsRemaining) || 0;
    if (!name || Number.isNaN(balance) || Number.isNaN(apr) || Number.isNaN(payment)) { setMsg("Fix the values before saving."); return; }
    setBusy(true); setMsg(null);
    try {
      await api(`/api/debts/${id}`, { method: "PATCH", body: JSON.stringify({ name, balance, apr, payment, paymentsRemaining }) });
      setMsg("Saved."); await refresh();
    } catch (err: any) { setMsg(err?.message || "Error."); }
    finally { setBusy(false); }
  }

  function setDraft(id: string, patch: Partial<DraftDebt>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const sortedDebts = useMemo(() =>
    [...debts].sort((a, b) => method === "snowball" ? a.balance - b.balance : b.apr - a.apr), [debts, method]);

  const { baseline, withStrategy } = useMemo(() => {
    const usable = debts.filter((d) => Number.isFinite(d.balance) && Number.isFinite(d.apr) && Number.isFinite(d.payment));
    return { baseline: simulatePayoff(usable, 0, method), withStrategy: simulatePayoff(usable, extraSaved, method) };
  }, [debts, extraSaved, method]);

  const totalBalance    = debts.reduce((s, d) => s + Number(d.balance), 0);
  const totalMinPayment = debts.reduce((s, d) => s + Number(d.payment), 0);
  const maxTimelineMonths = Math.max(baseline.totalMonths ?? 0, withStrategy.totalMonths ?? 0, 1);

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Total Debt</div>
          <div className="font-display text-2xl font-semibold text-red-600 tabular-nums">{money(totalBalance)}</div>
          <div className="text-xs text-stone-400 mt-0.5">{debts.length} debt{debts.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Min / Month</div>
          <div className="font-display text-2xl font-semibold text-stone-900 tabular-nums">{money(totalMinPayment)}</div>
          <div className="text-xs text-stone-400 mt-0.5">combined minimums</div>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Extra / Month</div>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">$</span>
              <input className="h-9 w-full rounded-xl border border-stone-200 bg-stone-50 pl-6 pr-2 text-sm tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all"
                value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </div>
            <button type="button" onClick={saveExtra} disabled={busy}
              className="h-9 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: "var(--color-primary)" }}>
              Save
            </button>
          </div>
          {msg && <div className="mt-1.5 text-xs text-stone-500">{msg}</div>}
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Strategy</div>
          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1 w-full">
            {(["snowball", "avalanche"] as Method[]).map((m) => (
              <button key={m} type="button" onClick={() => saveMethod(m)} disabled={savingMethod}
                className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all capitalize",
                  method === m ? "text-white shadow-sm" : "text-stone-600 hover:text-stone-900")}
                style={method === m ? { background: m === "snowball" ? "#0F766E" : "#6366F1" } : {}}>
                {m}
              </button>
            ))}
          </div>
          <div className="text-xs text-stone-400 mt-1.5">
            {method === "snowball" ? "Lowest balance first" : "Highest interest first"}
          </div>
        </div>
      </div>

      {/* Debt list */}
      <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-stone-400" />
              <div className="text-sm font-semibold text-stone-900">Your Debts</div>
            </div>
            <div className="text-xs text-stone-400 mt-0.5">
              Sorted by {method === "snowball" ? "balance (lowest first)" : "interest rate (highest first)"}
            </div>
          </div>
          <button type="button" onClick={addDebt} disabled={busy}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: "var(--color-primary)" }}>
            <PlusCircle size={12} />
            Add Debt
          </button>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {sortedDebts.length === 0 && (
            <div className="px-5 py-12 text-center">
              <CreditCard size={28} className="mx-auto text-stone-200 mb-2" />
              <div className="text-sm text-stone-400">No debts tracked yet.</div>
              <div className="text-xs text-stone-300 mt-0.5">Add one to start your payoff plan.</div>
            </div>
          )}

          {sortedDebts.map((row, i) => {
            const d = drafts[row.id] ?? { name: row.name, balance: String(row.balance), apr: String(row.apr), payment: String(row.payment), paymentsRemaining: String(row.paymentsRemaining) };
            const base  = baseline.perDebt.get(row.id);
            const strat = withStrategy.perDebt.get(row.id);
            const accentColor = BAR_COLORS[i % BAR_COLORS.length];

            return (
              <div key={row.id} className="p-5">
                {/* Name row */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: accentColor }}>
                    {i + 1}
                  </div>
                  <input className="flex-1 h-10 min-w-0 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all"
                    value={d.name} onChange={(e) => setDraft(row.id, { name: e.target.value })} placeholder="Debt name" />
                  <div className="flex gap-2 shrink-0">
                    <button type="button" disabled={busy} onClick={() => saveDebt(row.id)}
                      className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 transition-all"
                      style={{ background: "var(--color-primary)" }}>
                      Save
                    </button>
                    <button type="button" disabled={busy} onClick={() => removeDebt(row.id)}
                      className="h-10 rounded-xl border border-stone-200 px-2.5 text-stone-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-60 transition-all">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Fields */}
                <div className="grid gap-3 sm:grid-cols-4 mb-4">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Balance</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">$</span>
                      <input className={inputCls + " pl-7"} value={d.balance} onChange={(e) => setDraft(row.id, { balance: e.target.value })} inputMode="decimal" placeholder="0.00" />
                    </div>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Min Payment</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">$</span>
                      <input className={inputCls + " pl-7"} value={d.payment} onChange={(e) => setDraft(row.id, { payment: e.target.value })} inputMode="decimal" placeholder="0.00" />
                    </div>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">APR %</span>
                    <div className="relative">
                      <input className={inputCls + " pr-7"} value={d.apr} onChange={(e) => setDraft(row.id, { apr: e.target.value })} inputMode="decimal" placeholder="0.0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none">%</span>
                    </div>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Payments Left</span>
                    <input className={inputCls} value={d.paymentsRemaining} onChange={(e) => setDraft(row.id, { paymentsRemaining: e.target.value })} inputMode="numeric" placeholder="0" />
                  </label>
                </div>

                {/* Mini sim results */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                    <div className="text-xs font-semibold text-stone-500 mb-2">Minimum only</div>
                    {base?.warning ? <div className="text-xs text-red-500">{base.warning}</div> : (
                      <div className="space-y-1">
                        {([["Payoff", base?.payoffDate ?? "—"], ["Months", String(base?.months ?? "—")], ["Interest", money(base?.totalInterest ?? 0)]] as [string, string][]).map(([lbl, val]) => (
                          <div key={lbl} className="flex justify-between text-xs">
                            <span className="text-stone-400">{lbl}</span>
                            <span className={cn("font-semibold tabular-nums", lbl === "Interest" ? "text-red-500" : "text-stone-900")}>{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border p-3" style={{ borderColor: "rgba(20,184,166,0.25)", background: "rgba(20,184,166,0.04)" }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-primary)" }}>
                      With {method === "snowball" ? "Snowball" : "Avalanche"}
                    </div>
                    {strat?.warning ? <div className="text-xs text-red-500">{strat.warning}</div> : (
                      <>
                        <div className="space-y-1">
                          {([["Payoff", strat?.payoffDate ?? "—"], ["Months", String(strat?.months ?? "—")], ["Interest", money(strat?.totalInterest ?? 0)]] as [string, string][]).map(([lbl, val]) => (
                            <div key={lbl} className="flex justify-between text-xs">
                              <span className="text-stone-400">{lbl}</span>
                              <span className={cn("font-semibold tabular-nums", lbl === "Interest" ? "text-teal-700" : "text-stone-900")}>{val}</span>
                            </div>
                          ))}
                        </div>
                        {base?.months != null && strat?.months != null && base.months > strat.months && (
                          <div className="mt-2 pt-2 border-t border-teal-100 text-xs font-semibold text-teal-700">
                            {base.months - strat.months} mo sooner · saves {money((base.totalInterest ?? 0) - (strat.totalInterest ?? 0))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      {sortedDebts.length > 0 && (
        <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={15} className="text-stone-400" />
            <div className="text-sm font-semibold text-stone-900">Payoff Timeline</div>
          </div>
          <div className="text-xs text-stone-400 mb-5">
            {method === "snowball" ? "Snowball" : "Avalanche"} strategy with ${extraSaved}/mo extra
          </div>

          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            {[
              { label: "Baseline (min only)", months: baseline.totalMonths, color: "text-stone-900", bg: "bg-stone-50", border: "border-stone-100" },
              { label: `With ${method === "snowball" ? "Snowball" : "Avalanche"}`, months: withStrategy.totalMonths, color: "text-teal-700", bg: "bg-teal-50/50", border: "border-teal-100" },
            ].map(({ label, months, color, bg, border }) => (
              <div key={label} className={cn("rounded-xl border p-3", bg, border)}>
                <div className="text-xs text-stone-400 mb-1">{label}</div>
                <div className={cn("text-sm font-semibold tabular-nums", color)}>
                  {months ? `${months} months` : "—"}
                </div>
                {months ? <div className="text-xs text-stone-400 mt-0.5">{fmtDate(addMonths(new Date(), months))}</div> : null}
              </div>
            ))}
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
              <div className="text-xs text-stone-400 mb-1">You save</div>
              {baseline.totalMonths && withStrategy.totalMonths && baseline.totalMonths > withStrategy.totalMonths ? (
                <>
                  <div className="text-sm font-semibold text-teal-700 tabular-nums">{baseline.totalMonths - withStrategy.totalMonths} months</div>
                  <div className="text-xs text-teal-600 mt-0.5">{money(baseline.totalInterest - withStrategy.totalInterest)} interest</div>
                </>
              ) : (
                <div className="text-xs text-stone-400 mt-1">Add extra payment to see savings</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {sortedDebts.map((d, i) => {
              const stratMonths = withStrategy.perDebt.get(d.id)?.months ?? null;
              const pct = stratMonths ? Math.min(100, (stratMonths / maxTimelineMonths) * 100) : 100;
              return (
                <div key={d.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-stone-600 font-medium truncate max-w-[55%]">{d.name}</span>
                    <span className="text-stone-400 tabular-nums shrink-0 ml-2">
                      {stratMonths ? `${stratMonths} mo · ${fmtDate(addMonths(new Date(), stratMonths))}` : "—"}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
            {baseline.totalMonths && withStrategy.totalMonths && baseline.totalMonths > withStrategy.totalMonths && (
              <div className="pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-stone-400 italic">Baseline (no extra)</span>
                  <span className="text-stone-400 tabular-nums">{baseline.totalMonths} mo · {fmtDate(addMonths(new Date(), baseline.totalMonths))}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full bg-stone-300" style={{ width: `${Math.min(100, (baseline.totalMonths / maxTimelineMonths) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 text-xs text-stone-300">Monthly compounding · freed minimums roll into the next debt when one is paid off.</div>
        </div>
      )}
    </div>
  );
}
