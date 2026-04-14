import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Chore = {
  id: string;
  title: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  frequency: string;
  due_date: string | null;
  completed: number;
  completed_at: string | null;
  created_at: string;
};

type HouseholdMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const FREQUENCIES = [
  { value: "daily",      label: "Daily" },
  { value: "weekly",     label: "Weekly" },
  { value: "bi-weekly",  label: "Bi-weekly" },
  { value: "monthly",    label: "Monthly" },
  { value: "as-needed",  label: "As needed" },
];

const FREQ_COLORS: Record<string, string> = {
  daily:       "bg-[#EBF3EF] text-[#2F6B52]",
  weekly:      "bg-[#F5F1EA] text-[#5C6B7A]",
  "bi-weekly": "bg-[#F5F1EA] text-[#5C6B7A]",
  monthly:     "bg-[#FDF8F0] text-[#B8791F]",
  "as-needed": "bg-[#F5F1EA] text-[#5C6B7A]",
};

function dueDateLabel(dueDate: string | null, completed: number) {
  if (!dueDate || completed) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `Overdue by ${Math.abs(diff)}d`, overdue: true };
  if (diff === 0) return { text: "Due today", overdue: true };
  if (diff === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due in ${diff}d`, overdue: false };
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const inputCls =
  "h-10 rounded-xl border border-[#E8E2D9] bg-white px-3 text-sm text-[#0B2A4A] outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/20 transition-all placeholder:text-[#5C6B7A]";

type Filter = "all" | "pending" | "completed";

export default function Chores() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // New chore form state
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [choreRes, householdRes] = await Promise.all([
        api<{ chores: Chore[] }>("/api/chores"),
        api<{ members: HouseholdMember[] }>("/api/household"),
      ]);
      setChores(choreRes.chores ?? []);
      setMembers(householdRes.members ?? []);
    } catch {
      setMsg("Failed to load chores.");
    }
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  async function addChore(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setSaving(true); setMsg(null);
    try {
      await api("/api/chores", {
        method: "POST",
        body: JSON.stringify({
          title: t,
          assignedTo: assignedTo || undefined,
          frequency,
          dueDate: dueDate || undefined,
        }),
      });
      setTitle(""); setAssignedTo(""); setFrequency("weekly"); setDueDate("");
      setShowForm(false);
      await load();
    } catch { setMsg("Failed to add chore."); }
    finally { setSaving(false); }
  }

  async function toggleComplete(id: string) {
    setMsg(null);
    try {
      await api(`/api/chores/${id}/complete`, { method: "PATCH" });
      await load();
    } catch { setMsg("Failed to update chore."); }
  }

  async function deleteChore(id: string, choreTitle: string) {
    if (!window.confirm(`Delete "${choreTitle}"?`)) return;
    setMsg(null);
    try {
      await api(`/api/chores/${id}`, { method: "DELETE" });
      await load();
    } catch { setMsg("Failed to delete chore."); }
  }

  const filtered = useMemo(() => {
    if (filter === "pending") return chores.filter((c) => !c.completed);
    if (filter === "completed") return chores.filter((c) => c.completed);
    return chores;
  }, [chores, filter]);

  const filterTabs: { key: Filter; label: string }[] = [
    { key: "pending",   label: `Pending (${chores.filter((c) => !c.completed).length})` },
    { key: "completed", label: `Done (${chores.filter((c) => c.completed).length})` },
    { key: "all",       label: "All" },
  ];

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-[#B8791F]/30 bg-[#FDF3E3] px-4 py-2.5 text-sm text-[#B8791F]">{msg}</div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0B2A4A]">Chore list</h2>
          <p className="text-xs text-[#5C6B7A]">Shared with your household</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="h-9 rounded-xl bg-[#0B2A4A] px-4 text-sm font-semibold text-white hover:bg-[#0F3360] transition-all"
        >
          {showForm ? "Cancel" : "+ Add chore"}
        </button>
      </div>

      {/* Add chore form */}
      {showForm && (
        <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm">
          <form onSubmit={addChore} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1">
                  What needs doing?
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Vacuum living room"
                  className={cn(inputCls, "w-full")}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1">
                  Assign to
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className={cn(inputCls, "w-full")}
                >
                  <option value="">Anyone / unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className={cn(inputCls, "w-full")}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1">
                  Due date (optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={cn(inputCls, "w-full")}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="h-10 rounded-xl bg-[#0B2A4A] px-5 text-sm font-semibold text-white hover:bg-[#0F3360] disabled:opacity-50 transition-all"
              >
                {saving ? "Adding…" : "Add chore"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setTitle(""); setAssignedTo(""); setFrequency("weekly"); setDueDate(""); }}
                className="h-10 rounded-xl border border-[#E8E2D9] px-4 text-sm text-[#5C6B7A] hover:bg-[#F5F1EA] transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-[#F5F1EA] p-1 w-fit">
        {filterTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              filter === key
                ? "bg-[#0B2A4A] text-white shadow-sm"
                : "text-[#5C6B7A] hover:bg-[#E8E2D9]/60"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chore list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-white border border-[#E8E2D9] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-3xl mb-3">🧹</div>
          <p className="text-sm text-[#5C6B7A]">
            {filter === "pending"
              ? "Everything's done. Nice work!"
              : filter === "completed"
              ? "Nothing completed yet."
              : "Nothing on the list. Add your first chore above."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chore) => {
            const due = dueDateLabel(chore.due_date, chore.completed);
            const freqStyle = FREQ_COLORS[chore.frequency] ?? FREQ_COLORS["as-needed"];
            return (
              <div
                key={chore.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border border-[#E8E2D9] bg-white p-4 shadow-sm transition-opacity",
                  chore.completed && "opacity-60"
                )}
              >
                {/* Complete toggle */}
                <button
                  type="button"
                  onClick={() => toggleComplete(chore.id)}
                  className={cn(
                    "mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all",
                    chore.completed
                      ? "bg-[#2F6B52] border-[#2F6B52] text-white"
                      : "border-[#E8E2D9] hover:border-[#2F6B52]"
                  )}
                  aria-label={chore.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {chore.completed && <span className="text-[11px] leading-none font-bold">✓</span>}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-medium leading-snug",
                    chore.completed ? "line-through text-[#5C6B7A]" : "text-[#0B2A4A]"
                  )}>
                    {chore.title}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {/* Assigned to */}
                    <span className="text-xs text-[#5C6B7A]">
                      👤 {chore.assigned_to_name ?? "Anyone"}
                    </span>

                    {/* Frequency badge */}
                    <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", freqStyle)}>
                      {FREQUENCIES.find((f) => f.value === chore.frequency)?.label ?? chore.frequency}
                    </span>

                    {/* Due date */}
                    {due && (
                      <span className={cn("text-xs", due.overdue ? "text-[#B8791F]" : "text-[#5C6B7A]")}>
                        {due.text}
                      </span>
                    )}

                    {/* Completed info */}
                    {chore.completed && chore.completed_at && (
                      <span className="text-xs text-[#2F6B52]">
                        Done · {timeAgo(chore.completed_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => deleteChore(chore.id, chore.title)}
                  className="shrink-0 rounded-lg p-1.5 text-[#5C6B7A] hover:text-[#B8791F] hover:bg-[#FDF3E3] transition-colors text-sm leading-none"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
