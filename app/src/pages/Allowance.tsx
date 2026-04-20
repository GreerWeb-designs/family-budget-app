import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { isAdminOrPrimary } from "../lib/permissions";

type AllowanceData = { amount: number; frequency: string; notes: string | null } | null;
type Member = { id: string; name: string; account_type?: string };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{
      background: "linear-gradient(145deg, #FFFDF8 0%, #FAF6EC 100%)",
      borderColor: "#DDD7C8",
      boxShadow: "0 1px 3px rgba(27,66,67,0.04), 0 4px 16px rgba(27,66,67,0.06)",
    }}>
      {children}
    </div>
  );
}

// ── Dependent view ────────────────────────────────────────────────────────────
function DependentAllowance() {
  const [allowance, setAllowance] = useState<AllowanceData>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ allowance: AllowanceData }>("/api/allowance/mine")
      .then(r => setAllowance(r.allowance))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse text-sm text-ink-500 py-8 text-center">Loading…</div>;

  return (
    <div className="max-w-md">
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(45,110,112,0.12)" }}>
            <Coins size={18} className="text-teal-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink-900" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
              My Allowance
            </h2>
            <p className="text-xs text-ink-500">Set by your household admin</p>
          </div>
        </div>

        {allowance ? (
          <div className="space-y-3">
            <div className="rounded-xl p-4 text-center" style={{
              background: "linear-gradient(135deg, rgba(45,110,112,0.12) 0%, rgba(45,110,112,0.05) 100%)",
              border: "1.5px solid rgba(45,110,112,0.18)",
            }}>
              <div className="text-4xl font-semibold tabular-nums text-teal-700 mb-1"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                {money(allowance.amount)}
              </div>
              <div className="text-sm text-teal-600 capitalize">{allowance.frequency}</div>
            </div>
            {allowance.notes && (
              <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Note from parent</p>
                <p className="text-sm text-ink-900">{allowance.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🪙</div>
            <p className="text-sm font-medium text-ink-900">No allowance set yet</p>
            <p className="text-xs text-ink-500 mt-1">Ask a parent to set up your allowance.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Parent/admin view ─────────────────────────────────────────────────────────
function ParentAllowance() {
  const [dependents, setDependents] = useState<Member[]>([]);
  const [allowances, setAllowances] = useState<Record<string, AllowanceData>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ id: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await api<{ members: Member[] }>("/api/household");
      const deps = (res.members ?? []).filter(m => m.account_type === "dependent");
      setDependents(deps);
      const map: Record<string, AllowanceData> = {};
      await Promise.all(deps.map(async d => {
        const r = await api<{ allowance: AllowanceData }>(`/api/allowance/${d.id}`).catch(() => ({ allowance: null }));
        map[d.id] = r.allowance;
      }));
      setAllowances(map);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  function startEdit(dep: Member) {
    const existing = allowances[dep.id];
    setAmount(existing ? String(existing.amount) : "");
    setFrequency(existing?.frequency ?? "weekly");
    setNotes(existing?.notes ?? "");
    setEditing(dep.id);
    setMsg(null);
  }

  async function save(depId: string) {
    setSaving(true);
    try {
      await api(`/api/allowance/${depId}`, {
        method: "PUT",
        body: JSON.stringify({ amount: parseFloat(amount) || 0, frequency, notes }),
      });
      setAllowances(prev => ({ ...prev, [depId]: { amount: parseFloat(amount) || 0, frequency, notes: notes || null } }));
      setMsg({ id: depId, ok: true });
      setEditing(null);
    } catch {
      setMsg({ id: depId, ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse text-sm text-ink-500 py-8 text-center">Loading…</div>;

  if (dependents.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">👦</div>
          <p className="text-sm font-medium text-ink-900">No dependents yet</p>
          <p className="text-xs text-ink-500 mt-1">Add a dependent account in Settings → Household.</p>
        </div>
      </Card>
    );
  }

  const inputCls = "w-full h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

  return (
    <div className="space-y-4 max-w-lg">
      {dependents.map(dep => {
        const existing = allowances[dep.id];
        const isEditing = editing === dep.id;
        return (
          <Card key={dep.id}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-ink-900">{dep.name}</div>
                {existing && !isEditing && (
                  <div className="text-xs text-teal-600 mt-0.5">
                    {money(existing.amount)} / {existing.frequency}
                  </div>
                )}
                {!existing && !isEditing && (
                  <div className="text-xs text-ink-500 mt-0.5">No allowance set</div>
                )}
              </div>
              {!isEditing && (
                <button type="button" onClick={() => startEdit(dep)}
                  className="h-8 px-3 rounded-xl text-xs font-semibold text-white transition-all"
                  style={{ background: "#1B4243" }}>
                  {existing ? "Edit" : "Set allowance"}
                </button>
              )}
            </div>

            {isEditing && (
              <div className="space-y-3 pt-2 border-t border-cream-200">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 block">Amount ($)</label>
                    <input className={inputCls} type="number" min="0" step="0.01"
                      placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="w-36">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 block">Frequency</label>
                    <select className={inputCls} value={frequency} onChange={e => setFrequency(e.target.value)}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 block">Note (optional)</label>
                  <input className={inputCls} placeholder="e.g. For chores completed" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                {msg?.id === dep.id && (
                  <p className={`text-xs font-medium ${msg.ok ? "text-teal-600" : "text-rust-600"}`}>
                    {msg.ok ? "Saved!" : "Failed to save."}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => save(dep.id)} disabled={saving}
                    className="flex-1 h-9 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "#1B4243" }}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditing(null)}
                    className="h-9 px-4 rounded-xl text-sm font-medium text-ink-500 border border-cream-200 hover:bg-cream-100">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Allowance() {
  const { user } = useUser();
  const isParent = isAdminOrPrimary(user);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          Allowance
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          {isParent ? "Set and manage allowances for your dependents." : "Your allowance info from home."}
        </p>
      </div>
      {isParent ? <ParentAllowance /> : <DependentAllowance />}
    </div>
  );
}
