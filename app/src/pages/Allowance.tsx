import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { api } from "../lib/api";
import { cn, money } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { isAdminOrPrimary } from "../lib/permissions";

/* ── Types ───────────────────────────────────────────── */
type AlCat = {
  id: string; name: string; emoji: string;
  budgeted: number; activity: number; available: number; sort_order: number;
};
type AlDeposit = { id: string; amount: number; note: string | null; added_by_name: string; created_at: string };
type AlTx = {
  id: string; category_id: string; category_name: string;
  amount: number; direction: string; date: string; note: string | null; created_at: string;
};
type Budget = { totalDeposited: number; totalIncome: number; toAssign: number; categories: AlCat[]; deposits: AlDeposit[] };
type DepMember = { id: string; name: string; account_type?: string };

/* ── Helpers ─────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Card shell ──────────────────────────────────────── */
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
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums border",
      over ? "bg-rust-50 text-rust-600 border-rust-500/30" : "bg-teal-50 text-teal-600 border-teal-500/30"
    )}>
      {over ? `Over-assigned ${money(Math.abs(value))}` : `${money(value)} to assign`}
    </span>
  );
}

/* ── Add money modal ─────────────────────────────────── */
function AddMoneyModal({ depName, userId, onClose, onAdded }: {
  depName: string; userId: string; onClose: () => void; onAdded: () => void;
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
      onAdded(); onClose();
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
            className="p-1.5 rounded-lg text-ink-400 hover:bg-cream-100"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 block">Amount ($)</label>
            <input autoFocus type="number" min="0.01" step="0.01"
              className="w-full h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
              placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 block">Note (optional)</label>
            <input
              className="w-full h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
              placeholder="Weekly allowance" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {err && <p className="text-xs text-rust-600">{err}</p>}
          <button type="submit" disabled={busy}
            className="w-full h-10 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: "#1B4243" }}>
            {busy ? "Adding…" : "Add money"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Category row ────────────────────────────────────── */
function CategoryRow({ cat, isAdmin, isSelected, onUpdate, onDelete, onClick }: {
  cat: AlCat; isAdmin: boolean; isSelected: boolean;
  onUpdate: (id: string, patch: Partial<AlCat>) => void;
  onDelete: (id: string) => void;
  onClick: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName]   = useState(cat.name);
  const [emoji, setEmoji] = useState(cat.emoji);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const pct      = cat.budgeted > 0 ? Math.min((cat.activity / cat.budgeted) * 100, 100) : 0;
  const over     = cat.budgeted > 0 && cat.activity > cat.budgeted;
  const warn     = !over && pct >= 85;
  const barColor = over ? "#EF4444" : warn ? "#F59E0B" : "#2D6E70";

  async function saveName() {
    setSaving(true);
    const patch = { name: name.trim() || cat.name, emoji: emoji.trim() || cat.emoji };
    try {
      await api(`/api/allowance/categories/${cat.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      onUpdate(cat.id, patch);
      setEditingName(false);
    } finally { setSaving(false); }
  }

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${cat.name}"?`)) return;
    await api(`/api/allowance/categories/${cat.id}`, { method: "DELETE" });
    onDelete(cat.id);
  }

  if (editingName) {
    return (
      <div className="flex items-center gap-2 py-3 px-4">
        <input className="w-8 text-center text-lg bg-transparent border-none focus:outline-none"
          value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} />
        <input ref={nameRef} autoFocus
          className="flex-1 text-sm border-b border-teal-400 bg-transparent focus:outline-none text-ink-900 pb-0.5"
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") saveName();
            if (e.key === "Escape") { setEditingName(false); setName(cat.name); setEmoji(cat.emoji); }
          }} />
        <button type="button" onClick={saveName} disabled={saving}
          className="p-1 rounded-lg text-teal-600 hover:bg-teal-50 disabled:opacity-40"><Check size={14} /></button>
        <button type="button" onClick={() => { setEditingName(false); setName(cat.name); setEmoji(cat.emoji); }}
          className="p-1 rounded-lg text-ink-400 hover:bg-cream-100"><X size={14} /></button>
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick}
      className={cn("w-full text-left px-4 py-3 transition-colors group",
        isSelected ? "bg-teal-50/40" : "bg-white hover:bg-cream-50/60")}>
      <div className="flex items-center gap-3">
        <span className="text-xl w-7 text-center leading-none shrink-0">{cat.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-ink-900 truncate">{cat.name}</span>
            <span className={cn("text-sm font-semibold tabular-nums ml-2 shrink-0",
              over ? "text-rust-600" : "text-teal-600")}>
              {money(cat.available)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-cream-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <div className="flex gap-3 text-xs text-ink-500 mt-1">
            <span>Budget <span className="tabular-nums font-medium">{money(cat.budgeted)}</span></span>
            <span>Spent <span className="tabular-nums font-medium">{money(cat.activity)}</span></span>
          </div>
        </div>
        <div className={cn("flex items-center gap-0.5 shrink-0 ml-1",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity")}>
          {!isAdmin && (
            <button type="button"
              onClick={e => { e.stopPropagation(); setEditingName(true); setTimeout(() => nameRef.current?.focus(), 50); }}
              className="p-1.5 rounded-lg text-ink-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
              <Pencil size={12} />
            </button>
          )}
          <button type="button" onClick={remove}
            className="p-1.5 rounded-lg text-ink-400 hover:text-rust-600 hover:bg-rust-50 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </button>
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
      onAdd({ id: res.id, name: name.trim(), emoji: emoji.trim() || "💰", budgeted: 0, activity: 0, available: 0, sort_order: 99 });
      setName(""); setEmoji("💰"); setOpen(false);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-teal-600 hover:text-teal-700 w-full transition-colors">
        <Plus size={13} /> Add category
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-4 py-2">
      <input className="w-8 text-center text-lg bg-transparent border-none focus:outline-none"
        value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} />
      <input autoFocus
        className="flex-1 text-sm border-b border-teal-400 bg-transparent focus:outline-none text-ink-900 pb-0.5"
        placeholder="Category name" value={name} onChange={e => setName(e.target.value)} />
      <button type="submit" disabled={busy || !name.trim()}
        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 disabled:opacity-40"><Check size={14} /></button>
      <button type="button" onClick={() => setOpen(false)}
        className="p-1.5 rounded-lg text-ink-400 hover:bg-cream-100"><X size={14} /></button>
    </form>
  );
}

/* ── Main budget panel ───────────────────────────────── */
function BudgetPanel({ userId, depName, isAdmin }: { userId: string; depName: string; isAdmin: boolean }) {
  const [budget, setBudget]           = useState<Budget | null>(null);
  const [txns, setTxns]               = useState<AlTx[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [search, setSearch]           = useState("");

  /* Transaction form (dependent only) */
  const [txDir, setTxDir]       = useState<"out" | "in">("out");
  const [txCatId, setTxCatId]   = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [txNote, setTxNote]     = useState("");
  const [txBusy, setTxBusy]     = useState(false);
  const [txMsg, setTxMsg]       = useState<string | null>(null);

  /* Category budget edit */
  const [setAmt, setSetAmt]         = useState("");
  const [adjustAmt, setAdjustAmt]   = useState("");
  const [catBusy, setCatBusy]       = useState(false);
  const [catMsg, setCatMsg]         = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const budgetUrl = isAdmin ? `/api/allowance/budget/${userId}` : `/api/allowance/budget/me`;
      const txUrl     = isAdmin ? `/api/allowance/txns/${userId}`   : `/api/allowance/txns/me`;
      const [budgetRes, txRes] = await Promise.all([
        api<Budget>(budgetUrl),
        api<{ transactions: AlTx[] }>(txUrl).catch(() => ({ transactions: [] })),
      ]);
      setBudget(budgetRes);
      setTxns(txRes.transactions ?? []);
      setSelectedCatId(prev => {
        const cats = budgetRes.categories ?? [];
        if (prev && cats.some(c => c.id === prev)) return prev;
        return cats[0]?.id ?? null;
      });
      setTxCatId(prev => {
        const cats = budgetRes.categories ?? [];
        if (prev && cats.some(c => c.id === prev)) return prev;
        return cats[0]?.id ?? "";
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [userId]);

  function updateCat(id: string, patch: Partial<AlCat>) {
    setBudget(prev => prev ? {
      ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, ...patch } : c),
    } : prev);
  }

  function deleteCat(id: string) {
    setBudget(prev => prev ? {
      ...prev, categories: prev.categories.filter(c => c.id !== id),
    } : prev);
    if (selectedCatId === id) setSelectedCatId(null);
  }

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault(); setCatMsg(null);
    if (!selectedCatId || !setAmt) return;
    const amount = parseFloat(setAmt);
    if (isNaN(amount) || amount < 0) { setCatMsg("Enter a valid amount."); return; }
    setCatBusy(true);
    try {
      await api(`/api/allowance/categories/${selectedCatId}`, {
        method: "PATCH", body: JSON.stringify({ budgeted: amount }),
      });
      setSetAmt(""); setCatMsg("Updated.");
      await load();
    } catch { setCatMsg("Failed."); } finally { setCatBusy(false); }
  }

  async function handleAdjust(dir: 1 | -1) {
    setCatMsg(null);
    if (!selectedCatId || !adjustAmt) return;
    const amount = parseFloat(adjustAmt);
    if (isNaN(amount) || amount <= 0) { setCatMsg("Enter a valid amount."); return; }
    const cat = budget?.categories.find(c => c.id === selectedCatId);
    if (!cat) return;
    const newBudget = Math.max(0, Math.round((cat.budgeted + dir * amount) * 100) / 100);
    setCatBusy(true);
    try {
      await api(`/api/allowance/categories/${selectedCatId}`, {
        method: "PATCH", body: JSON.stringify({ budgeted: newBudget }),
      });
      setAdjustAmt(""); setCatMsg(`${dir > 0 ? "Increased" : "Decreased"} by ${money(amount)}.`);
      await load();
    } catch { setCatMsg("Failed."); } finally { setCatBusy(false); }
  }

  async function submitTransaction(e: React.FormEvent) {
    e.preventDefault(); setTxMsg(null);
    const n = parseFloat(txAmount);
    if (!txAmount || isNaN(n) || n <= 0) { setTxMsg("Enter a valid amount."); return; }
    if (txDir === "out" && !txCatId) { setTxMsg("Pick a category."); return; }
    setTxBusy(true);
    try {
      await api("/api/allowance/txns/me", {
        method: "POST",
        body: JSON.stringify({
          categoryId: txDir === "in" ? "income" : txCatId,
          amount: n, direction: txDir,
          date: txDate,
          note: txNote.trim() || undefined,
        }),
      });
      setTxAmount(""); setTxNote("");
      setTxMsg(txDir === "in" ? "Income added!" : "Transaction saved!");
      await load();
    } catch (e: any) { setTxMsg(e?.message || "Error saving."); }
    finally { setTxBusy(false); }
  }

  async function deleteTransaction(id: string) {
    await api(`/api/allowance/txns/entry/${id}`, { method: "DELETE" });
    setTxns(prev => prev.filter(t => t.id !== id));
    await load();
  }

  if (loading) return <div className="animate-pulse py-8 text-center text-sm text-ink-500">Loading…</div>;
  if (!budget)  return <div className="py-8 text-center text-sm text-ink-500">Could not load allowance data.</div>;

  const balance     = Math.round((budget.totalDeposited + budget.totalIncome) * 100) / 100;
  const selectedCat = budget.categories.find(c => c.id === selectedCatId) ?? null;
  const filteredTxns = search.trim()
    ? txns.filter(t =>
        t.category_name.toLowerCase().includes(search.toLowerCase()) ||
        (t.note ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : txns;

  const inputCls = "h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

  return (
    <div className="space-y-4">

      {/* ── Header card ─────────────────────────────── */}
      <div className="rounded-3xl border relative overflow-hidden" style={{
        background: "linear-gradient(160deg, #FDFAF2 0%, #F5EDD8 60%, #EAE4D0 100%)",
        borderColor: "#C9CBAA",
        boxShadow: "0 6px 32px rgba(27,66,67,0.09), 0 1px 0 rgba(255,255,255,0.85) inset",
      }}>
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
                {money(balance)}
              </div>
              <div className="mt-2">
                <ToAssignPill value={budget.toAssign} />
              </div>
            </div>
            {isAdmin && (
              <button type="button" onClick={() => setShowAddMoney(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white shrink-0 transition-all hover:opacity-90"
                style={{ background: "#1B4243" }}>
                <Plus size={13} /> Add money
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction log (dependent only) ─────────── */}
      {!isAdmin && (
        <div className="rounded-2xl p-5 shadow-lg" style={{ background: "#1B4243" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-rust-500 animate-pulse" />
            <span className="text-sm font-semibold text-white">Log a Transaction</span>
            <span className="text-xs text-teal-300 ml-auto">Quick entry</span>
          </div>

          <div className="inline-flex rounded-xl border border-teal-900 bg-teal-800 p-1 mb-4">
            {(["out", "in"] as const).map(dir => (
              <button key={dir} type="button"
                onClick={() => { setTxDir(dir); setTxNote(""); }}
                className={cn("rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                  txDir === dir ? "text-white shadow-sm" : "text-ink-500 hover:text-white")}
                style={txDir === dir ? { background: dir === "out" ? "#C17A3F" : "#2D6E70" } : {}}>
                {dir === "out" ? "Outflow" : "Income"}
              </button>
            ))}
          </div>

          <form onSubmit={submitTransaction} className="space-y-3">
            <div className={cn("grid gap-3", txDir === "out" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              {txDir === "out" && (
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">Category</span>
                  <select
                    className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 transition-all"
                    value={txCatId} onChange={e => setTxCatId(e.target.value)}>
                    {budget.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">Amount</span>
                <input
                  className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 transition-all tabular-nums"
                  value={txAmount} onChange={e => setTxAmount(e.target.value)}
                  placeholder="0.00" inputMode="decimal" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">Date</span>
                <input type="date"
                  className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 transition-all"
                  value={txDate} onChange={e => setTxDate(e.target.value)} />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                {txDir === "in" ? "Source (birthday money, chores, etc.)" : "Note (optional)"}
              </span>
              <input
                className="h-10 rounded-xl border border-teal-900 bg-teal-800 px-3 text-sm text-white outline-none focus:border-teal-400 transition-all"
                value={txNote} onChange={e => setTxNote(e.target.value)}
                placeholder={txDir === "in" ? "Birthday money, chore reward…" : "What was this for?"} />
            </label>
            <button type="submit" disabled={txBusy}
              className="h-10 w-full rounded-xl text-sm font-semibold text-ink-900 hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: "#C17A3F" }}>
              {txBusy ? "Saving…" : txDir === "in" ? "Add income" : "Record spending"}
            </button>
            {txMsg && (
              <div className={cn("text-sm text-center",
                txMsg.includes("Error") || txMsg.includes("error") ? "text-rust-400" : "text-teal-300")}>
                {txMsg}
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── Categories + right panel ──────────────────── */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_280px]">

        {/* Category list */}
        <div className="rounded-2xl border overflow-hidden" style={{
          background: "linear-gradient(145deg, #FFFDF8 0%, #FAF6EC 100%)",
          borderColor: "#DDD7C8",
          boxShadow: "0 1px 3px rgba(27,66,67,0.04), 0 4px 16px rgba(27,66,67,0.06)",
        }}>
          <div className="hidden lg:grid lg:grid-cols-[1fr_90px_90px_90px_48px] gap-2 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider text-ink-500"
            style={{ borderColor: "#DDD7C8" }}>
            <div>Category</div>
            <div className="text-right">Budgeted</div>
            <div className="text-right">Spent</div>
            <div className="text-right">Available</div>
            <div />
          </div>

          {budget.categories.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-500">No categories yet.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(237,231,216,0.6)" }}>
              {budget.categories.map(cat => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  isAdmin={isAdmin}
                  isSelected={cat.id === selectedCatId}
                  onUpdate={updateCat}
                  onDelete={deleteCat}
                  onClick={() => setSelectedCatId(cat.id === selectedCatId ? null : cat.id)}
                />
              ))}
            </div>
          )}

          {!isAdmin && (
            <div className="border-t" style={{ borderColor: "rgba(237,231,216,0.6)" }}>
              <AddCategoryForm userId={userId} onAdd={cat => {
                setBudget(prev => prev ? { ...prev, categories: [...prev.categories, cat] } : prev);
              }} />
            </div>
          )}

          <div className="px-5 py-3 border-t flex items-center justify-between text-xs text-ink-500"
            style={{ borderColor: "rgba(237,231,216,0.6)" }}>
            <span>Total budgeted</span>
            <span className="font-semibold tabular-nums text-ink-900">
              {money(budget.categories.reduce((s, c) => s + c.budgeted, 0))}
            </span>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-3">

          {/* Category detail + edit */}
          <Card>
            {selectedCat ? (
              <>
                <div className="text-sm font-semibold text-ink-900 mb-0.5">
                  {selectedCat.emoji} {selectedCat.name}
                </div>
                <div className="text-xs text-ink-500 mb-4">
                  {isAdmin ? "Category breakdown" : "Click any category to edit its budget"}
                </div>
                <div className="space-y-2 rounded-xl bg-cream-50 border border-cream-100 p-3 text-sm mb-4">
                  {([
                    ["Budgeted",  selectedCat.budgeted],
                    ["Spent",     selectedCat.activity],
                    ["Available", selectedCat.available],
                  ] as [string, number][]).map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between">
                      <span className="text-ink-500">{lbl}</span>
                      <span className={cn("font-semibold tabular-nums",
                        lbl === "Available" && val < 0 ? "text-rust-600" :
                        lbl === "Available" ? "text-teal-600" : "text-ink-900")}>
                        {money(val)}
                      </span>
                    </div>
                  ))}
                </div>

                {!isAdmin && (
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-500 block mb-1.5">Set budget</span>
                      <form onSubmit={handleSetBudget} className="flex gap-2">
                        <input value={setAmt} onChange={e => setSetAmt(e.target.value)}
                          placeholder="Exact amount" inputMode="decimal"
                          className={cn(inputCls, "flex-1 min-w-0 tabular-nums")} />
                        <button type="submit" disabled={catBusy}
                          className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 transition-all"
                          style={{ background: "#1B4243" }}>Set</button>
                      </form>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-500 block mb-1.5">Adjust</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleAdjust(-1)} disabled={catBusy}
                          className="h-10 w-10 shrink-0 rounded-xl border border-cream-200 text-lg font-bold text-rust-600 hover:bg-rust-50 disabled:opacity-50 transition-all">−</button>
                        <input value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)}
                          placeholder="Amount" inputMode="decimal"
                          className={cn(inputCls, "flex-1 min-w-0 tabular-nums text-center")} />
                        <button type="button" onClick={() => handleAdjust(1)} disabled={catBusy}
                          className="h-10 w-10 shrink-0 rounded-xl border border-cream-200 text-lg font-bold text-teal-600 hover:bg-teal-50 disabled:opacity-50 transition-all">+</button>
                      </div>
                    </div>
                    {catMsg && (
                      <p className={cn("text-xs", catMsg.includes("Failed") ? "text-rust-600" : "text-teal-600")}>{catMsg}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-500">
                {isAdmin ? "Click a category to view details." : "Click a category to set its budget."}
              </p>
            )}
          </Card>

          {/* Recent deposits */}
          {budget.deposits.length > 0 && (
            <Card>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-3">Recent deposits</div>
              <div className="space-y-2">
                {budget.deposits.slice(0, 5).map(dep => (
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
            <div className="text-center py-4 text-sm text-ink-500">
              {isAdmin
                ? 'No deposits yet. Use "Add money" to fund this allowance.'
                : "No deposits yet. Ask a parent to add your first allowance."}
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction history ──────────────────────── */}
      <div className="rounded-2xl border overflow-hidden" style={{
        background: "linear-gradient(145deg, #FFFDF8 0%, #FAF6EC 100%)",
        borderColor: "#DDD7C8",
        boxShadow: "0 1px 3px rgba(27,66,67,0.04), 0 4px 16px rgba(27,66,67,0.06)",
      }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#DDD7C8" }}>
          <div>
            <div className="text-sm font-semibold text-ink-900">Transactions</div>
            <div className="text-xs text-ink-500">{txns.length} total</div>
          </div>
          <input
            className="h-9 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm outline-none focus:border-teal-500 transition-all w-36"
            placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(237,231,216,0.6)" }}>
          {filteredTxns.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-ink-500">
              {txns.length === 0 ? "No transactions yet." : "No matches for your search."}
            </div>
          )}
          {filteredTxns.map(tx => {
            const isIncome = tx.direction === "in";
            return (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-100/40 transition-colors">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                  isIncome ? "bg-teal-50 text-teal-600" : "bg-cream-100 text-ink-500"
                )}>
                  {isIncome ? "+" : "−"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-semibold tabular-nums", isIncome ? "text-teal-600" : "text-ink-900")}>
                    {isIncome ? "+" : ""}{money(tx.amount)}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 truncate">
                    {isIncome ? "Income" : tx.category_name} · {tx.date}{tx.note ? ` · ${tx.note}` : ""}
                  </div>
                </div>
                {!isAdmin && (
                  <button type="button" onClick={() => deleteTransaction(tx.id)}
                    className="shrink-0 rounded-lg border border-cream-200 px-2.5 py-1.5 text-xs font-medium text-ink-500 hover:bg-cream-100 transition-all">
                    Undo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
      <div className="rounded-2xl border p-8 text-center" style={{
        background: "linear-gradient(145deg, #FFFDF8 0%, #FAF6EC 100%)", borderColor: "#DDD7C8",
      }}>
        <div className="text-4xl mb-3">👦</div>
        <p className="text-sm font-medium text-ink-900">No dependents yet</p>
        <p className="text-xs text-ink-500 mt-1">Add a dependent in Settings → Household.</p>
      </div>
    );
  }

  const selectedDep = dependents.find(d => d.id === selected);

  return (
    <div className="space-y-4">
      {dependents.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {dependents.map(dep => (
            <button key={dep.id} type="button" onClick={() => setSelected(dep.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
                selected === dep.id
                  ? "text-white border-transparent"
                  : "text-ink-500 border-cream-200 bg-cream-50 hover:bg-cream-100"
              )}
              style={selected === dep.id ? { background: "#1B4243" } : {}}>
              {dep.name}
            </button>
          ))}
        </div>
      )}
      {selectedDep ? (
        <BudgetPanel key={selectedDep.id} userId={selectedDep.id} depName={selectedDep.name} isAdmin />
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
    <div className="space-y-5 max-w-2xl">
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
