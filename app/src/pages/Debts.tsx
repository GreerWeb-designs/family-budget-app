import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Trash2, CreditCard, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../lib/api";
import { cn, money } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { canAccess } from "../lib/permissions";

/* ── Types ──────────────────────────────────────────────── */
type Debt = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  payment: number;
  paymentsRemaining: number;
  debtType: string;
  principalAndInterest: number | null;
  includesEscrow: boolean;
  escrowAmount: number | null;
  created_at: string;
  updated_at: string;
};
type DebtApiRow = {
  id: string; name: string; balance: number; apr: number; payment: number;
  payments_remaining?: number; debt_type?: string;
  principal_and_interest?: number | null; includes_escrow?: number; escrow_amount?: number | null;
  created_at: string; updated_at: string;
};
type DraftDebt = {
  name: string; balance: string; apr: string; payment: string;
  paymentsRemaining: string; debtType: string;
  principalAndInterest: string; includesEscrow: boolean; escrowAmount: string;
};
type Method    = "snowball" | "avalanche";
type SimResult = { months: number | null; totalInterest: number; payoffDate: string | null; warning?: string };
type SimOutput = { perDebt: Map<string, SimResult>; totalMonths: number | null; totalInterest: number };
type SimDebt   = { id: string; balance: number; apr: number; minPayment: number; debtType: string };

/* ── Constants ──────────────────────────────────────────── */
const DEBT_TYPES = [
  { value: "mortgage",    label: "Mortgage",      icon: "🏠" },
  { value: "auto",        label: "Auto loan",     icon: "🚗" },
  { value: "credit_card", label: "Credit card",   icon: "💳" },
  { value: "student_loan",label: "Student loan",  icon: "🎓" },
  { value: "personal",    label: "Personal loan", icon: "👤" },
  { value: "medical",     label: "Medical",       icon: "🏥" },
  { value: "other",       label: "Other",         icon: "📋" },
];

const DEBT_TYPE_ICON: Record<string, string> = Object.fromEntries(DEBT_TYPES.map((t) => [t.value, t.icon]));
const BAR_COLORS = ["#1B4243","#2D6E70","#C17A3F","#6B7A85","#A3632F","#245759","#6FA3A5","#D99A66"];
const inputCls = "h-10 w-full rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

/* ── Helpers ────────────────────────────────────────────── */
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

/** Return the payment portion that actually reduces the balance (P&I for mortgage, full payment otherwise). */
function getSimPayment(debt: Debt): number {
  if (debt.debtType === "mortgage") {
    // Escrow-aware: use explicit P&I if provided
    if (debt.includesEscrow && debt.principalAndInterest && debt.principalAndInterest > 0) {
      return debt.principalAndInterest;
    }
    // Calculate P&I from amortization if we have the data
    if (debt.apr > 0 && debt.paymentsRemaining > 0 && debt.balance > 0) {
      const r = debt.apr / 100 / 12;
      const n = debt.paymentsRemaining;
      const pi = debt.balance * (r / (1 - Math.pow(1 + r, -n)));
      if (isFinite(pi) && pi > 0) return pi;
    }
  }
  return debt.payment;
}

