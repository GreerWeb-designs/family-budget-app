import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Meal = {
  id: string; planned_date: string; meal_type: string; notes: string | null;
  recipe_id: string; recipe_title: string; recipe_type: string;
  prep_time: number | null; cook_time: number | null; servings: number | null;
};

const RECIPE_TYPE_EMOJI: Record<string, string> = {
  main: "🍽️", soup_salad: "🥗", appetizer: "🥨", dessert: "🍰", snack: "🍎",
};
const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: "bg-rust-50 text-rust-600",
  lunch:     "bg-teal-50 text-teal-600",
  dinner:    "bg-cream-100 text-teal-700",
  snack:     "bg-cream-100 text-ink-500",
};

function monthStart(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}-01`;
}
function monthEnd(y: number, m: number) {
  const d = new Date(y, m, 0); // last day of month
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

export default function Meals() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(y: number, m: number) {
    setLoading(true); setMsg(null);
    try {
      const start = monthStart(y, m);
      const end = monthEnd(y, m);
      const res = await api<{ meals: Meal[] }>(`/api/meals?start=${start}&end=${end}`);
      setMeals(res.meals ?? []);
    } catch { setMsg("Failed to load meal plan."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(year, month); }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function removeMeal(id: string) {
    try {
      await api(`/api/meals/${id}`, { method: "DELETE" });
      setMeals((prev) => prev.filter((m) => m.id !== id));
    } catch { setMsg("Failed to remove meal."); }
  }

  // Group meals by date
  const grouped = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const m of meals) {
      const arr = map.get(m.planned_date) ?? [];
      arr.push(m);
      map.set(m.planned_date, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [meals]);

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-rust-600/30 bg-rust-50 px-4 py-2.5 text-sm text-rust-600">{msg}</div>
      )}

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-2xl border border-cream-200 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={prevMonth}
          className="h-9 w-9 rounded-xl border border-cream-200 text-ink-500 hover:bg-cream-100 transition-all flex items-center justify-center">
          ←
        </button>
        <div className="text-center">
          <div className="font-medium text-sm text-ink-900">{monthLabel(year, month)}</div>
          <div className="text-xs text-ink-500">{loading ? "\u00a0" : `${meals.length} meal${meals.length !== 1 ? "s" : ""} planned`}</div>
        </div>
        <button type="button" onClick={nextMonth}
          className="h-9 w-9 rounded-xl border border-cream-200 text-ink-500 hover:bg-cream-100 transition-all flex items-center justify-center">
          →
        </button>
      </div>

      {/* List */}
      <div className={cn("transition-opacity duration-200", loading ? "opacity-0 pointer-events-none" : "opacity-100")}>
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-3xl mb-3">🍽️</div>
          <p className="text-sm font-medium text-ink-900 mb-1">Nothing planned for {monthLabel(year, month)}</p>
          <p className="text-xs text-ink-500 mb-4">Add meals from the Recipe book.</p>
          <button
            type="button"
            onClick={() => navigate("/recipes")}
            className="h-9 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-900 transition-all"
          >
            Browse recipes →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, dayMeals]) => {
            const d = new Date(`${date}T00:00:00`);
            const isToday = date === todayStr;
            const dateLabel = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
            return (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2">
                  {isToday && <span className="h-2 w-2 rounded-full bg-rust-500" />}
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    isToday ? "text-rust-500" : "text-ink-500"
                  )}>
                    {dateLabel}
                  </span>
                </div>

                <div className="space-y-2">
                  {dayMeals.map((meal) => (
                    <div key={meal.id}
                      className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
                      <span className="text-xl shrink-0">
                        {RECIPE_TYPE_EMOJI[meal.recipe_type] ?? "🍽️"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium text-ink-900 cursor-pointer hover:text-rust-500 transition-colors truncate"
                          onClick={() => navigate("/recipes")}
                        >
                          {meal.recipe_title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[10px] font-medium rounded-full px-2 py-0.5 capitalize",
                            MEAL_TYPE_COLORS[meal.meal_type] ?? "bg-cream-100 text-ink-500"
                          )}>
                            {meal.meal_type}
                          </span>
                          {meal.prep_time && meal.cook_time && (
                            <span className="text-[10px] text-ink-500">
                              ⏱ {meal.prep_time + meal.cook_time} min
                            </span>
                          )}
                          {meal.servings && (
                            <span className="text-[10px] text-ink-500">
                              👥 {meal.servings}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMeal(meal.id)}
                        className="shrink-0 rounded-lg p-1.5 text-ink-500 hover:text-rust-600 hover:bg-rust-50 transition-colors text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => navigate("/recipes")}
              className="text-sm font-medium text-rust-500 hover:text-rust-600 transition-colors"
            >
              Browse recipes →
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
