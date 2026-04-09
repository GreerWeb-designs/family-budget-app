import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Goal = { id: string; title: string; status: "active" | "done"; due_date: string | null; notes: string | null };

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() { const r = await api<{ goals: Goal[] }>("/api/goals"); setGoals(r.goals); }
  useEffect(() => { refresh(); }, []);

  const active = useMemo(() => goals.filter((g) => g.status === "active"), [goals]);
  const done = useMemo(() => goals.filter((g) => g.status === "done"), [goals]);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!title.trim()) { setMsg("Enter a goal title."); return; }
    setBusy(true);
    try {
      await api("/api/goals", { method: "POST", body: JSON.stringify({ title: title.trim(), dueDate: dueDate || undefined, notes: notes.trim() || undefined }) });
      setTitle(""); setDueDate(""); setNotes(""); await refresh();
    } finally { setBusy(false); }
  }

  async function toggleDone(g: Goal) {
    setBusy(true);
    try { await api(`/api/goals/${g.id}`, { method: "PATCH", body: JSON.stringify({ status: g.status === "active" ? "done" : "active" }) }); await refresh(); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this goal?")) return;
    setBusy(true);
    try { await api(`/api/goals/${id}`, { method: "DELETE" }); await refresh(); }
    finally { setBusy(false); }
  }

  const GoalRow = ({ g }: { g: Goal }) => (
    <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors md:px-5">
      <button type="button" onClick={() => toggleDone(g)} disabled={busy}
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${g.status === "done" ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-emerald-400"}`}>
        {g.status === "done" && <span className="text-white text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${g.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}>{g.title}</div>
        <div className="text-xs text-slate-400 mt-0.5">
          {g.due_date ? `Due ${g.due_date}` : "No due date"}
          {g.notes ? ` · ${g.notes}` : ""}
        </div>
      </div>
      <button onClick={() => remove(g.id)} disabled={busy}
        className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition-all">
        Delete
      </button>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Add goal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="text-sm font-semibold text-slate-900 mb-4">Add a Goal</div>
        <form onSubmit={addGoal} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Goal</span>
              <input className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pay off Midland, build emergency fund…" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due date (optional)</span>
              <input type="date" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes (optional)</span>
            <input className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra context…" />
          </label>
          <div className="flex items-center gap-3">
            <button disabled={busy} className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all">
              Add goal
            </button>
            {msg && <span className="text-sm text-slate-600">{msg}</span>}
          </div>
        </form>
      </div>

      {/* Active goals */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Active</div>
          <span className="text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5">{active.length}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {active.length === 0 && <div className="px-5 py-8 text-sm text-slate-400">No active goals. Add one above.</div>}
          {active.map((g) => <GoalRow key={g.id} g={g} />)}
        </div>
      </div>

      {/* Completed goals */}
      {done.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-500">Completed</div>
            <span className="text-xs font-semibold rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5">{done.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {done.map((g) => <GoalRow key={g.id} g={g} />)}
          </div>
        </div>
      )}
    </div>
  );
}