/* ── Simulation engine ──────────────────────────────────── */
function simulatePayoff(debts: SimDebt[], extraPerMonth: number, method: Method): SimOutput {
  if (debts.length === 0) return { perDebt: new Map(), totalMonths: null, totalInterest: 0 };

  // Warn where minimum doesn't cover interest
  const warnings = new Map<string, string>();
  for (const d of debts) {
    if (d.balance > 0 && d.apr > 0) {
      const monthlyInterest = d.balance * (d.apr / 100 / 12);
      if (d.minPayment <= monthlyInterest) {
        warnings.set(d.id, `Payment ($${d.minPayment.toFixed(2)}) doesn't cover interest ($${monthlyInterest.toFixed(2)}). Balance will grow.`);
      }
    }
  }

  // Priority order for target debt
  const priorityOrder = [...debts]
    .sort((a, b) => method === "snowball" ? a.balance - b.balance : b.apr - a.apr)
    .map((d) => d.id);

  // Working state
  const state = debts.map((d) => ({
    id: d.id,
    balance: Math.max(0, d.balance),
    monthlyRate: d.apr / 100 / 12,
    minPayment: Math.max(0, d.minPayment),
    totalInterest: 0,
    paidOffMonth: d.balance <= 0.01 ? (0 as number | null) : null,
  }));

  // Snowball pool = extra/month + freed minimums from paid-off debts
  let snowballPool = Math.max(0, extraPerMonth);
  const MAX_MONTHS = 600;

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const active = state.filter((d) => d.balance > 0.005);
    if (active.length === 0) break;

    // 1. Accrue interest on all active
    for (const d of active) {
      const interest = d.balance * d.monthlyRate;
      d.totalInterest += interest;
      d.balance += interest;
    }

    // 2. Apply minimum payments to all active
    for (const d of active) {
      const pay = Math.min(d.minPayment, d.balance);
      d.balance = Math.max(0, d.balance - pay);
      if (d.balance <= 0.005 && d.paidOffMonth === null) {
        d.balance = 0;
        d.paidOffMonth = month;
        snowballPool += d.minPayment; // freed minimum rolls into pool
      }
    }

    // 3. Apply snowball pool to highest-priority remaining debt
    const targets = state
      .filter((d) => d.balance > 0.005)
      .sort((a, b) => priorityOrder.indexOf(a.id) - priorityOrder.indexOf(b.id));

    if (targets.length > 0 && snowballPool > 0.005) {
      const target = targets[0];
      const pay = Math.min(snowballPool, target.balance);
      target.balance = Math.max(0, target.balance - pay);
      if (target.balance <= 0.005 && target.paidOffMonth === null) {
        target.balance = 0;
        target.paidOffMonth = month;
        snowballPool += target.minPayment;
      }
    }
  }

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const perDebt = new Map<string, SimResult>();
  for (const d of state) {
    const warning = warnings.get(d.id);
    if (d.paidOffMonth === null) {
      perDebt.set(d.id, { months: null, totalInterest: d.totalInterest, payoffDate: null, warning: warning || "Payment too low — could not determine payoff." });
    } else if (d.paidOffMonth === 0) {
      perDebt.set(d.id, { months: 0, totalInterest: 0, payoffDate: fmtDate(now) });
    } else {
      perDebt.set(d.id, { months: d.paidOffMonth, totalInterest: d.totalInterest, payoffDate: fmtDate(addMonths(now, d.paidOffMonth)), warning });
    }
  }

  const allPaidMonths = state.map((d) => d.paidOffMonth).filter((m): m is number => m !== null);
  return {
    perDebt,
    totalMonths: allPaidMonths.length === state.length ? Math.max(0, ...allPaidMonths) : null,
    totalInterest: state.reduce((s, d) => s + d.totalInterest, 0),
  };
}

/* ── Debt type pill selector ─────────────────────────────── */
function DebtTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
      {DEBT_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all shrink-0",
            value === t.value
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-cream-100 text-ink-500 hover:bg-cream-200"
          )}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════ */
