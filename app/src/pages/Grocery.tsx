import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type GroceryList = {
  id: string;
  name: string;
  created_at: string;
  total_items: number;
  checked_items: number;
};

type GroceryItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  checked: number;
  added_by: string;
  added_by_name: string | null;
};

const inputCls =
  "h-10 rounded-xl border border-[#E8E2D9] bg-white px-3 text-sm text-[#0B2A4A] outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/20 transition-all placeholder:text-[#5C6B7A]";

export default function Grocery() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadLists() {
    try {
      const res = await api<{ lists: GroceryList[] }>("/api/grocery/lists");
      setLists(res.lists ?? []);
    } catch {
      setMsg("Failed to load lists.");
    }
  }

  async function loadItems(listId: string) {
    setItemsLoading(true);
    try {
      const res = await api<{ items: GroceryItem[] }>(`/api/grocery/lists/${listId}/items`);
      setItems(res.items ?? []);
    } catch {
      setMsg("Failed to load items.");
    } finally {
      setItemsLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadLists().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activeListId) return;
    loadItems(activeListId);
    pollRef.current = setInterval(() => loadItems(activeListId), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeListId]);

  async function createList() {
    const name = newListName.trim();
    if (!name) return;
    setAddingList(true);
    try {
      await api("/api/grocery/lists", { method: "POST", body: JSON.stringify({ name }) });
      setNewListName(""); setShowNewList(false);
      await loadLists();
    } catch { setMsg("Failed to create list."); }
    finally { setAddingList(false); }
  }

  async function deleteList(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" and all its items?`)) return;
    try {
      await api(`/api/grocery/lists/${id}`, { method: "DELETE" });
      if (activeListId === id) setActiveListId(null);
      await loadLists();
    } catch { setMsg("Failed to delete list."); }
  }

  async function addItem() {
    const name = newItemName.trim();
    if (!name || !activeListId) return;
    setAddingItem(true);
    try {
      await api(`/api/grocery/lists/${activeListId}/items`, {
        method: "POST",
        body: JSON.stringify({ name, quantity: newItemQty.trim() || undefined }),
      });
      setNewItemName(""); setNewItemQty("");
      await Promise.all([loadItems(activeListId), loadLists()]);
    } catch { setMsg("Failed to add item."); }
    finally { setAddingItem(false); }
  }

  async function toggleCheck(itemId: string) {
    if (!activeListId) return;
    try {
      await api(`/api/grocery/items/${itemId}/check`, { method: "PATCH" });
      await Promise.all([loadItems(activeListId), loadLists()]);
    } catch { setMsg("Failed to update item."); }
  }

  async function deleteItem(itemId: string) {
    if (!activeListId) return;
    try {
      await api(`/api/grocery/items/${itemId}`, { method: "DELETE" });
      await Promise.all([loadItems(activeListId), loadLists()]);
    } catch { setMsg("Failed to delete item."); }
  }

  async function clearChecked() {
    if (!activeListId) return;
    try {
      await api(`/api/grocery/lists/${activeListId}/clear-checked`, { method: "POST" });
      await Promise.all([loadItems(activeListId), loadLists()]);
    } catch { setMsg("Failed to clear items."); }
  }

  const activeList = lists.find((l) => l.id === activeListId);
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  // ── Items view ──────────────────────────────────────
  if (activeListId && activeList) {
    return (
      <div className="space-y-4">
        {msg && (
          <div className="rounded-xl border border-[#B8791F]/30 bg-[#FDF3E3] px-4 py-2.5 text-sm text-[#B8791F]">{msg}</div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => { setActiveListId(null); setItems([]); setMsg(null); }}
            className="flex items-center gap-1.5 text-sm font-medium text-[#5C6B7A] hover:text-[#0B2A4A] transition-colors"
          >
            ← Lists
          </button>
          <div className="flex items-center gap-2">
            {checked.length > 0 && (
              <button
                type="button"
                onClick={clearChecked}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#B8791F] hover:bg-[#FDF3E3] transition-colors"
              >
                Clear checked ({checked.length})
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#0B2A4A] mb-1">{activeList.name}</h2>
          <p className="text-xs text-[#5C6B7A] mb-4">
            {activeList.checked_items} of {activeList.total_items} items checked
          </p>

          {/* Quick add */}
          <div className="flex gap-2 mb-5">
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Add an item…"
              className={cn(inputCls, "flex-1 min-w-0")}
            />
            <input
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Qty"
              className={cn(inputCls, "w-16 text-center")}
            />
            <button
              type="button"
              onClick={addItem}
              disabled={addingItem || !newItemName.trim()}
              className="h-10 rounded-xl bg-[#0B2A4A] px-4 text-sm font-semibold text-white hover:bg-[#0F3360] disabled:opacity-50 transition-all"
            >
              {addingItem ? "…" : "Add"}
            </button>
          </div>

          {/* Items list */}
          {itemsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-[#F5F1EA] animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#5C6B7A]">
              No items yet — add something above.
            </div>
          ) : (
            <div className="divide-y divide-[#F5F1EA]">
              {unchecked.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={toggleCheck} onDelete={deleteItem} />
              ))}
              {checked.length > 0 && unchecked.length > 0 && (
                <div className="py-2 text-[10px] font-semibold uppercase tracking-wider text-[#5C6B7A] opacity-60">
                  Checked
                </div>
              )}
              {checked.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={toggleCheck} onDelete={deleteItem} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Lists view ──────────────────────────────────────
  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-[#B8791F]/30 bg-[#FDF3E3] px-4 py-2.5 text-sm text-[#B8791F]">{msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#0B2A4A]">Grocery lists</h2>
          <p className="text-xs text-[#5C6B7A]">Shared with your household</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewList((v) => !v)}
          className="h-9 rounded-xl bg-[#0B2A4A] px-4 text-sm font-semibold text-white hover:bg-[#0F3360] transition-all"
        >
          + New list
        </button>
      </div>

      {/* New list form */}
      {showNewList && (
        <div className="rounded-2xl border border-[#E8E2D9] bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); createList(); }
                if (e.key === "Escape") { setShowNewList(false); setNewListName(""); }
              }}
              placeholder='e.g. "Weekly Shop" or "Costco Run"'
              className={cn(inputCls, "flex-1 min-w-0")}
            />
            <button
              type="button"
              onClick={createList}
              disabled={addingList || !newListName.trim()}
              className="h-10 rounded-xl bg-[#0B2A4A] px-4 text-sm font-semibold text-white hover:bg-[#0F3360] disabled:opacity-50 transition-all"
            >
              {addingList ? "…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewList(false); setNewListName(""); }}
              className="h-10 w-10 rounded-xl border border-[#E8E2D9] text-[#5C6B7A] hover:bg-[#F5F1EA] flex items-center justify-center transition-all"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Lists */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white border border-[#E8E2D9] animate-pulse" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-3">🛒</div>
          <p className="text-sm font-medium text-[#0B2A4A] mb-1">No lists yet</p>
          <p className="text-xs text-[#5C6B7A]">Create your first grocery list above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => {
            const pct = list.total_items > 0
              ? Math.round((list.checked_items / list.total_items) * 100)
              : 0;
            return (
              <div
                key={list.id}
                onClick={() => { setActiveListId(list.id); setMsg(null); }}
                className="group relative rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-[#0B2A4A]">{list.name}</div>
                    <div className="text-xs text-[#5C6B7A] mt-0.5">
                      {list.checked_items}/{list.total_items} items
                      {list.total_items > 0 && pct === 100 && (
                        <span className="ml-1.5 text-[#2F6B52] font-medium">· Done!</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteList(list.id, list.name); }}
                    className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-[#5C6B7A] hover:text-[#B8791F] hover:bg-[#FDF3E3] transition-all"
                  >
                    ×
                  </button>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#E8E2D9]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: "#2F6B52" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: GroceryItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isDone = item.checked === 1;
  return (
    <div className={cn("flex items-center gap-3 py-2.5", isDone && "opacity-50")}>
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={cn(
          "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all",
          isDone
            ? "bg-[#2F6B52] border-[#2F6B52] text-white"
            : "border-[#E8E2D9] hover:border-[#2F6B52]"
        )}
      >
        {isDone && <span className="text-[10px] leading-none font-bold">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-sm text-[#0B2A4A]", isDone && "line-through text-[#5C6B7A]")}>
            {item.name}
          </span>
          {item.quantity && (
            <span className="text-xs text-[#5C6B7A]">× {item.quantity}</span>
          )}
        </div>
        {item.added_by_name && (
          <div className="text-[10px] text-[#8A9BA8]">Added by {item.added_by_name}</div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="shrink-0 rounded-lg p-1 text-[#5C6B7A] hover:text-[#B8791F] hover:bg-[#FDF3E3] transition-colors text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}
