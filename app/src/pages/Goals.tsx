import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Goal = {
  id: string;
  title: string;
  status: "active" | "done";
  due_date: string | null;
  notes: string | null;
};

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const r = await api<{ goals: Goal[] }>("/api/goals");
    setGoals(r.goals);
  }

  useEffect(() => {
    refresh();
  }, []);

  const active = useMemo(() => goals.filter(g => g.status === "active"), [goals]);
  const done = useMemo(() => goals.filter(g => g.status === "done"), [goals]);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!title.trim()) {
      setMsg("Enter a goal title.");
      return;
    }

    setBusy(true);
    try {
      await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          dueDate: dueDate || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      setTitle("");
      setDueDate("");
      setNotes("");
      setMsg("Saved ✅");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(g: Goal) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/goals/${g.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: g.status === "active" ? "done" : "active" }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/goals/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Goals</h1>
        <p className="mt-1 text-sm text-zinc-500">Track goals with optional due dates.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <form onSubmit={addGoal} className="grid gap-4 max-w-2xl">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Goal</span>
              <input
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Pay off Midland Credit"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Due date (optional)</span>
              <input
                type="date"
                className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Notes (optional)</span>
            <input
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="extra details…"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              disabled={busy}
              className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Add goal
            </button>
            {msg && <div className="text-sm text-zinc-600">{msg}</div>}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900">Active</div>
        <div className="divide-y divide-zinc-200">
          {active.length === 0 && <div className="px-5 py-6 text-sm text-zinc-500">No active goals.</div>}
          {active.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-[240px]">
                <div className="font-medium text-zinc-900">{g.title}</div>
                <div className="text-sm text-zinc-500">
                  {g.due_date ? `Due ${g.due_date}` : "No due date"}
                  {g.notes ? ` • ${g.notes}` : ""}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  disabled={busy}
                  onClick={() => toggleDone(g)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Mark done
                </button>
                <button
                  disabled={busy}
                  onClick={() => remove(g.id)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900">Done</div>
        <div className="divide-y divide-zinc-200">
          {done.length === 0 && <div className="px-5 py-6 text-sm text-zinc-500">No completed goals yet.</div>}
          {done.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-[240px]">
                <div className="font-medium text-zinc-900 line-through">{g.title}</div>
                <div className="text-sm text-zinc-500">
                  {g.due_date ? `Due ${g.due_date}` : "No due date"}
                  {g.notes ? ` • ${g.notes}` : ""}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  disabled={busy}
                  onClick={() => toggleDone(g)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Mark active
                </button>
                <button
                  disabled={busy}
                  onClick={() => remove(g.id)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
