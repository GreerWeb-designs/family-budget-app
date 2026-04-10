import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Trash2, Target, PlusCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Goal = { id: string; title: string; status: "active" | "done"; due_date: string | null; notes: string | null };

const inputCls = "h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all w-full";

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(`${dateStr}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function GoalBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-stone-100 text-stone-400">Overdue</span>;
  if (days === 0) return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-red-100 text-red-700">Due today!</span>;
  if (days <= 7)  return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">{days}d left</span>;
  if (days <= 30) return <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-teal-100 text-teal-700">{days}d left</span>;
  return null;
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    const r = await api<{ goals: Goal[] }>("/api/goals");
    setGoals(r.goals);
  }
  useEffect(() => { refresh(); }, []);

  const active = useMemo(() => goals.filter((g) => g.status === "active"), [goals]);
  const done   = useMemo(() => goals.filter((g) => g.status === "done"),   [goals]);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!title.trim()) { setMsg("Enter a goal title."); return; }
    setBusy(true);
    try {
      await api("/api/goals", { method: "POST", body: JSON.stringify({
        title: title.trim(),
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      }) });
      setTitle(""); setDueDate(""); setNotes("");
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
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ["#0F766E", "#14B8A6", "#F59E0B"] });
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

  function GoalCard({ g }: { g: Goal }) {
    const isDone = g.status === "done";
    const days   = g.due_date ? daysUntil(g.due_date) : null;

    return (
      <div className={cn("flex items-start gap-3 px-5 py-4 hover:bg-stone-50/60 transition-colors", isDone && "opacity-60")}>
        <button type="button" onClick={() => toggleDone(g)} disabled={busy}
          aria-label={isDone ? "Mark active" : "Mark complete"}
          className="mt-0.5 shrink-0 text-stone-300 hover:text-teal-500 disabled:opacity-40 transition-colors">
          {isDone
            ? <CheckCircle2 size={20} className="text-teal-500" />
            : <Circle size={20} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={cn("text-sm font-medium text-stone-900", isDone && "line-through text-stone-400")}>
              {g.title}
            </span>
            {g.due_date && days !== null && !isDone && <GoalBadge days={days} />}
          </div>
          <div className="text-xs text-stone-400">
            {g.due_date
              ? `Due ${new Date(`${g.due_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
              : "No due date"}
            {g.notes ? ` · ${g.notes}` : ""}
          </div>
        </div>

        <button onClick={() => remove(g.id)} disabled={busy}
          className="shrink-0 rounded-xl p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all">
          <Trash2 size={14} />
        </button>
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
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Notes (optional)</span>
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivation, strategy, milestone…" />
            </label>
            {msg && <div className="text-sm text-red-600">{msg}</div>}
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
          <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-teal-100 text-teal-700">{active.length}</span>
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
              <CheckCircle2 size={15} className="text-teal-500" />
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
