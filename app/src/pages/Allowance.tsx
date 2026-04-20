import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { isAdminOrPrimary } from "../lib/permissions";
import { cn } from "../lib/utils";

/* ── Types ───────────────────────────────────────────── */
type AlCat     = { id: string; name: string; emoji: string; budgeted: number; sort_order: number };
type AlDeposit = { id: string; amount: number; note: string | null; added_by_name: string; created_at: string };
type Budget    = { totalDeposited: number; categories: AlCat[]; deposits: AlDeposit[] };
type DepMember = { id: string; name: string; account_type?: string };

/* ── Helpers ─────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Shared card shell ───────────────────────────────── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border p-5", className)} style={{
      background: "linear-gradient(145deg, #FFFDF8 0%, #FAF6EC 100%)",
      borderColor: "#DDD7C8",
      boxShadow: "0 1px 3px rgba(27,66,67,0.04), 0 4px 16px rgba(27,66,67,0.06)",
    }}>
      {children}
    </div>
  );
}

/* ── "To assign" pill ────────────────────────────────── */
function ToAssignPill({ value }: { value: number }) {
  const over = value < 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums border",
      over
        ? "bg-rust-50 text-rust-600 border-rust-500/30"
        : "bg-teal-50 text-teal-600 border-teal-500/30"
    )}>
      {over ? `Over ${money(Math.abs(value))}` : `${money(value)} to assign`}
    </span>
  );
}

/* ── Category row ────────────────────────────────────── */
function CategoryRow({
  cat, onUpdate, onDelete,
}: {
  cat: AlCat;
  onUpdate: (id: string, patch: Partial<AlCat>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount]   = useState(String(cat.budgeted));
  const [name, setName]       = useState(cat.name);
  const [emoji, setEmoji]     = useState(cat.emoji);
  const [saving, setSaving]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setAmount(String(cat.budgeted));
    setName(cat.name);
    setEmoji(cat.emoji);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function save() {
    setSaving(true);
    const patch = {
      name: name.trim() || cat.name,
      emoji: emoji.trim() || cat.emoji,
      budgeted: Math.max(0, parseFloat(amount) || 0),
    };
    try {
      await api(`/api/allowance/categories/${cat.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onUpdate(cat.id, patch);
      setEditing(false);
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Delete "${cat.name}"?`)) return;
    await api(`/api/allowance/categories/${cat.id}`, { method: "DELETE" });
    onDelete(cat.id);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 px-1">
        <input
          className="w-8 text-center text-lg border-none bg-transparent focus:outline-none"
          value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
        />
        <input
          className="flex-1 text-sm border-b border-teal-400 bg-transparent focus:outline-none text-ink-900 pb-0.5"
          value={name} onChange={e => setName(e.target.value)}
        />
        <span className="text-ink-400 text-xs">$</span>
        <input
          ref={inputRef}
          type="number" min="0" step="0.01"
          className="w-20 text-right text-sm border-b border-teal-400 bg-transparent focus:outline-none tabular-nums text-ink-900 pb-0.5"
          value={amount} onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        />
        <button type="button" onClick={save} disabled={saving}
          className="p-1 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-40">
          <Check size={14} />
        </button>
        <button type="button" onClick={() => setEditing(false)}
          className="p-1 rounded-lg text-ink-400 hover:bg-cream-100 transition-colors">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 px-1">
      <span className="text-xl w-7 text-center leading-none">{cat.emoji}</span>
      <span className="flex-1 text-sm font-medium text-ink-900">{cat.name}</span>
      <span className="text-sm font-semibold tabular-nums text-teal-700">{money(cat.budgeted)}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={startEdit}
          className="p-1.5 rounded-lg text-ink-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={remove}
          className="p-1.5 rounded-lg text-ink-400 hover:text-rust-600 hover:bg-rust-50 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

/* ── Add category form ───────────────────────────────── */
function AddCategoryForm({ userId, onAdd }: { userId: string; onAdd: (cat: AlCat) => void }) {
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState("");
  const [emoji, setEmoji] = useState("💰");
  const [busy, setBusy]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; id: string }>(`/api/allowance/categories/${userId}`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), emoji: emoji.trim() || "💰" }),
      });
      onAdd({ id: res.id, name: name.trim(), emoji: emoji.trim() || "💰", budgeted: 0, sort_order: 99 });
      setName(""); setEmoji("💰"); setOpen(false);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors py-1 px-1">
        <Plus size={13} />
        Add category
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1">
      <input
        className="w-8 text-center text-lg border-none bg-transparent focus:outline-none"
        value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
      />
      <input
        autoFocus
        className="flex-1 text-sm border-b border-teal-400 bg-transparent focus:outline-none text-ink-900 pb-0.5"
        placeholder="Category name"
        value={name} onChange={e => setName(e.target.value)}
      />
      <button type="submit" disabled={busy || !name.trim()}
        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 disabled:opacity-40 transition-colors">
        <Check size={14} />
      </button>
      <button type="button" onClick={() => setOpen(false)}
        className="p-1.5 rounded-lg text-ink-400 hover:bg-cream-100 transition-colors">
        <X size={14} />
      </button>
    </form>
  );
}

