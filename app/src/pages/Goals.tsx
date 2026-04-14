import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Trash2, Target, PlusCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { canAccess } from "../lib/permissions";

type Goal = {
  id: string;
  title: string;
  status: "active" | "done";
  due_date: string | null;
  notes: string | null;
  goal_type: "personal" | "savings";
  target_amount: number;
  saved_amount: number;
};

const inputCls = "h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/15 transition-all w-full";

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(`${dateStr}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function GoalBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-stone-100 text-stone-400">Overdue</span>;
  if (days === 0) return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-[#FDF3E3] text-[#B8791F]">Due today</span>;
  if (days <= 7)  return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-[#FDF3E3] text-[#B8791F]">{days}d left</span>;
  if (days <= 30) return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-[#EBF3EF] text-[#2F6B52]">{days}d left</span>;
  return null;
}

function money(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });
}

export default function Goals() {
  const { user } = useUser();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes]   = useState("");
  const [goalType, setGoalType] = useState<"personal" | "savings">("personal");
  const [targetAmount, setTargetAmount] = useState("");
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [contributingGoalId, setContributingGoalId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionBusy, setContributionBusy] = useState(false);

  async function refresh() {
    const r = await api<{ goals: Goal[] }>("/api/goals");
    setGoals(r.goals);
  }
  if (!canAccess(user, "can_see_goals")) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-sm font-medium text-[#0B2A4A] mb-1">Goals is restricted</p>
        <p className="text-xs text-[#5C6B7A]">Ask your household admin to grant access.</p>
      </div>
    );
  }

  useEffect(() => { refresh(); }, []);

  const active = useMemo(() => goals.filter((g) => g.status === "active"), [goals]);
  const done   = useMemo(() => goals.filter((g) => g.status === "done"),   [goals]);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!title.trim()) { setMsg("Enter a goal title."); return; }
    if (goalType === "savings" && (!targetAmount || Number(targetAmount) <= 0)) {
      setMsg("Enter a target amount for savings goals."); return;
    }
    setBusy(true);
    try {
      await api("/api/goals", { method: "POST", body: JSON.stringify({
        title: title.trim(),
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        goal_type: goalType,
        target_amount: goalType === "savings" ? Number(targetAmount) : 0,
      }) });
      setTitle(""); setDueDate(""); setNotes(""); setTargetAmount(""); setGoalType("personal");
      setShowForm(false);
      await refresh();
    } finally { setBusy(false); }
  }

  async function toggleDone(g: Goal) {
    setBusy(true);
    const completing = g.status === "active";
    try {
      await api(`/api/goals/${g.id}`, { method: "PATCH", body: JSON.stringify({ status: completing ? "done" : "active" }) });
      if (completing) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ["#0B2A4A", "#C8A464", "#2F6B52"] });
      }
      await refresh();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this goal?")) return;
    setBusy(true);
    try { await api(`/api/goals/${id}`, { method: "DELETE" }); await refresh(); }
    finally { setBusy(false); }
  }

  async function addContribution(goalId: string) {
    const amount = Number(contributionAmount);
    if (Number.isNaN(amount) || amount <= 0) return;
    setContributionBusy(true);
    try {
      const res = await api<{ ok: true; saved_amount: number; isComplete: boolean }>(`/api/goals/${goalId}/contribute`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      setContributingGoalId(null);
      setContributionAmount("");
      if (res.isComplete) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ["#C8A464", "#2F6B52", "#0B2A4A"] });
      }
      await refresh();
    } catch {
      // silent — refresh will restore state
    } finally {
      setContributionBusy(false);
    }
  }

  function GoalCard({ g }: { g: Goal }) {
    const isDone   = g.status === "done";
    const days     = g.due_date ? daysUntil(g.due_date) : null;
    const isSavings = g.goal_type === "savings";
    const target   = Number(g.target_amount ?? 0);
    const saved    = Number(g.saved_amount ?? 0);
    const pct      = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
    const isContributing = contributingGoalId === g.id;

    return (
      <div className={cn("px-5 py-4 hover:bg-stone-50/60 transition-colors", isDone && "opacity-60")}>
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => toggleDone(g)} disabled={busy || isSavings}
            aria-label={isDone ? "Mark active" : "Mark complete"}
            className={cn("mt-0.5 shrink-0 text-stone-300 hover:text-[#2F6B52] disabled:opacity-40 transition-colors", isSavings && "cursor-default")}>
            {isDone
              ? <CheckCircle2 size={20} className="text-[#2F6B52]" />
              : <Circle size={20} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={cn("text-sm font-medium text-stone-900", isDone && "line-through text-stone-400")}>
                {g.title}
              </span>
              {isSavings && !isDone && (
                <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-[#EBF3EF] text-[#2F6B52]">Savings</span>
              )}
              {g.due_date && days !== null && !isDone && <GoalBadge days={days} />}
            </div>
            <div className="text-xs text-stone-400">
              {g.due_date
                ? `Due ${new Date(`${g.due_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : "No due date"}
              {g.notes ? ` · ${g.notes}` : ""}
            </div>

            {/* Savings progress */}
            {isSavings && !isDone && target > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-stone-500 mb-1">
                  <span>Saved: {money(saved)}</span>
                  <span>Goal: {money(target)}</span>
                </div>
                <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#2F6B52] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  {Math.round(pct)}% complete · {money(target - saved)} remaining
                </div>

                {/* Contribution inline form */}
                {!isContributing ? (
                  <button type="button"
                    onClick={() => { setContributingGoalId(g.id); setContributionAmount(""); }}
                    className="mt-2 text-xs font-semibold text-[#2F6B52] hover:text-[#2F6B52]/80 transition-colors">
                    + Add contribution
                  </button>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                      <input
                        className="h-9 w-full rounded-xl border border-stone-200 bg-stone-50 pl-7 pr-3 text-sm font-mono outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/15 transition-all"
                        placeholder="300.00"
                        inputMode="decimal"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button type="button"
                      onClick={() => addContribution(g.id)}
                      disabled={contributionBusy || !contributionAmount}
                      className="h-9 rounded-xl bg-[#2F6B52] px-3 text-xs font-semibold text-white hover:bg-[#2F6B52]/90 disabled:opacity-60 transition-all">
                      Add
                    </button>
                    <button type="button"
                      onClick={() => { setContributingGoalId(null); setContributionAmount(""); }}
                      className="h-9 rounded-xl border border-stone-200 px-3 text-xs text-stone-500 hover:bg-stone-50 transition-all">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Savings goal reached */}
            {isSavings && isDone && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#EBF3EF] px-3 py-1 text-xs font-semibold text-[#2F6B52]">
                🎉 Goal reached!
              </div>
            )}
          </div>

          <button onClick={() => remove(g.id)} disabled={busy}
            className="shrink-0 rounded-xl p-2 text-stone-300 hover:text-[#B8791F] hover:bg-[#FDF3E3] disabled:opacity-40 transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-semibold text-stone-900">Goals</div>
          <div className="text-xs text-stone-400 mt-0.5">{active.length} active · {done.length} completed</div>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "var(--color-primary)" }}>
          <PlusCircle size={14} />
          New goal
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="text-sm font-semibold text-stone-900 mb-4">New Goal</div>
          <form onSubmit={addGoal} className="space-y-3">

            {/* Goal type selector */}
            <div className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Goal Type</span>
              <div className="inline-flex gap-2">
                <button type="button"
                  onClick={() => setGoalType("personal")}
                  className={cn("h-9 px-4 rounded-xl text-sm font-semibold transition-all border",
                    goalType === "personal"
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50")}>
                  Personal
                </button>
                <button type="button"
                  onClick={() => setGoalType("savings")}
                  className={cn("h-9 px-4 rounded-xl text-sm font-semibold transition-all border",
                    goalType === "savings"
                      ? "bg-[#2F6B52] text-white border-[#2F6B52]"
                      : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50")}>
                  Savings
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Goal title</span>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Emergency fund, pay off card…" autoFocus />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Due date (optional)</span>
                <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            </div>

            {goalType === "savings" && (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Target Amount</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                  <input
                    className={inputCls + " pl-7"}
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="850.00"
                    inputMode="decimal"
                  />
                </div>
              </label>
            )}

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Notes (optional)</span>
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivation, strategy, milestone…" />
            </label>
            {msg && <div className="text-sm text-[#B8791F]">{msg}</div>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy}
                className="h-10 px-5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
                style={{ background: "var(--color-primary)" }}>
                {busy ? "Saving…" : "Save goal"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="h-10 px-4 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active goals */}
      <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Target size={15} className="text-stone-400" />
            <div className="text-sm font-semibold text-stone-900">Active Goals</div>
          </div>
          <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-[#EBF3EF] text-[#2F6B52]">{active.length}</span>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {active.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Target size={28} className="mx-auto text-stone-200 mb-2" />
              <div className="text-sm text-stone-400">No active goals yet.</div>
              <div className="text-xs text-stone-300 mt-0.5">Add one above to get started.</div>
            </div>
          ) : active.map((g) => <GoalCard key={g.id} g={g} />)}
        </div>
      </div>

      {/* Completed goals */}
      {done.length > 0 && (
        <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#2F6B52]" />
              <div className="text-sm font-semibold text-stone-500">Completed</div>
            </div>
            <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-stone-100 text-stone-500">{done.length}</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            {done.map((g) => <GoalCard key={g.id} g={g} />)}
          </div>
        </div>
      )}
    </div>
  );
}
