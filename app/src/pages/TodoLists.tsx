import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, X, Check, ListTodo, Repeat, Users, User } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { canAccess } from "../lib/permissions";

function localReset2am(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0).toISOString();
}

type Member  = { id: string; name: string };
type TodoList = {
  id: string; title: string; list_type: "daily" | "onetime";
  owner_user_id: string | null; owner_name: string | null; created_at: string;
};
type TodoItem = { id: string; title: string; completed: number; completed_at: string | null; created_at: string };

const inputCls =
  "h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-ink-400";

// ── Owner badge ───────────────────────────────────────────────────────────────
function OwnerBadge({ list, currentUserId }: { list: TodoList; currentUserId: string }) {
  if (!list.owner_user_id) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">
        <Users size={9} /> Family
      </span>
    );
  }
  const label = list.owner_user_id === currentUserId ? "Just me" : (list.owner_name ?? "Personal");
  return (
    <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
      <User size={9} /> {label}
    </span>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, onToggle, onDelete }: {
  item: TodoItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const done = !!item.completed;
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all group",
      done ? "border-cream-100 bg-cream-50/60 opacity-60" : "border-cream-200 bg-white",
    )}>
      <button type="button" onClick={onToggle}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className={cn(
          "shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
          done ? "bg-teal-500 border-teal-500 text-white" : "border-cream-300 hover:border-teal-500 bg-white",
        )}>
        {done && <Check size={11} strokeWidth={3} />}
      </button>
      <span className={cn("flex-1 text-sm leading-snug", done ? "line-through text-ink-400" : "text-ink-900")}>
        {item.title}
      </span>
      <button type="button" onClick={onDelete}
        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-lg p-1 text-ink-400 hover:text-rust-600 hover:bg-rust-50 transition-all"
        aria-label="Delete item">
        <X size={13} />
      </button>
    </div>
  );
}