/* ── Add money modal ─────────────────────────────────── */
function AddMoneyModal({
  depName, userId, onClose, onAdded,
}: {
  depName: string;
  userId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) { setErr("Enter a positive amount."); return; }
    setBusy(true);
    try {
      await api(`/api/allowance/deposit/${userId}`, {
        method: "POST",
        body: JSON.stringify({ amount: val, note: note.trim() || undefined }),
      });
      onAdded();
      onClose();
    } catch (e: any) { setErr(e?.message || "Failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(27,42,51,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{
        background: "linear-gradient(145deg, #FFFDF8 0%, #FAF6EC 100%)",
        border: "1.5px solid #DDD7C8",
        boxShadow: "0 8px 32px rgba(27,66,67,0.18)",
      }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-ink-900"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Add money for {depName}
          </h3>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-cream-100">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 block">Amount ($)</label>
            <input
              autoFocus type="number" min="0.01" step="0.01"
              className="w-full h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
              placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 block">Note (optional)</label>
            <input
              className="w-full h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
              placeholder="e.g. Weekly allowance" value={note} onChange={e => setNote(e.target.value)}
            />
          </div>
          {err && <p className="text-xs text-rust-600">{err}</p>}
          <button type="submit" disabled={busy}
            className="w-full h-10 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#1B4243" }}>
            {busy ? "Adding…" : "Add money"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Budget panel (shared by both views) ─────────────── */
function BudgetPanel({
  userId, depName, isAdmin,
}: {
  userId: string;
  depName: string;
  isAdmin: boolean;
}) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = isAdmin
        ? `/api/allowance/budget/${userId}`
        : `/api/allowance/budget/me`;
      const res = await api<Budget>(url);
      setBudget(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [userId]);

  function updateCat(id: string, patch: Partial<AlCat>) {
    setBudget(prev => prev ? {
      ...prev,
      categories: prev.categories.map(c => c.id === id ? { ...c, ...patch } : c),
    } : prev);
  }

  function deleteCat(id: string) {
    setBudget(prev => prev ? {
      ...prev,
      categories: prev.categories.filter(c => c.id !== id),
    } : prev);
  }

  function addCat(cat: AlCat) {
    setBudget(prev => prev ? { ...prev, categories: [...prev.categories, cat] } : prev);
  }

  if (loading) return <div className="animate-pulse py-8 text-center text-sm text-ink-500">Loading…</div>;
  if (!budget) return <div className="py-8 text-center text-sm text-ink-500">Could not load allowance data.</div>;

  const totalBudgeted = budget.categories.reduce((s, c) => s + Number(c.budgeted), 0);
  const toAssign      = budget.totalDeposited - totalBudgeted;

  return (
    <div className="space-y-4">
      {/* ── Header card ─────────────────────────────── */}
      <div className="rounded-3xl border relative overflow-hidden" style={{
        background: "linear-gradient(160deg, #FDFAF2 0%, #F5EDD8 60%, #EAE4D0 100%)",
        borderColor: "#C9CBAA",
        boxShadow: "0 6px 32px rgba(27,66,67,0.09), 0 1px 0 rgba(255,255,255,0.85) inset",
      }}>
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full opacity-[0.10]"
          style={{ background: "radial-gradient(circle, #2D6E70 0%, transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #C17A3F 0%, transparent 70%)" }} />

        <div className="relative px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500 mb-1">
                {isAdmin ? `${depName}'s Allowance` : "My Allowance"}
              </div>
              <div className="text-4xl font-semibold tabular-nums text-teal-700 leading-none"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                {money(budget.totalDeposited)}
              </div>
              <div className="mt-2">
                <ToAssignPill value={toAssign} />
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddMoney(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white shrink-0 transition-all hover:opacity-90"
                style={{ background: "#1B4243" }}
              >
                <Plus size={13} />
                Add money
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Categories card ──────────────────────────── */}
      <Card>
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-1">Budget categories</div>
        <p className="text-xs text-ink-500 mb-3">Assign your money to give every dollar a job.</p>

        <div className="divide-y" style={{ borderColor: "rgba(237,231,216,0.6)" }}>
          {budget.categories.map(cat => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              onUpdate={updateCat}
              onDelete={deleteCat}
            />
          ))}
        </div>

        <div className="pt-2 border-t mt-1" style={{ borderColor: "rgba(237,231,216,0.6)" }}>
          <AddCategoryForm userId={userId} onAdd={addCat} />
        </div>

        {/* Totals footer */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-ink-500"
          style={{ borderColor: "rgba(237,231,216,0.6)" }}>
          <span>Total budgeted</span>
          <span className="font-semibold tabular-nums text-ink-900">{money(totalBudgeted)}</span>
        </div>
      </Card>

      {/* ── Recent deposits ──────────────────────────── */}
      {budget.deposits.length > 0 && (
        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-3">Recent deposits</div>
          <div className="space-y-2">
            {budget.deposits.map(dep => (
              <div key={dep.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {dep.note || "Allowance deposit"}
                  </div>
                  <div className="text-xs text-ink-500">
                    from {dep.added_by_name} · {timeAgo(dep.created_at)}
                  </div>
                </div>
                <span className="text-sm font-semibold text-teal-600 tabular-nums shrink-0">
                  +{money(dep.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {budget.deposits.length === 0 && (
        <div className="text-center py-6 text-sm text-ink-500">
          No deposits yet.{isAdmin ? ' Use "Add money" to fund this allowance.' : " Ask a parent to add your first deposit."}
        </div>
      )}

      {showAddMoney && (
        <AddMoneyModal
          depName={depName}
          userId={userId}
          onClose={() => setShowAddMoney(false)}
          onAdded={load}
        />
      )}
    </div>
  );
}

/* ── Dependent view ──────────────────────────────────── */
function DependentView() {
  const { user } = useUser();
  return <BudgetPanel userId={user!.userId} depName={user!.name} isAdmin={false} />;
}

/* ── Admin view ──────────────────────────────────────── */
function AdminView() {
  const [dependents, setDependents] = useState<DepMember[]>([]);
  const [selected, setSelected]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api<{ members: DepMember[] }>("/api/household")
      .then(r => {
        const deps = (r.members ?? []).filter(m => m.account_type === "dependent");
        setDependents(deps);
        if (deps.length === 1) setSelected(deps[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse py-8 text-center text-sm text-ink-500">Loading…</div>;

  if (dependents.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">👦</div>
          <p className="text-sm font-medium text-ink-900">No dependents yet</p>
          <p className="text-xs text-ink-500 mt-1">Add a dependent in Settings → Household.</p>
        </div>
      </Card>
    );
  }

  const selectedDep = dependents.find(d => d.id === selected);

  return (
    <div className="space-y-4">
      {/* Dependent selector (only shown when multiple) */}
      {dependents.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {dependents.map(dep => (
            <button
              key={dep.id}
              type="button"
              onClick={() => setSelected(dep.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
                selected === dep.id
                  ? "text-white border-transparent"
                  : "text-ink-500 border-cream-200 bg-cream-50 hover:bg-cream-100"
              )}
              style={selected === dep.id ? { background: "#1B4243" } : {}}
            >
              {dep.name}
            </button>
          ))}
        </div>
      )}

      {selectedDep ? (
        <BudgetPanel
          key={selectedDep.id}
          userId={selectedDep.id}
          depName={selectedDep.name}
          isAdmin
        />
      ) : (
        <p className="text-sm text-ink-500 text-center py-8">Select a dependent above.</p>
      )}
    </div>
  );
}

/* ── Main export ─────────────────────────────────────── */
export default function Allowance() {
  const { user } = useUser();
  const isParent = isAdminOrPrimary(user);

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-ink-900"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          Allowance
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">
          {isParent
            ? "Fund and manage your dependents' allowance budgets."
            : "Your personal budget — give every dollar a job."}
        </p>
      </div>
      {isParent ? <AdminView /> : <DependentView />}
    </div>
  );
}
