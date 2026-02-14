import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Debt = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  payment: number;
  created_at: string;
  updated_at: string;
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function parseNum(s: string) {
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function addMonths(d: Date, months: number) {
  const copy = new Date(d);
  const day = copy.getDate();
  copy.setMonth(copy.getMonth() + months);
  if (copy.getDate() !== day) copy.setDate(0);
  return copy;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function simulateSnowball(
  debts: { id: string; name: string; balance: number; apr: number; payment: number }[],
  extraPerMonth: number,
  startDate: Date
) {
  const state = debts.map((d) => ({
    ...d,
    balance: Math.max(0, d.balance),
    totalInterest: 0,
    paidOffMonthIndex: null as number | null,
  }));

  const MAX_MONTHS = 1200;
  let month = 0;

  while (month < MAX_MONTHS) {
    const remaining = state.filter((d) => d.balance > 0);
    if (remaining.length === 0) break;

    // interest
    for (const d of remaining) {
      const r = (d.apr / 100) / 12;
      const interest = d.balance * r;
      d.totalInterest += interest;
      d.balance += interest;
    }

    // base payments
    for (const d of remaining) {
      const pay = Math.min(Math.max(0, d.payment), d.balance);
      d.balance -= pay;
    }

    // extra to lowest balance
    const extra = Math.max(0, extraPerMonth);
    if (extra > 0) {
      const rem2 = state.filter((d) => d.balance > 0).sort((a, b) => a.balance - b.balance);
      if (rem2[0]) {
        const payExtra = Math.min(extra, rem2[0].balance);
        rem2[0].balance -= payExtra;
      }
    }

    // mark payoff month
    for (const d of state) {
      if (d.paidOffMonthIndex == null && d.balance <= 0.00001) {
        d.balance = 0;
        d.paidOffMonthIndex = month + 1;
      }
    }

    month += 1;
  }

  const out = new Map<string, { months: number | null; totalInterest: number | null; payoffDate: string | null; warning?: string }>();
  for (const d of state) {
    if (d.balance > 0) {
      out.set(d.id, { months: null, totalInterest: null, payoffDate: null, warning: "Not paying off—raise payment/extra." });
    } else {
      const m = d.paidOffMonthIndex ?? 0;
      out.set(d.id, {
        months: m,
        totalInterest: d.totalInterest,
        payoffDate: fmtDate(addMonths(startDate, m)),
      });
    }
  }
  return out;
}

export default function Debts() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [extra, setExtra] = useState("0");           // UI input
  const [extraSaved, setExtraSaved] = useState(0);   // what’s saved in DB

  const [debts, setDebts] = useState<Debt[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; balance: string; apr: string; payment: string }>>({});

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const [d, s] = await Promise.all([
        api<{ debts: Debt[] }>("/api/debts"),
        api<{ extraMonthly: number }>("/api/debts/settings"),
      ]);

      setDebts(d.debts);
      setExtraSaved(Number(s.extraMonthly || 0));
      setExtra(String(Number(s.extraMonthly || 0).toFixed(2)));

      // build drafts from server values
      const nextDrafts: typeof drafts = {};
      for (const row of d.debts) {
        nextDrafts[row.id] = {
          name: row.name,
          balance: String(row.balance),
          apr: String(row.apr),
          payment: String(row.payment),
        };
      }
      setDrafts(nextDrafts);
    } catch (err: any) {
      setMsg(err?.message || "Error loading debts.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function saveExtra() {
    const n = parseNum(extra);
    if (Number.isNaN(n) || n < 0) {
      setMsg("Extra must be a number ≥ 0.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/debts/settings", { method: "POST", body: JSON.stringify({ extraMonthly: n }) });
      setExtraSaved(n);
      setMsg("Saved ✅");
    } catch (err: any) {
      setMsg(err?.message || "Error saving extra.");
    } finally {
      setBusy(false);
    }
  }

  async function addDebt() {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/debts", {
        method: "POST",
        body: JSON.stringify({ name: "New Debt", balance: 0, apr: 0, payment: 0 }),
      });
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error adding debt.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDebt(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/debts/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error removing debt.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDebt(id: string) {
    const d = drafts[id];
    if (!d) return;

    const name = (d.name || "").trim();
    const balance = parseNum(d.balance);
    const apr = parseNum(d.apr);
    const payment = parseNum(d.payment);

    if (!name || Number.isNaN(balance) || Number.isNaN(apr) || Number.isNaN(payment)) {
      setMsg("Fix the numbers before saving.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/debts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, balance, apr, payment }),
      });
      setMsg("Saved ✅");
      await refresh();
    } catch (err: any) {
      setMsg(err?.message || "Error saving debt.");
    } finally {
      setBusy(false);
    }
  }

  const extraPerMonth = useMemo(() => {
    const n = parseNum(extra);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [extra]);

  const calc = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const usable = debts.filter((d) =>
      Number.isFinite(d.balance) && Number.isFinite(d.apr) && Number.isFinite(d.payment)
    );

    const base = simulateSnowball(usable, 0, start);
    const withExtra = simulateSnowball(usable, extraPerMonth, start);

    const baseMonths = usable.map((d) => base.get(d.id)?.months).filter((m): m is number => typeof m === "number");
    const extraMonths = usable.map((d) => withExtra.get(d.id)?.months).filter((m): m is number => typeof m === "number");

    const baseMax = baseMonths.length === usable.length ? Math.max(...baseMonths) : null;
    const extraMax = extraMonths.length === usable.length ? Math.max(...extraMonths) : null;

    const baseInterest = usable
      .map((d) => base.get(d.id)?.totalInterest)
      .filter((x): x is number => typeof x === "number")
      .reduce((a, b) => a + b, 0);

    const extraInterest = usable
      .map((d) => withExtra.get(d.id)?.totalInterest)
      .filter((x): x is number => typeof x === "number")
      .reduce((a, b) => a + b, 0);

    return { base, withExtra, baseMax, extraMax, baseInterest, extraInterest };
  }, [debts, extraPerMonth]);

  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl bg-yellow-50/60 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Debts</h1>
            <p className="mt-1 text-sm text-zinc-600">Snowball extra goes to the lowest balance debt.</p>
          </div>

          <div className="w-full sm:w-[320px]">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-800">Extra Monthly Payment</span>
              <div className="flex gap-2">
                <input
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  inputMode="decimal"
                />
                <button
                  type="button"
                  onClick={saveExtra}
                  disabled={busy}
                  className="h-11 rounded-2xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </label>
            <div className="mt-1 text-xs text-zinc-500">Saved: {money(extraSaved)}</div>
          </div>
        </div>

        {msg && <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">{msg}</div>}

        {/* Overall summary */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">Baseline</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-zinc-600">Total interest</span><span className="font-semibold">{money(calc.baseInterest)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Final payoff (months)</span><span className="font-semibold">{calc.baseMax ?? "—"}</span></div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
            <div className="text-sm font-semibold text-emerald-900">With Extra</div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-emerald-900/70">Total interest</span><span className="font-semibold">{money(calc.extraInterest)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-900/70">Final payoff (months)</span><span className="font-semibold">{calc.extraMax ?? "—"}</span></div>
            </div>
          </div>
        </div>

        {/* Debt list */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Your Debts</div>
              <div className="text-xs text-zinc-500">Tap Save per row after editing.</div>
            </div>
            <button
              type="button"
              onClick={addDebt}
              disabled={busy}
              className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              + Add Debt
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {debts.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                No debts yet. Add one to start.
              </div>
            )}

            {debts.map((row) => {
              const d = drafts[row.id] || { name: row.name, balance: String(row.balance), apr: String(row.apr), payment: String(row.payment) };
              const base = calc.base.get(row.id);
              const ext = calc.withExtra.get(row.id);

              return (
                <div key={row.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr_0.7fr_1fr_auto]">
                    <input
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                      value={d.name}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...d, name: e.target.value } }))}
                      placeholder="Car, MCM…"
                    />
                    <input
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                      value={d.balance}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...d, balance: e.target.value } }))}
                      placeholder="Balance"
                      inputMode="decimal"
                    />
                    <input
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                      value={d.apr}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...d, apr: e.target.value } }))}
                      placeholder="APR %"
                      inputMode="decimal"
                    />
                    <input
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                      value={d.payment}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...d, payment: e.target.value } }))}
                      placeholder="Payment"
                      inputMode="decimal"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveDebt(row.id)}
                        className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeDebt(row.id)}
                        className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* results */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="text-xs font-semibold text-zinc-700">Baseline</div>
                      <div className="mt-2 text-sm">
                        {base?.warning ? (
                          <div className="text-red-700 text-xs">{base.warning}</div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between"><span className="text-zinc-600">Interest</span><span className="font-semibold">{money(base?.totalInterest ?? 0)}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-600">Months</span><span className="font-semibold">{base?.months ?? "—"}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-600">Payoff</span><span className="font-semibold">{base?.payoffDate ?? "—"}</span></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <div className="text-xs font-semibold text-emerald-800">With Extra</div>
                      <div className="mt-2 text-sm">
                        {ext?.warning ? (
                          <div className="text-red-700 text-xs">{ext.warning}</div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between"><span className="text-emerald-900/70">Interest</span><span className="font-semibold text-emerald-900">{money(ext?.totalInterest ?? 0)}</span></div>
                            <div className="flex justify-between"><span className="text-emerald-900/70">Months</span><span className="font-semibold text-emerald-900">{ext?.months ?? "—"}</span></div>
                            <div className="flex justify-between"><span className="text-emerald-900/70">Payoff</span><span className="font-semibold text-emerald-900">{ext?.payoffDate ?? "—"}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Uses monthly compounding (APR/12). Great for planning and comparisons.
          </div>
        </div>
      </div>
    </div>
  );
}
