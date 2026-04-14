import { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import { api } from "../lib/api";
import { money } from "../lib/utils";

type SummaryRow = { id: string; name: string; budgeted: number; activity: number; available: number };

const PALETTE = [
  "#1B4243", "#2D6E70", "#C17A3F", "#A3632F",
  "#6B7A85", "#245759", "#6FA3A5", "#D99A66",
  "#4A8A8C", "#E8B48A", "#3D6E70", "#8CA3A8",
];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("default", { month: "short", year: "numeric" });
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Spending() {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<{ month: string; total: number }[]>([]);

  async function load(m: string) {
    setLoading(true); setMsg(null);
    try {
      // Build list of past 5 months oldest-first
      const pastMonths: string[] = [];
      let cursor = m;
      for (let i = 0; i < 5; i++) {
        cursor = prevMonth(cursor);
        pastMonths.unshift(cursor);
      }

      const [cur, ...pastResults] = await Promise.all([
        api<{ byCategory: SummaryRow[] }>(`/api/spend/summary?month=${m}`),
        ...pastMonths.map((pm) =>
          api<{ byCategory: SummaryRow[] }>(`/api/spend/summary?month=${pm}`)
            .then((r) => ({ month: pm, total: r.byCategory.reduce((s, row) => s + row.activity, 0) }))
            .catch(() => null)
        ),
      ]);
      const outflows = (cur.byCategory ?? []).filter((r) => r.activity > 0);
      setRows(outflows);
      const currentTotal = outflows.reduce((s, r) => s + r.activity, 0);
      setHistory([
        ...(pastResults.filter(Boolean) as { month: string; total: number }[]),
        { month: m, total: currentTotal },
      ]);
    } catch { setMsg("Failed to load spending data."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(month); }, [month]);

  const totalSpend = useMemo(() => rows.reduce((s, r) => s + r.activity, 0), [rows]);

  const donutData = useMemo(() =>
    rows.map((r) => ({ name: r.name, value: r.activity }))
  , [rows]);

  const isCurrentMonth = month === currentMonthKey();

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-rust-600/30 bg-rust-50 px-4 py-2.5 text-sm text-rust-600">{msg}</div>
      )}

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-2xl border border-cream-200 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => setMonth(prevMonth(month))}
          className="h-9 w-9 rounded-xl border border-cream-200 text-ink-500 hover:bg-cream-100 transition-all flex items-center justify-center">
          ←
        </button>
        <div className="text-center">
          <div className="font-medium text-sm text-ink-900">{monthLabel(month)}</div>
          <div className="text-xs text-ink-500">{isCurrentMonth ? "Current month" : "Past month"}</div>
        </div>
        <button type="button" onClick={() => !isCurrentMonth && setMonth(nextMonth(month))}
          className={`h-9 w-9 rounded-xl border border-cream-200 transition-all flex items-center justify-center ${isCurrentMonth ? "text-cream-200 cursor-default" : "text-ink-500 hover:bg-cream-100"}`}>
          →
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-cream-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-sm font-medium text-ink-900 mb-1">No spending recorded</p>
          <p className="text-xs text-ink-500">Transactions logged in Budget will appear here.</p>
        </div>
      ) : (
        <>
          {/* Total spend stat */}
          <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Total Spent</div>
            <div className="font-display text-3xl font-semibold text-rust-600 tabular-nums">{money(totalSpend)}</div>
            <div className="text-xs text-ink-500 mt-1">{rows.length} categor{rows.length !== 1 ? "ies" : "y"}</div>
          </div>

          {/* Donut + category list */}
          <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-4">By Category</div>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Donut */}
              <div className="w-full sm:w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%" cy="50%"
                      innerRadius="55%" outerRadius="80%"
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => money(v)}
                      contentStyle={{ borderRadius: 12, border: "1px solid #EDE7D8", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category breakdown */}
              <div className="flex-1 w-full space-y-2">
                {rows.map((r, i) => {
                  const pct = totalSpend > 0 ? (r.activity / totalSpend) * 100 : 0;
                  return (
                    <div key={r.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                          <span className="text-xs font-medium text-ink-900 truncate">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs text-ink-500">{pct.toFixed(0)}%</span>
                          <span className="text-xs font-semibold text-ink-900 tabular-nums">{money(r.activity)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-cream-100">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Monthly trend bar chart */}
          {history.length > 1 && (
            <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-4">6-Month Trend</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={history} barSize={20}>
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m) => new Date(m + "-01").toLocaleString("default", { month: "short" })}
                    tick={{ fontSize: 11, fill: "#6B7A85" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                    tick={{ fontSize: 11, fill: "#6B7A85" }}
                    axisLine={false} tickLine={false} width={40}
                  />
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    labelFormatter={(m) => monthLabel(m as string)}
                    contentStyle={{ borderRadius: 12, border: "1px solid #EDE7D8", fontSize: 12 }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {history.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.month === month ? "#C17A3F" : "#2D6E70"}
                        opacity={entry.month === month ? 1 : 0.6}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