// ── New list modal ────────────────────────────────────────────────────────────
function NewListModal({ members, currentUserId, onSave, onClose }: {
  members: Member[];
  currentUserId: string;
  onSave: (title: string, type: "daily" | "onetime", ownerUserId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle]   = useState("");
  const [type, setType]     = useState<"daily" | "onetime">("onetime");
  const [ownedBy, setOwnedBy] = useState<string>("family"); // "family" | userId
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave(title.trim(), type, ownedBy === "family" ? null : ownedBy);
    setSaving(false);
  }

  const ownerOptions: { id: string; label: string; desc: string }[] = [
    { id: "family", label: "Whole family", desc: "Visible to all members" },
    { id: currentUserId, label: "Just me", desc: "Only you can see this" },
    ...members
      .filter(m => m.id !== currentUserId)
      .map(m => ({ id: m.id, label: m.name, desc: `Only ${m.name} can see this` })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold text-ink-900">New list</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-cream-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">List name</label>
            <input ref={inputRef} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare for trip" className={cn(inputCls, "w-full")} required />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "onetime", label: "One-time", icon: ListTodo, desc: "Completes and stays done" },
                { id: "daily",   label: "Daily",    icon: Repeat,   desc: "Resets every day at 2 am" },
              ] as const).map(({ id, label, icon: Icon, desc }) => (
                <button key={id} type="button" onClick={() => setType(id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                    type === id ? "border-teal-500 bg-teal-50/60 shadow-sm" : "border-cream-200 bg-white hover:border-cream-300",
                  )}>
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} className={type === id ? "text-teal-600" : "text-ink-500"} />
                    <span className={cn("text-xs font-semibold", type === id ? "text-teal-700" : "text-ink-900")}>{label}</span>
                  </div>
                  <span className="text-[10px] text-ink-400 leading-snug">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">For</label>
            <div className="space-y-1.5">
              {ownerOptions.map(({ id, label, desc }) => {
                const sel = ownedBy === id;
                const Icon = id === "family" ? Users : User;
                return (
                  <button key={id} type="button" onClick={() => setOwnedBy(id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                      sel ? "border-teal-500 bg-teal-50/60" : "border-cream-200 bg-white hover:border-cream-300",
                    )}>
                    <div className={cn("h-7 w-7 shrink-0 rounded-lg flex items-center justify-center",
                      sel ? "bg-teal-100" : "bg-cream-100")}>
                      <Icon size={14} className={sel ? "text-teal-600" : "text-ink-500"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium", sel ? "text-teal-700" : "text-ink-900")}>{label}</div>
                      <div className="text-[10px] text-ink-400">{desc}</div>
                    </div>
                    {sel && (
                      <div className="shrink-0 h-4 w-4 rounded-full bg-teal-500 flex items-center justify-center">
                        <Check size={9} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={saving || !title.trim()}
            className="h-10 w-full rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-all">
            {saving ? "Creating…" : "Create list"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function LockedPage({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-14 w-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: "rgba(27,66,67,0.08)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B4243" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <p className="text-base font-semibold text-ink-900" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>{label} is locked</p>
      <p className="text-sm text-ink-500 mt-1">Ask a parent to enable this feature.</p>
    </div>
  );
}

export default function TodoLists() {
  const { user } = useUser();
  if (!canAccess(user, "can_see_todo")) return <LockedPage label="To-do lists" />;
  const currentUserId = user?.userId ?? "";

  const [lists, setLists]       = useState<TodoList[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems]       = useState<TodoItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showNewList, setShowNewList]   = useState(false);
  const [newItem, setNewItem]   = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  async function loadLists() {
    try {
      const res = await api<{ lists: TodoList[] }>("/api/todo/lists");
      const fetched = res.lists ?? [];
      setLists(fetched);
      return fetched;
    } catch {
      setMsg("Failed to load lists.");
      return [];
    }
  }

  async function loadItems(listId: string) {
    setItemsLoading(true);
    try {
      const res = await api<{ items: TodoItem[] }>(`/api/todo/lists/${listId}/items`, {
        query: { resetBefore: localReset2am() },
      });
      setItems(res.items ?? []);
    } catch {
      setMsg("Failed to load items.");
    } finally {
      setItemsLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadLists(),
      api<{ members: Member[] }>("/api/household").then(r => setMembers(r.members ?? [])).catch(() => {}),
    ]).then(([fetched]) => {
      if (fetched.length > 0) {
        setActiveId(fetched[0].id);
        loadItems(fetched[0].id);
      }
    }).finally(() => setLoading(false));
  }, []);

  async function selectList(id: string) {
    setActiveId(id);
    setItems([]);
    await loadItems(id);
  }

  async function createList(title: string, type: "daily" | "onetime", ownerUserId: string | null) {
    try {
      const res = await api<{ ok: boolean; id: string }>("/api/todo/lists", {
        method: "POST",
        body: JSON.stringify({ title, listType: type, ownerUserId }),
      });
      setShowNewList(false);
      const fetched = await loadLists();
      const created = fetched.find((l) => l.id === res.id);
      if (created) {
        setActiveId(created.id);
        await loadItems(created.id);
      }
    } catch {
      setMsg("Failed to create list.");
    }
  }

  async function deleteList(id: string, title: string) {
    if (!confirm(`Delete list "${title}" and all its items?`)) return;
    try {
      await api(`/api/todo/lists/${id}`, { method: "DELETE" });
      const fetched = await loadLists();
      if (fetched.length > 0) {
        setActiveId(fetched[0].id);
        await loadItems(fetched[0].id);
      } else {
        setActiveId(null);
        setItems([]);
      }
    } catch {
      setMsg("Failed to delete list.");
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const t = newItem.trim();
    if (!t || !activeId) return;
    setAddingItem(true);
    try {
      await api(`/api/todo/lists/${activeId}/items`, {
        method: "POST",
        body: JSON.stringify({ title: t }),
      });
      setNewItem("");
      await loadItems(activeId);
      addInputRef.current?.focus();
    } catch {
      setMsg("Failed to add item.");
    } finally {
      setAddingItem(false);
    }
  }

  async function toggleItem(itemId: string) {
    try {
      setItems((prev) =>
        prev.map((i) => i.id === itemId
          ? { ...i, completed: i.completed ? 0 : 1, completed_at: i.completed ? null : new Date().toISOString() }
          : i)
      );
      await api(`/api/todo/items/${itemId}`, { method: "PATCH" });
    } catch {
      if (activeId) await loadItems(activeId);
    }
  }

  async function deleteItem(itemId: string) {
    try {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      await api(`/api/todo/items/${itemId}`, { method: "DELETE" });
    } catch {
      if (activeId) await loadItems(activeId);
    }
  }

  const activeList = lists.find((l) => l.id === activeId);
  const active     = items.filter((i) => !i.completed);
  const completed  = items.filter((i) => !!i.completed);

  // Group lists: family first, then personal
  const familyLists   = lists.filter(l => !l.owner_user_id);
  const personalLists = lists.filter(l => !!l.owner_user_id);

  function ListButton({ list }: { list: TodoList }) {
    const sel = list.id === activeId;
    const Icon = list.list_type === "daily" ? Repeat : ListTodo;
    return (
      <button type="button" onClick={() => selectList(list.id)}
        className={cn(
          "flex shrink-0 lg:w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all",
          sel ? "border-teal-500 bg-teal-50 text-teal-800 shadow-sm" : "border-cream-200 bg-white text-ink-700 hover:border-cream-300 hover:bg-cream-50",
        )}>
        <Icon size={13} className={sel ? "text-teal-500 shrink-0" : "text-ink-400 shrink-0"} />
        <span className="flex-1 truncate text-sm">{list.title}</span>
        <OwnerBadge list={list} currentUserId={currentUserId} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start">
      {showNewList && (
        <NewListModal
          members={members}
          currentUserId={currentUserId}
          onSave={createList}
          onClose={() => setShowNewList(false)}
        />
      )}

      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 rounded-xl border border-rust-600/30 bg-rust-50 px-4 py-2.5 text-sm text-rust-600 shadow-lg flex items-center gap-2">
          {msg}
          <button onClick={() => setMsg(null)}><X size={13} /></button>
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────── */}
      <div className="lg:w-60 lg:shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">My lists</p>
          <button type="button" onClick={() => setShowNewList(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors">
            <Plus size={13} /> New
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-11 rounded-xl bg-cream-100 animate-pulse" />)}
          </div>
        ) : lists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-cream-300 p-4 text-center">
            <p className="text-xs text-ink-500">No lists yet</p>
            <button type="button" onClick={() => setShowNewList(true)}
              className="mt-2 text-xs font-semibold text-teal-600 hover:underline">
              Create your first list
            </button>
          </div>
        ) : (
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0 lg:overflow-x-visible lg:space-y-3">
            {familyLists.length > 0 && (
              <div className="space-y-1.5 shrink-0 lg:shrink">
                <p className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-ink-400 px-1">Family</p>
                <div className="flex lg:flex-col gap-1.5">
                  {familyLists.map(l => <ListButton key={l.id} list={l} />)}
                </div>
              </div>
            )}
            {personalLists.length > 0 && (
              <div className="space-y-1.5 shrink-0 lg:shrink">
                <p className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-ink-400 px-1">Personal</p>
                <div className="flex lg:flex-col gap-1.5">
                  {personalLists.map(l => <ListButton key={l.id} list={l} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Items panel ──────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {!activeList ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="text-4xl">📋</div>
            <p className="text-sm text-ink-500">Select a list or create a new one.</p>
            <button type="button" onClick={() => setShowNewList(true)}
              className="h-9 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600 transition-all">
              + New list
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-cream-200 bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-cream-100">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-display text-base font-semibold text-ink-900 truncate">{activeList.title}</p>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1",
                  activeList.list_type === "daily" ? "bg-teal-50 text-teal-700" : "bg-cream-100 text-ink-500",
                )}>
                  {activeList.list_type === "daily"
                    ? <><Repeat size={9} /> Daily</>
                    : <><ListTodo size={9} /> One-time</>}
                </span>
                <OwnerBadge list={activeList} currentUserId={currentUserId} />
              </div>
              <button type="button" onClick={() => deleteList(activeList.id, activeList.title)}
                className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:text-rust-600 hover:bg-rust-50 transition-colors"
                aria-label="Delete list">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Add item */}
            <form onSubmit={addItem} className="flex items-center gap-2 px-4 py-3 border-b border-cream-100">
              <input ref={addInputRef} value={newItem} onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add an item…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-ink-400 text-ink-900" />
              <button type="submit" disabled={addingItem || !newItem.trim()}
                className="shrink-0 flex items-center gap-1.5 h-8 rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-40 transition-all">
                <Plus size={13} /> Add
              </button>
            </form>

            {/* Items */}
            <div className={cn("p-4 space-y-2 transition-opacity duration-150", itemsLoading && "opacity-40 pointer-events-none")}>
              {itemsLoading && active.length === 0 && completed.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-8 text-ink-400">
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              )}
              {active.length === 0 && completed.length > 0 && (
                <div className="flex flex-col items-center py-4 gap-1">
                  <span className="text-xl">🎉</span>
                  <p className="text-xs text-ink-500">All done!</p>
                </div>
              )}
              {active.length === 0 && completed.length === 0 && !itemsLoading && (
                <div className="py-8 text-center">
                  <p className="text-sm text-ink-400">Nothing here yet — add your first item above.</p>
                </div>
              )}
              {active.map((item) => (
                <ItemRow key={item.id} item={item}
                  onToggle={() => toggleItem(item.id)}
                  onDelete={() => deleteItem(item.id)} />
              ))}
              {completed.length > 0 && (
                <div className="mt-4 pt-4 border-t border-cream-100">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">
                    Completed ({completed.length})
                  </p>
                  <div className="space-y-1.5">
                    {completed.map((item) => (
                      <ItemRow key={item.id} item={item}
                        onToggle={() => toggleItem(item.id)}
                        onDelete={() => deleteItem(item.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
