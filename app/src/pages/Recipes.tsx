import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

/* ── Types ───────────────────────────────────────────── */
type Recipe = {
  id: string; title: string; type: string; description: string | null;
  prep_time: number | null; cook_time: number | null; servings: number | null;
  created_at: string; ingredient_count: number;
};
type Ingredient = {
  id: string; name: string; quantity: string | null; unit: string | null; sort_order: number;
};
type RecipeDetail = {
  id: string; title: string; type: string; description: string | null;
  prep_time: number | null; cook_time: number | null; servings: number | null;
  directions: string | null; created_at: string;
  ingredients: Ingredient[];
};
type GroceryList = { id: string; name: string; total_items: number; checked_items: number };
type IngredientDraft = { name: string; quantity: string; unit: string };

/* ── Constants ───────────────────────────────────────── */
const RECIPE_TYPES = [
  { value: "soup_salad", label: "Soup / Salad", emoji: "🥗" },
  { value: "main",       label: "Main",         emoji: "🍽️" },
  { value: "appetizer",  label: "Appetizer",    emoji: "🥨" },
  { value: "dessert",    label: "Dessert",       emoji: "🍰" },
  { value: "snack",      label: "Snack",         emoji: "🍎" },
];
const TYPE_STRIP: Record<string, string> = {
  main: "#0B2A4A", soup_salad: "#2F6B52",
  dessert: "#C8A464", appetizer: "#B8791F", snack: "#5C6B7A",
};
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

function typeLabel(t: string) {
  return RECIPE_TYPES.find((r) => r.value === t) ?? { label: t, emoji: "🍽️" };
}
function totalTime(prep: number | null, cook: number | null) {
  const m = (prep ?? 0) + (cook ?? 0);
  if (!m) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60); const rem = m % 60;
  return rem ? `${h}hr ${rem}min` : `${h}hr`;
}

const inputCls =
  "h-10 rounded-xl border border-[#E8E2D9] bg-white px-3 text-sm text-[#0B2A4A] outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/20 transition-all placeholder:text-[#5C6B7A]";