export default function Debts() {
  const { user } = useUser();
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);
  const [debts, setDebts]       = useState<Debt[]>([]);
  const [drafts, setDrafts]     = useState<Record<string, DraftDebt>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
        debtType: row.debt_type || "other",
        principalAndInterest: row.principal_and_interest ?? null,
        includesEscrow: !!(row.includes_escrow),
        escrowAmount: row.escrow_amount ?? null,
        created_at: row.created_at, updated_at: row.updated_at,
      }));
      setDebts(mapped);
      setExtraSaved(Number(s.extraMonthly || 0));
      setExtra(String(Number(s.extraMonthly || 0).toFixed(2)));
      setMethod((s.method === "avalanche" ? "avalanche" : "snowball") as Method);
      const nd: Record<string, DraftDebt> = {};
      for (const row of mapped) {
        nd[row.id] = {
          name: row.name,
          balance: String(row.balance),
          apr: String(row.apr),
          payment: String(row.payment),
          paymentsRemaining: String(row.paymentsRemaining),
          debtType: row.debtType,
          principalAndInterest: row.principalAndInterest != null ? String(row.principalAndInterest) : "",
          includesEscrow: row.includesEscrow,
          escrowAmount: row.escrowAmount != null ? String(row.escrowAmount) : "",
        };
      }
      setDrafts(nd);
    } catch (err: any) { setMsg(err?.message || "Error loading."); }
    finally { setBusy(false); }
  }

  if (!canAccess(user, "can_see_debts")) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-sm font-medium text-ink-900 mb-1">Debts is restricted</p>
        <p className="text-xs text-ink-500">Ask your household admin to grant access.</p>
      </div>
    );
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
      const res = await api<{ ok: boolean; id: string }>("/api/debts", {
        method: "POST",
        body: JSON.stringify({ name: "New Debt", balance: 0, apr: 0, payment: 0, paymentsRemaining: 0, debtType: "other" }),
      });
      await refresh();
      // Auto-expand the new debt
      if (res.id) setExpanded((prev) => ({ ...prev, [res.id]: true }));
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
    const principalAndInterest = d.principalAndInterest.trim() ? parseNum(d.principalAndInterest) : null;
    const escrowAmount = d.escrowAmount.trim() ? parseNum(d.escrowAmount) : null;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/debts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name, balance, apr, payment, paymentsRemaining,
          debtType: d.debtType,
          principalAndInterest: principalAndInterest != null && !Number.isNaN(principalAndInterest) ? principalAndInterest : null,
          includesEscrow: d.includesEscrow,
          escrowAmount: escrowAmount != null && !Number.isNaN(escrowAmount) ? escrowAmount : null,
        }),
      });
      setMsg("Saved."); await refresh();
    } catch (err: any) { setMsg(err?.message || "Error."); }
    finally { setBusy(false); }
  }

  function setDraft(id: string, patch: Partial<DraftDebt>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const sortedDebts = useMemo(() =>
    [...debts].sort((a, b) => method === "snowball" ? a.balance - b.balance : b.apr - a.apr),
    [debts, method]);

  const { baseline, withStrategy } = useMemo(() => {
    const usable = debts.filter((d) => Number.isFinite(d.balance) && Number.isFinite(d.apr) && Number.isFinite(d.payment));
    const toSimDebt = (d: Debt): SimDebt => ({
      id: d.id, balance: d.balance, apr: d.apr,
      minPayment: getSimPayment(d),
      debtType: d.debtType,
    });
    return {
      baseline: simulatePayoff(usable.map(toSimDebt), 0, method),
      withStrategy: simulatePayoff(usable.map(toSimDebt), extraSaved, method),
    };
  }, [debts, extraSaved, method]);

  const totalBalance    = debts.reduce((s, d) => s + Number(d.balance), 0);
  const totalMinPayment = debts.reduce((s, d) => s + Number(d.payment), 0);
  const maxTimelineMonths = Math.max(baseline.totalMonths ?? 0, withStrategy.totalMonths ?? 0, 1);

  return (
    <div className="space-y-5">

      {/* ── Stat cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Total debt</div>
          <div className="font-display text-2xl font-semibold text-rust-600 tabular-nums">{money(totalBalance)}</div>
          <div className="text-xs text-ink-500 mt-0.5">{debts.length} debt{debts.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Min / Month</div>
          <div className="font-display text-2xl font-semibold text-ink-900 tabular-nums">{money(totalMinPayment)}</div>
          <div className="text-xs text-ink-500 mt-0.5">combined minimums</div>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Extra / Month</div>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm pointer-events-none">$</span>
              <input className="h-9 w-full rounded-xl border border-cream-200 bg-cream-50 pl-6 pr-2 text-sm tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all"
                value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </div>
            <button type="button" onClick={saveExtra} disabled={busy}
              className="h-9 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: "var(--color-primary)" }}>
              Save
            </button>
          </div>
          {msg && <div className="mt-1.5 text-xs text-ink-500">{msg}</div>}
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Strategy</div>
          <div className="inline-flex rounded-xl border border-cream-200 bg-cream-50 p-1 w-full">
            {(["snowball", "avalanche"] as Method[]).map((m) => (
              <button key={m} type="button" onClick={() => saveMethod(m)} disabled={savingMethod}
                className={cn("flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all capitalize",
                  method === m ? "text-white shadow-sm" : "text-ink-500 hover:text-ink-900")}
                style={method === m ? { background: m === "snowball" ? "#1B4243" : "#C17A3F", color: m === "avalanche" ? "#1B4243" : undefined } : {}}>
                {m}
              </button>
            ))}
          </div>
          <div className="text-xs text-ink-500 mt-1.5">
            {method === "snowball" ? "Snowball: lowest balance first" : "Avalanche: highest rate first"}
          </div>
        </div>
      </div>

      {/* ── Debt list ──────────────────────────────── */}
      <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-ink-500" />
              <div className="text-sm font-semibold text-ink-900">Your debts</div>
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              Sorted by {method === "snowball" ? "balance (lowest first)" : "interest rate (highest first)"}
            </div>
          </div>
          <button type="button" onClick={addDebt} disabled={busy}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: "#1B4243" }}>
            <PlusCircle size={12} />
            Add a debt
          </button>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {sortedDebts.length === 0 && (
            <div className="px-5 py-12 text-center">
              <CreditCard size={28} className="mx-auto text-cream-200 mb-2" />
              <div className="text-sm text-ink-500">No debts tracked yet.</div>
              <div className="text-xs text-cream-200 mt-0.5">Add one to start your payoff plan.</div>
            </div>
          )}

          {sortedDebts.map((row, i) => {
            const d = drafts[row.id] ?? {
              name: row.name, balance: String(row.balance), apr: String(row.apr),
              payment: String(row.payment), paymentsRemaining: String(row.paymentsRemaining),
              debtType: row.debtType, principalAndInterest: "", includesEscrow: false, escrowAmount: "",
            };
            const base  = baseline.perDebt.get(row.id);
            const strat = withStrategy.perDebt.get(row.id);
            const accentColor = BAR_COLORS[i % BAR_COLORS.length];
            const isOpen = expanded[row.id] ?? false;
            const isMortgage = d.debtType === "mortgage";
            const simPmt = getSimPayment(row);

            return (
              <div key={row.id}>
                {/* ── Collapsed header ── */}
                <button
                  type="button"
                  onClick={() => toggleExpand(row.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#FAFAF9] transition-colors text-left"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: accentColor }}>
                    {DEBT_TYPE_ICON[row.debtType] ?? (i + 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink-900 truncate">{row.name}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-cream-100 text-ink-500 border border-cream-200">
                        {DEBT_TYPES.find((t) => t.value === row.debtType)?.label ?? "Other"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-rust-600 font-semibold tabular-nums">{money(row.balance)}</span>
                      <span className="text-xs text-ink-500">{row.apr}% APR</span>
                      <span className="text-xs text-ink-500">{money(row.payment)}/mo</span>
                      {strat?.payoffDate && <span className="text-xs text-teal-600 font-medium">→ {strat.payoffDate}</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={14} className="text-ink-500 shrink-0" /> : <ChevronDown size={14} className="text-ink-500 shrink-0" />}
                </button>

                {/* ── Expanded form ── */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
                    <div className="pt-4 space-y-4">

                      {/* Debt type picker */}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Debt type</div>
                        <DebtTypePicker value={d.debtType} onChange={(v) => setDraft(row.id, { debtType: v })} />
                      </div>

                      {/* Name */}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Name</div>
                        <input
                          className="h-10 w-full rounded-xl border border-cream-200 bg-white px-3 text-sm font-semibold text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all"
                          value={d.name} onChange={(e) => setDraft(row.id, { name: e.target.value })} placeholder="Debt name"
                        />
                      </div>

                      {/* Core fields */}
                      <div className="grid gap-3 sm:grid-cols-4">
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Balance</span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm pointer-events-none">$</span>
                            <input className={inputCls + " pl-7"} value={d.balance} onChange={(e) => setDraft(row.id, { balance: e.target.value })} inputMode="decimal" placeholder="0.00" />
                          </div>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                            {isMortgage ? "Total Payment" : "Min Payment"}
                          </span>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm pointer-events-none">$</span>
                            <input className={inputCls + " pl-7"} value={d.payment} onChange={(e) => setDraft(row.id, { payment: e.target.value })} inputMode="decimal" placeholder="0.00" />
                          </div>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">APR %</span>
                          <div className="relative">
                            <input className={inputCls + " pr-7"} value={d.apr} onChange={(e) => setDraft(row.id, { apr: e.target.value })} inputMode="decimal" placeholder="0.0" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 text-xs pointer-events-none">%</span>
                          </div>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Payments Left</span>
                          <input className={inputCls} value={d.paymentsRemaining} onChange={(e) => setDraft(row.id, { paymentsRemaining: e.target.value })} inputMode="numeric" placeholder="0" />
                        </label>
                      </div>

                      {/* Mortgage-specific fields */}
                      {isMortgage && (
                        <div className="rounded-xl border border-rust-500/30 bg-rust-50 p-4 space-y-3">
                          <div className="text-xs font-semibold text-rust-600 uppercase tracking-wider">🏠 Mortgage details</div>
                          <p className="text-xs text-ink-500">
                            Only P&amp;I reduces your balance. Escrow (taxes + insurance) doesn't count toward payoff.
                          </p>

                          {/* Includes escrow toggle */}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <button
                              type="button"
                              onClick={() => setDraft(row.id, { includesEscrow: !d.includesEscrow })}
                              className={cn(
                                "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                                d.includesEscrow ? "bg-teal-600" : "bg-cream-200"
                              )}
                            >
                              <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", d.includesEscrow ? "translate-x-4" : "translate-x-0")} />
                            </button>
                            <span className="text-xs text-ink-900 font-medium">My payment includes escrow (taxes &amp; insurance)</span>
                          </label>

                          {d.includesEscrow && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">P&amp;I portion</span>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm pointer-events-none">$</span>
                                  <input className={inputCls + " pl-7"} value={d.principalAndInterest}
                                    onChange={(e) => setDraft(row.id, { principalAndInterest: e.target.value })}
                                    inputMode="decimal" placeholder="e.g. 1450.00" />
                                </div>
                                <span className="text-[10px] text-ink-500">Principal &amp; Interest only (not escrow)</span>
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Escrow amount</span>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm pointer-events-none">$</span>
                                  <input className={inputCls + " pl-7"} value={d.escrowAmount}
                                    onChange={(e) => setDraft(row.id, { escrowAmount: e.target.value })}
                                    inputMode="decimal" placeholder="e.g. 450.00" />
                                </div>
                                <span className="text-[10px] text-ink-500">Taxes + insurance portion</span>
                              </label>
                            </div>
                          )}

                          {/* Show computed P&I if not explicitly set */}
                          {!d.includesEscrow && row.apr > 0 && row.paymentsRemaining > 0 && (
                            <div className="text-xs text-ink-500">
                              Simulating with calculated P&amp;I: <span className="font-semibold text-ink-900">{money(simPmt)}/mo</span>
                              <span className="text-[10px] ml-1">(from balance × rate / amortization formula)</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center justify-between pt-1">
                        <button type="button" disabled={busy} onClick={() => removeDebt(row.id)}
                          className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-cream-200 text-xs text-ink-500 hover:text-rust-600 hover:bg-rust-50 hover:border-rust-600/30 disabled:opacity-60 transition-all">
                          <Trash2 size={13} />
                          Delete
                        </button>
                        <button type="button" disabled={busy} onClick={() => saveDebt(row.id)}
                          className="h-9 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60 transition-all"
                          style={{ background: "var(--color-primary)" }}>
                          Save
                        </button>
                      </div>
                    </div>

                    {/* ── Mini sim results ── */}
                    <div className="grid gap-2 sm:grid-cols-2 mt-4">
                      <div className="rounded-xl border border-cream-100 bg-cream-50 p-3">
                        <div className="text-xs font-semibold text-ink-500 mb-2">Minimum only</div>
                        {base?.warning && !base?.payoffDate ? (
                          <div className="text-xs text-rust-600">{base.warning}</div>
                        ) : (
                          <div className="space-y-1">
                            {([["Payoff", base?.payoffDate ?? "—"], ["Months", String(base?.months ?? "—")], ["Interest", money(base?.totalInterest ?? 0)]] as [string, string][]).map(([lbl, val]) => (
                              <div key={lbl} className="flex justify-between text-xs">
                                <span className="text-ink-500">{lbl}</span>
                                <span className={cn("font-semibold tabular-nums", lbl === "Interest" ? "text-rust-600" : "text-ink-900")}>{val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border p-3" style={{ borderColor: "rgba(47,107,82,0.25)", background: "rgba(47,107,82,0.04)" }}>
                        <div className="text-xs font-semibold mb-2 text-teal-600">With your strategy</div>
                        {strat?.warning && !strat?.payoffDate ? (
                          <div className="text-xs text-rust-600">{strat.warning}</div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              {([["Payoff", strat?.payoffDate ?? "—"], ["Months", String(strat?.months ?? "—")], ["Interest", money(strat?.totalInterest ?? 0)]] as [string, string][]).map(([lbl, val]) => (
                                <div key={lbl} className="flex justify-between text-xs">
                                  <span className="text-ink-500">{lbl}</span>
                                  <span className={cn("font-semibold tabular-nums", lbl === "Interest" ? "text-teal-600" : "text-ink-900")}>{val}</span>
                                </div>
                              ))}
                            </div>
                            {base?.months != null && strat?.months != null && base.months > strat.months && (
                              <div className="mt-2 pt-2 border-t border-teal-600/20 text-xs font-semibold text-teal-600">
                                {base.months - strat.months} mo sooner · saves {money((base.totalInterest ?? 0) - (strat.totalInterest ?? 0))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Payoff Timeline ─────────────────────────── */}
      {sortedDebts.length > 0 && (
        <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={15} className="text-ink-500" />
            <div className="text-sm font-semibold text-ink-900">Payoff Timeline</div>
          </div>
          <div className="text-xs text-ink-500 mb-5">
            {method === "snowball" ? "Snowball" : "Avalanche"} strategy with ${extraSaved}/mo extra
          </div>

          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            {[
              { label: "Baseline (min only)", months: baseline.totalMonths, color: "text-ink-900", bg: "bg-cream-50", border: "border-cream-100" },
              { label: "With your strategy", months: withStrategy.totalMonths, color: "text-teal-600", bg: "bg-teal-50/50", border: "border-teal-600/20" },
            ].map(({ label, months, color, bg, border }) => (
              <div key={label} className={cn("rounded-xl border p-3", bg, border)}>
                <div className="text-xs text-ink-500 mb-1">{label}</div>
                <div className={cn("text-sm font-semibold tabular-nums", color)}>
                  {months ? `${months} months` : "—"}
                </div>
                {months ? <div className="text-xs text-ink-500 mt-0.5">{fmtDate(addMonths(new Date(), months))}</div> : null}
              </div>
            ))}
            <div className="rounded-xl border border-teal-600/20 bg-teal-50/50 p-3">
              <div className="text-xs text-ink-500 mb-1">You save</div>
              {baseline.totalMonths && withStrategy.totalMonths && baseline.totalMonths > withStrategy.totalMonths ? (
                <>
                  <div className="text-sm font-semibold text-teal-600 tabular-nums">{baseline.totalMonths - withStrategy.totalMonths} months</div>
                  <div className="text-xs text-teal-600 mt-0.5">{money(baseline.totalInterest - withStrategy.totalInterest)} interest</div>
                </>
              ) : (
                <div className="text-xs text-ink-500 mt-1">Add extra payment to see savings</div>
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
                    <span className="text-ink-500 font-medium truncate max-w-[55%]">
                      {DEBT_TYPE_ICON[d.debtType] ?? ""} {d.name}
                    </span>
                    <span className="text-ink-500 tabular-nums shrink-0 ml-2">
                      {stratMonths ? `${stratMonths} mo · ${fmtDate(addMonths(new Date(), stratMonths))}` : "—"}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-cream-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
            {baseline.totalMonths && withStrategy.totalMonths && baseline.totalMonths > withStrategy.totalMonths && (
              <div className="pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-ink-500 italic">Baseline (no extra)</span>
                  <span className="text-ink-500 tabular-nums">{baseline.totalMonths} mo · {fmtDate(addMonths(new Date(), baseline.totalMonths))}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-cream-100 overflow-hidden">
                  <div className="h-full rounded-full bg-cream-200" style={{ width: `${Math.min(100, (baseline.totalMonths / maxTimelineMonths) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 text-xs text-ink-500">
            Estimates use monthly compounding (APR ÷ 12).
            {debts.some((d) => d.debtType === "mortgage") && " Mortgage simulation uses P&I only — escrow excluded."}
          </div>
        </div>
      )}
    </div>
  );
}