/* ── Main component ──────────────────────────────────── */
export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadRecipes() {
    const res = await api<{ recipes: Recipe[] }>("/api/recipes");
    setRecipes(res.recipes ?? []);
  }
  useEffect(() => {
    setLoading(true);
    loadRecipes().catch(() => setMsg("Failed to load recipes.")).finally(() => setLoading(false));
  }, []);

  async function openDetail(id: string) {
    setDetailLoading(true); setDetail(null);
    try {
      const res = await api<{ recipe: RecipeDetail; ingredients: Ingredient[] }>(`/api/recipes/${id}`);
      setDetail({ ...res.recipe, ingredients: res.ingredients ?? [] });
    } catch { setMsg("Failed to load recipe."); }
    finally { setDetailLoading(false); }
  }

  async function deleteRecipe(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await api(`/api/recipes/${id}`, { method: "DELETE" });
      setDetail(null); await loadRecipes();
    } catch { setMsg("Failed to delete recipe."); }
  }

  const filtered = filter === "all" ? recipes : recipes.filter((r) => r.type === filter);

  // Detail view
  if (detailLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-[#C8A464]/30 border-t-[#C8A464] animate-spin" />
      </div>
    );
  }

  if (detail) {
    return (
      <DetailView
        detail={detail}
        onBack={() => setDetail(null)}
        onEdit={() => { setEditingId(detail.id); setShowForm(true); }}
        onDelete={() => deleteRecipe(detail.id, detail.title)}
        onMealAdded={() => setMsg("Added to meal plan ✓")}
        msg={msg} setMsg={setMsg}
      />
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-sm",
          msg.includes("✓") ? "bg-[#EBF3EF] border-[#2F6B52]/30 text-[#2F6B52]"
            : "bg-[#FDF3E3] border-[#B8791F]/30 text-[#B8791F]")}>
          {msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0B2A4A]">Recipe book</h2>
          <p className="text-xs text-[#5C6B7A]">Shared with your household</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingId(null); setShowForm(true); setMsg(null); }}
          className="h-9 rounded-xl bg-[#0B2A4A] px-4 text-sm font-semibold text-white hover:bg-[#0F3360] transition-all"
        >
          + Add recipe
        </button>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "all", label: "All", emoji: "" }, ...RECIPE_TYPES].map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium transition-all",
              filter === t.value
                ? "bg-[#0B2A4A] text-white"
                : "bg-white border border-[#E8E2D9] text-[#5C6B7A] hover:border-[#C8A464]"
            )}
          >
            {t.emoji ? `${t.emoji} ` : ""}{t.label}
          </button>
        ))}
      </div>

      {/* Recipe grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-[#E8E2D9] bg-white animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-sm font-medium text-[#0B2A4A] mb-1">No recipes yet</p>
          <p className="text-xs text-[#5C6B7A]">Add your first recipe above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => {
            const t = typeLabel(r.type);
            const time = totalTime(r.prep_time, r.cook_time);
            return (
              <div
                key={r.id}
                onClick={() => openDetail(r.id)}
                className="group relative rounded-2xl border border-[#E8E2D9] bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="h-1" style={{ background: TYPE_STRIP[r.type] ?? "#5C6B7A" }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-base font-medium text-[#0B2A4A] leading-snug">{r.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#F5F1EA] text-[#5C6B7A] font-medium">{t.emoji} {t.label}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteRecipe(r.id, r.title); }}
                        className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-[#5C6B7A] hover:text-[#B8791F] hover:bg-[#FDF3E3] transition-all"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {r.description && (
                    <p className="text-xs text-[#5C6B7A] line-clamp-2 mb-2">{r.description}</p>
                  )}
                  <div className="flex gap-3 text-xs text-[#5C6B7A] mt-2">
                    {r.ingredient_count > 0 && <span>🧂 {r.ingredient_count} ingredient{r.ingredient_count !== 1 ? "s" : ""}</span>}
                    {time && <span>⏱ {time}</span>}
                    {r.servings && <span>👥 {r.servings} serving{r.servings !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <RecipeFormModal
          editingId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSaved={async (id) => {
            setShowForm(false); setEditingId(null);
            await loadRecipes();
            openDetail(id);
          }}
        />
      )}
    </div>
  );
}

/* ── RecipeFormModal ─────────────────────────────────── */
function RecipeFormModal({
  editingId,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("main");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [directions, setDirections] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([{ name: "", quantity: "", unit: "" }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    api<{ recipe: RecipeDetail; ingredients: Ingredient[] }>(`/api/recipes/${editingId}`).then((res) => {
      const r = res.recipe;
      setTitle(r.title); setType(r.type); setDescription(r.description ?? "");
      setPrepTime(r.prep_time ? String(r.prep_time) : "");
      setCookTime(r.cook_time ? String(r.cook_time) : "");
      setServings(r.servings ? String(r.servings) : "");
      setDirections(r.directions ?? "");
      setIngredients(
        res.ingredients.length > 0
          ? res.ingredients.map((i) => ({ name: i.name, quantity: i.quantity ?? "", unit: i.unit ?? "" }))
          : [{ name: "", quantity: "", unit: "" }]
      );
    }).catch(() => setErr("Failed to load recipe."));
  }, [editingId]);

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }]);
  }
  function updateIngredient(i: number, field: keyof IngredientDraft, val: string) {
    setIngredients((prev) => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing));
  }
  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr("Title required."); return; }
    setSaving(true); setErr(null);
    const body = {
      title: title.trim(), type, description: description.trim() || undefined,
      prepTime: prepTime ? Number(prepTime) : undefined,
      cookTime: cookTime ? Number(cookTime) : undefined,
      servings: servings ? Number(servings) : undefined,
      directions: directions.trim() || undefined,
      ingredients: ingredients.filter((i) => i.name.trim()).map((i) => ({
        name: i.name.trim(), quantity: i.quantity.trim() || undefined, unit: i.unit.trim() || undefined,
      })),
    };
    try {
      if (editingId) {
        await api(`/api/recipes/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        onSaved(editingId);
      } else {
        const res = await api<{ ok: boolean; id: string }>("/api/recipes", { method: "POST", body: JSON.stringify(body) });
        onSaved(res.id);
      }
    } catch (e: any) { setErr(e?.message || "Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E8E2D9] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8E2D9] bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-[#0B2A4A]">{editingId ? "Edit recipe" : "New recipe"}</h2>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#E8E2D9] px-3 py-1.5 text-xs font-semibold text-[#5C6B7A] hover:bg-[#F5F1EA]">
            ×
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-5">
          {err && <div className="rounded-xl border border-[#B8791F]/30 bg-[#FDF3E3] px-4 py-2.5 text-sm text-[#B8791F]">{err}</div>}

          {/* Basics */}
          <div className="space-y-3">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Recipe name"
              className={cn(inputCls, "w-full h-12 text-base font-medium")}
              autoFocus required
            />
            {/* Type pills */}
            <div className="flex flex-wrap gap-1.5">
              {RECIPE_TYPES.map((t) => (
                <button
                  key={t.value} type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-medium transition-all",
                    type === t.value ? "bg-[#0B2A4A] text-white" : "bg-[#F5F1EA] text-[#5C6B7A] hover:bg-[#E8E2D9]"
                  )}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              className="w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#0B2A4A] outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/20 transition-all resize-none placeholder:text-[#5C6B7A]"
            />
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Prep (min)", val: prepTime, set: setPrepTime },
                { label: "Cook (min)", val: cookTime, set: setCookTime },
                { label: "Servings", val: servings, set: setServings },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1">{label}</label>
                  <input
                    type="number" min="0" value={val} onChange={(e) => set(e.target.value)}
                    className={cn(inputCls, "w-full text-center")}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6B7A]">Ingredients</span>
              <button type="button" onClick={addIngredient}
                className="text-xs font-medium text-[#C8A464] hover:text-[#B8791F] transition-colors">
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={ing.quantity} onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                    placeholder="Qty" className={cn(inputCls, "w-16 text-center shrink-0")}
                  />
                  <input
                    value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                    placeholder="Unit" className={cn(inputCls, "w-20 shrink-0")}
                  />
                  <input
                    value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)}
                    placeholder="Ingredient name"
                    className={cn(inputCls, "flex-1 min-w-0")}
                  />
                  {ingredients.length > 1 && (
                    <button type="button" onClick={() => removeIngredient(i)}
                      className="shrink-0 text-[#5C6B7A] hover:text-[#B8791F] transition-colors text-lg leading-none px-1">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Directions */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C6B7A] mb-2">
              Directions
            </label>
            <textarea
              value={directions} onChange={(e) => setDirections(e.target.value)}
              placeholder="Step-by-step instructions..."
              rows={8}
              className="w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 font-mono text-sm text-[#0B2A4A] outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/20 transition-all resize-none placeholder:text-[#5C6B7A]"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="h-10 flex-1 rounded-xl bg-[#0B2A4A] text-sm font-semibold text-white hover:bg-[#0F3360] disabled:opacity-50 transition-all">
              {saving ? "Saving…" : "Save recipe"}
            </button>
            <button type="button" onClick={onClose}
              className="h-10 rounded-xl border border-[#E8E2D9] px-5 text-sm text-[#5C6B7A] hover:bg-[#F5F1EA] transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── DetailView ──────────────────────────────────────── */
function DetailView({
  detail, onBack, onEdit, onDelete, onMealAdded, msg, setMsg,
}: {
  detail: RecipeDetail;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMealAdded: () => void;
  msg: string | null;
  setMsg: (m: string | null) => void;
}) {
  const t = typeLabel(detail.type);
  const time = totalTime(detail.prep_time, detail.cook_time);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [groceryPopover, setGroceryPopover] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");
  const [addingToGrocery, setAddingToGrocery] = useState(false);
  const [groceryMsg, setGroceryMsg] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Meal plan state
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planMealType, setPlanMealType] = useState("dinner");
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  useEffect(() => {
    if (groceryPopover && groceryLists.length === 0) {
      api<{ lists: GroceryList[] }>("/api/grocery/lists").then((r) => {
        setGroceryLists(r.lists ?? []);
        if (r.lists && r.lists.length > 0) setSelectedListId(r.lists[0].id);
      }).catch(() => {});
    }
  }, [groceryPopover]);

  useEffect(() => {
    if (!groceryPopover) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setGroceryPopover(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [groceryPopover]);

  function toggleIngredient(i: number) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function addToGrocery() {
    if (!selectedListId || checkedIngredients.size === 0) return;
    setAddingToGrocery(true); setGroceryMsg(null);
    const selected = detail.ingredients.filter((_, i) => checkedIngredients.has(i));
    try {
      for (const ing of selected) {
        const name = [ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ");
        await api(`/api/grocery/lists/${selectedListId}/items`, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      }
      const listName = groceryLists.find((l) => l.id === selectedListId)?.name ?? "list";
      setGroceryMsg(`Added ${selected.length} item${selected.length !== 1 ? "s" : ""} to ${listName} ✓`);
      setCheckedIngredients(new Set());
      setGroceryPopover(false);
    } catch { setGroceryMsg("Failed to add items."); }
    finally { setAddingToGrocery(false); }
  }

  async function addToMealPlan() {
    if (!planDate) return;
    setPlanBusy(true); setPlanMsg(null);
    try {
      await api("/api/meals", {
        method: "POST",
        body: JSON.stringify({ recipeId: detail.id, plannedDate: planDate, mealType: planMealType }),
      });
      const dateLabel = new Date(`${planDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      setPlanMsg(`Added to meal plan for ${dateLabel} ✓`);
      onMealAdded();
    } catch (e: any) { setPlanMsg(e?.message || "Failed."); }
    finally { setPlanBusy(false); }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-sm",
          msg.includes("✓") ? "bg-[#EBF3EF] border-[#2F6B52]/30 text-[#2F6B52]"
            : "bg-[#FDF3E3] border-[#B8791F]/30 text-[#B8791F]")}>
          {msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={onBack}
          className="text-sm font-medium text-[#5C6B7A] hover:text-[#0B2A4A] transition-colors">
          ← Recipes
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onEdit}
            className="h-8 rounded-xl border border-[#E8E2D9] px-3 text-xs font-medium text-[#5C6B7A] hover:bg-[#F5F1EA] transition-all">
            ✏️ Edit
          </button>
          <button type="button" onClick={onDelete}
            className="h-8 rounded-xl border border-[#B8791F]/30 px-3 text-xs font-medium text-[#B8791F] hover:bg-[#FDF3E3] transition-all">
            Delete
          </button>
        </div>
      </div>

      {/* Title + meta */}
      <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-medium text-[#0B2A4A] leading-tight">{detail.title}</h1>
            {detail.description && (
              <p className="text-sm text-[#5C6B7A] mt-1">{detail.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-[#5C6B7A]">
          <span className="rounded-full bg-[#F5F1EA] px-2.5 py-1 font-medium">{t.emoji} {t.label}</span>
          {time && <span>⏱ {time}</span>}
          {detail.prep_time && <span>🔪 Prep {detail.prep_time} min</span>}
          {detail.cook_time && <span>🔥 Cook {detail.cook_time} min</span>}
          {detail.servings && <span>👥 {detail.servings} serving{detail.servings !== 1 ? "s" : ""}</span>}
        </div>
      </div>

      {groceryMsg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-sm",
          groceryMsg.includes("✓") ? "bg-[#EBF3EF] border-[#2F6B52]/30 text-[#2F6B52]"
            : "bg-[#FDF3E3] border-[#B8791F]/30 text-[#B8791F]")}>
          {groceryMsg}
        </div>
      )}

      {/* Ingredients + Directions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ingredients */}
        <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#0B2A4A]">Ingredients</h3>
            {detail.ingredients.length > 0 && (
              <span className="text-xs text-[#5C6B7A]">Check to add to grocery</span>
            )}
          </div>

          {detail.ingredients.length === 0 ? (
            <p className="text-sm text-[#5C6B7A] italic">No ingredients listed.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {detail.ingredients.map((ing, i) => (
                <label key={ing.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => toggleIngredient(i)}
                    className={cn(
                      "h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-all cursor-pointer",
                      checkedIngredients.has(i)
                        ? "bg-[#2F6B52] border-[#2F6B52]"
                        : "border-[#E8E2D9] group-hover:border-[#C8A464]"
                    )}
                  >
                    {checkedIngredients.has(i) && (
                      <span className="text-white text-[9px] leading-none font-bold">✓</span>
                    )}
                  </div>
                  <span className={cn("text-sm", checkedIngredients.has(i) ? "text-[#2F6B52]" : "text-[#0B2A4A]")}>
                    {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ")}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Grocery add */}
          {checkedIngredients.size > 0 && (
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => setGroceryPopover((v) => !v)}
                className="h-9 rounded-xl bg-[#2F6B52] px-4 text-xs font-semibold text-white hover:bg-[#2F6B52]/90 transition-all"
              >
                🛒 Add {checkedIngredients.size} to grocery list
              </button>
              {groceryPopover && (
                <div className="absolute left-0 top-full mt-2 z-20 w-64 rounded-xl border border-[#E8E2D9] bg-white shadow-lg p-3">
                  <p className="text-xs font-semibold text-[#5C6B7A] mb-2 uppercase tracking-wider">Add to which list?</p>
                  {groceryLists.length === 0 ? (
                    <p className="text-xs text-[#5C6B7A]">No grocery lists yet. Create one first.</p>
                  ) : (
                    <>
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className={cn(inputCls, "w-full mb-2")}
                      >
                        {groceryLists.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addToGrocery}
                        disabled={addingToGrocery || !selectedListId}
                        className="h-9 w-full rounded-xl bg-[#0B2A4A] text-xs font-semibold text-white hover:bg-[#0F3360] disabled:opacity-50 transition-all"
                      >
                        {addingToGrocery ? "Adding…" : "Confirm"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Directions */}
        <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#0B2A4A] mb-3">Directions</h3>
          {detail.directions ? (
            <p className="text-sm text-[#0B2A4A] leading-relaxed whitespace-pre-wrap">{detail.directions}</p>
          ) : (
            <p className="text-sm text-[#5C6B7A] italic">No directions added yet.</p>
          )}
        </div>
      </div>

      {/* Plan this meal */}
      <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0B2A4A] mb-3">Plan this meal</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1">Date</label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className={cn(inputCls, "w-44")}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1">Meal type</label>
            <div className="flex gap-1">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt} type="button"
                  onClick={() => setPlanMealType(mt)}
                  className={cn(
                    "h-10 rounded-xl px-3 text-xs font-medium capitalize transition-all",
                    planMealType === mt
                      ? "bg-[#C8A464] text-[#0B2A4A] font-semibold"
                      : "border border-[#E8E2D9] text-[#5C6B7A] hover:bg-[#F5F1EA]"
                  )}
                >
                  {mt}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={addToMealPlan}
            disabled={planBusy || !planDate}
            className="h-10 rounded-xl bg-[#C8A464] px-4 text-sm font-semibold text-[#0B2A4A] hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {planBusy ? "Adding…" : "Add to plan"}
          </button>
        </div>
        {planMsg && (
          <p className={cn("text-sm mt-2", planMsg.includes("✓") ? "text-[#2F6B52]" : "text-[#B8791F]")}>
            {planMsg}
          </p>
        )}
      </div>
    </div>
  );
}
