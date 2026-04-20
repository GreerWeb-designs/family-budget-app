import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Check,
  BarChart2, Receipt, CreditCard, Target,
  UtensilsCrossed, ShoppingCart, CalendarDays, ListChecks, StickyNote,
  Home, Users, User, UserPlus,
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ScreenId = "welcome" | "features" | "household" | "householdSize" | "budgetStyle" | "balance" | "addEvent" | "done";

// ─── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  { id: "budgeting", label: "Budgeting & spending",   Icon: BarChart2,       grad: "linear-gradient(135deg,#D0EDE8,#EAF5F3)", iconColor: "#2F8F7E" },
  { id: "bills",     label: "Bills & payments",        Icon: Receipt,         grad: "linear-gradient(135deg,#FAE4D0,#FAF0E6)", iconColor: "#C56A3F" },
  { id: "debts",     label: "Debt payoff",             Icon: CreditCard,      grad: "linear-gradient(135deg,#E4E8F0,#F0F3F8)", iconColor: "#546080" },
  { id: "goals",     label: "Savings goals",           Icon: Target,          grad: "linear-gradient(135deg,#D8EDD0,#EEF8E6)", iconColor: "#4A7C3F" },
  { id: "meals",     label: "Meal planning & recipes", Icon: UtensilsCrossed, grad: "linear-gradient(135deg,#FAE8D0,#FAF4EA)", iconColor: "#B87340" },
  { id: "grocery",   label: "Grocery lists",           Icon: ShoppingCart,    grad: "linear-gradient(135deg,#D0EDEA,#EAF7F5)", iconColor: "#2D8A80" },
  { id: "calendar",  label: "Family calendar",         Icon: CalendarDays,    grad: "linear-gradient(135deg,#EAD8F2,#F5EDFA)", iconColor: "#7A4A9E" },
  { id: "chores",    label: "Chores & tasks",          Icon: ListChecks,      grad: "linear-gradient(135deg,#FAF0D0,#FAF8E6)", iconColor: "#B8963A" },
  { id: "notes",     label: "Shared notes",            Icon: StickyNote,      grad: "linear-gradient(135deg,#F2EAD8,#F8F5EC)", iconColor: "#8A7A50" },
];

const HOUSEHOLD_OPTIONS = [
  { id: "solo",      label: "Just me",           Icon: User,     desc: "Solo household"     },
  { id: "partner",   label: "Me and a partner",  Icon: Users,    desc: "Two adults"         },
  { id: "family",    label: "Family with kids",  Icon: Home,     desc: "Adults & children"  },
  { id: "roommates", label: "Roommates",          Icon: UserPlus, desc: "Shared living"      },
];

const HOUSEHOLD_SIZES = ["2", "3", "4", "5", "6+"];

const BUDGET_STYLES = [
  { id: "none",         label: "I don't really budget",      emoji: "🤷" },
  { id: "spreadsheets", label: "Spreadsheets",               emoji: "📊" },
  { id: "app",          label: "Another app (YNAB, Mint…)",  emoji: "📱" },
  { id: "paper",        label: "Pen and paper",              emoji: "📝" },
];

// ─── Navigation helpers ────────────────────────────────────────────────────────
function nextScreen(cur: ScreenId, features: string[], householdType: string): ScreenId {
  if (cur === "welcome")       return "features";
  if (cur === "features")      return "household";
  if (cur === "household") {
    if (householdType === "family" || householdType === "roommates") return "householdSize";
    if (features.includes("budgeting")) return "budgetStyle";
    return "balance";
  }
  if (cur === "householdSize") return features.includes("budgeting") ? "budgetStyle" : "balance";
  if (cur === "budgetStyle")   return "balance";
  if (cur === "balance")       return "addEvent";
  if (cur === "addEvent")      return "done";
  return cur;
}

function prevScreen(cur: ScreenId, _features: string[], householdType: string): ScreenId {
  if (cur === "features")      return "welcome";
  if (cur === "household")     return "features";
  if (cur === "householdSize") return "household";
  if (cur === "budgetStyle") {
    return (householdType === "family" || householdType === "roommates") ? "householdSize" : "household";
  }
  if (cur === "balance")       return "budgetStyle"; // simplified — progress only goes fwd anyway
  if (cur === "addEvent")      return "balance";
  return cur;
}

function buildFlow(features: string[], householdType: string): ScreenId[] {
  const flow: ScreenId[] = ["welcome", "features", "household"];
  if (householdType === "family" || householdType === "roommates") flow.push("householdSize");
  if (features.includes("budgeting")) flow.push("budgetStyle");
  flow.push("balance", "addEvent", "done");
  return flow;
}

// ─── Animations ────────────────────────────────────────────────────────────────
const stepVariants = {
  enter:  (d: number) => ({ x: d > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -24 : 24, opacity: 0 }),
};
const T = { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const };

// ─── Shell ─────────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:items-center md:justify-center"
      style={{ background: "linear-gradient(135deg,#E8F1F1 0%,#FAF6EE 100%)" }}>
      <div className={cn(
        "relative flex flex-col bg-white w-full min-h-svh",
        "md:min-h-0 md:rounded-3xl md:shadow-2xl md:max-w-[520px] md:my-10 md:overflow-hidden",
      )}>
        {children}
      </div>
    </div>
  );
}

// ─── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ onBack, onSkip, progress }: {
  onBack?: () => void;
  onSkip?: () => void;
  progress?: { current: number; total: number };
}) {
  return (
    <div className="shrink-0 px-4 pt-5 pb-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="w-9">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-cream-100 transition-colors">
              <ArrowLeft size={18} />
            </button>
          )}
        </div>
        <div className="w-9 flex justify-end">
          {onSkip && (
            <button type="button" onClick={onSkip}
              className="text-xs font-medium text-ink-400 hover:text-ink-600 transition-colors">
              Skip
            </button>
          )}
        </div>
      </div>
      {progress && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: progress.total }).map((_, i) => (
            <div key={i} className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === progress.current ? "w-5 bg-teal-600" : i < progress.current ? "w-1.5 bg-teal-200" : "w-1.5 bg-cream-200",
            )} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PrimaryBtn ────────────────────────────────────────────────────────────────
function PrimaryBtn({ onClick, disabled, children }: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="h-12 w-full rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-40"
      style={{ background: "var(--color-primary)" }}>
      {children}
    </button>
  );
}

// ─── OptionCheck (reusable check badge) ───────────────────────────────────────
function OptionCheck({ size = 5 }: { size?: number }) {
  return (
    <div className={cn(`shrink-0 h-${size} w-${size} rounded-full bg-teal-500 flex items-center justify-center`)}>
      <Check size={size === 4 ? 9 : 11} className="text-white" strokeWidth={3} />
    </div>
  );
}

// ─── Screen: Welcome ──────────────────────────────────────────────────────────
function ScreenWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-8">
        <div className="h-24 w-24 rounded-3xl flex items-center justify-center text-5xl shadow-xl"
          style={{ background: "linear-gradient(135deg,#2F8F7E 0%,#1B4243 100%)" }}>
          🦦
        </div>
        <div className="space-y-3">
          <p className="font-display text-3xl font-semibold text-ink-900 leading-tight">
            Let's set up your home base
          </p>
          <p className="text-sm text-ink-500 leading-relaxed max-w-[280px] mx-auto">
            We'll ask a few quick questions to personalize NestOtter for you.
          </p>
        </div>
      </div>
      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue}>Get started</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Screen: Features ─────────────────────────────────────────────────────────
function ScreenFeatures({ selected, onToggle, onBack, onSkip, onContinue, progress }: {
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  progress: { current: number; total: number };
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar onBack={onBack} onSkip={onSkip} progress={progress} />
      <div className="flex-1 flex flex-col px-5 py-2 overflow-y-auto">
        <p className="font-display text-xl font-semibold text-ink-900 mb-1">What matters most?</p>
        <p className="text-xs text-ink-500 mb-4 leading-relaxed">
          Pick everything that fits your household. You can always change this later.
        </p>
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {FEATURES.map(({ id, label, Icon, grad, iconColor }) => {
            const sel = selected.includes(id);
            return (
              <button key={id} type="button" onClick={() => onToggle(id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  sel ? "border-teal-500 bg-teal-50/60 shadow-sm" : "border-cream-200 bg-white hover:border-cream-300 hover:bg-cream-50",
                )}>
                <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: grad }}>
                  <Icon size={17} style={{ color: iconColor }} strokeWidth={1.75} />
                </div>
                <span className={cn("flex-1 text-xs font-medium leading-snug", sel ? "text-teal-700" : "text-ink-900")}>
                  {label}
                </span>
                {sel && <OptionCheck size={4} />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-8 pt-3 shrink-0 border-t border-cream-100">
        <PrimaryBtn onClick={onContinue}>Continue</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Screen: Household type ───────────────────────────────────────────────────
function ScreenHousehold({ value, onChange, onBack, onSkip, onContinue, progress }: {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  progress: { current: number; total: number };
}) {
  return (
    <div className="flex flex-col flex-1">
      <TopBar onBack={onBack} onSkip={onSkip} progress={progress} />
      <div className="flex-1 flex flex-col px-5 py-2">
        <p className="font-display text-xl font-semibold text-ink-900 mb-1">Who's in your household?</p>
        <p className="text-xs text-ink-500 mb-5">This helps us set up sharing and invites.</p>
        <div className="space-y-2.5">
          {HOUSEHOLD_OPTIONS.map(({ id, label, Icon, desc }) => {
            const sel = value === id;
            return (
              <button key={id} type="button" onClick={() => onChange(id)}
                className={cn(
                  "w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all",
                  sel ? "border-teal-500 bg-teal-50/60 shadow-sm" : "border-cream-200 bg-white hover:border-cream-300 hover:bg-cream-50",
                )}>
                <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center", sel ? "bg-teal-100" : "bg-cream-100")}>
                  <Icon size={18} className={sel ? "text-teal-600" : "text-ink-500"} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-semibold", sel ? "text-teal-700" : "text-ink-900")}>{label}</div>
                  <div className="text-xs text-ink-400">{desc}</div>
                </div>
                {sel && <OptionCheck />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue} disabled={!value}>Continue</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Screen: Household size ───────────────────────────────────────────────────
function ScreenHouseholdSize({ householdType, value, onChange, onBack, onSkip, onContinue, progress }: {
  householdType: string;
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  progress: { current: number; total: number };
}) {
  const question = householdType === "family"
    ? "How many people in your family?"
    : "How many people total?";

  return (
    <div className="flex flex-col flex-1">
      <TopBar onBack={onBack} onSkip={onSkip} progress={progress} />
      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-8">
        <div>
          <p className="font-display text-xl font-semibold text-ink-900 mb-2">{question}</p>
          <p className="text-xs text-ink-500">Including yourself.</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {HOUSEHOLD_SIZES.map(size => (
            <button key={size} type="button" onClick={() => onChange(size)}
              className={cn(
                "h-14 w-14 rounded-2xl border text-base font-bold transition-all",
                value === size
                  ? "border-teal-500 bg-teal-500 text-white shadow-sm"
                  : "border-cream-200 bg-white text-ink-700 hover:border-teal-300",
              )}>
              {size}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue} disabled={!value}>Continue</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Screen: Budget style ─────────────────────────────────────────────────────
function ScreenBudgetStyle({ value, onChange, onBack, onSkip, onContinue, progress }: {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  progress: { current: number; total: number };
}) {
  return (
    <div className="flex flex-col flex-1">
      <TopBar onBack={onBack} onSkip={onSkip} progress={progress} />
      <div className="flex-1 flex flex-col px-5 py-2">
        <p className="font-display text-xl font-semibold text-ink-900 mb-1">How do you budget today?</p>
        <p className="text-xs text-ink-500 mb-5 leading-relaxed">
          No right answer — just helps us understand where you're starting from.
        </p>
        <div className="space-y-2.5">
          {BUDGET_STYLES.map(({ id, label, emoji }) => {
            const sel = value === id;
            return (
              <button key={id} type="button" onClick={() => onChange(id)}
                className={cn(
                  "w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all",
                  sel ? "border-teal-500 bg-teal-50/60 shadow-sm" : "border-cream-200 bg-white hover:border-cream-300 hover:bg-cream-50",
                )}>
                <span className="text-2xl leading-none">{emoji}</span>
                <span className={cn("flex-1 text-sm font-medium", sel ? "text-teal-700" : "text-ink-900")}>
                  {label}
                </span>
                {sel && <OptionCheck />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue} disabled={!value}>Continue</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Screen: Done ─────────────────────────────────────────────────────────────
function ScreenDone({ busy, onContinue }: { busy: boolean; onContinue: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-8">
        <div className="h-24 w-24 rounded-3xl flex items-center justify-center shadow-xl"
          style={{ background: "linear-gradient(135deg,#2F8F7E 0%,#1B4243 100%)" }}>
          <Check size={44} className="text-white" strokeWidth={2} />
        </div>
        <div className="space-y-3">
          <p className="font-display text-3xl font-semibold text-ink-900">You're all set!</p>
          <p className="text-sm text-ink-500 leading-relaxed max-w-[280px] mx-auto">
            Your home base is ready. You can invite your household from Settings anytime.
          </p>
        </div>
      </div>
      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue} disabled={busy}>
          {busy ? "One moment…" : "Let's go"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Screen: Bank balance ─────────────────────────────────────────────────────
function ScreenBalance({ onContinue, onSkip, progress }: {
  onContinue: (amount: number) => void;
  onSkip: () => void;
  progress: { current: number; total: number };
}) {
  const [value, setValue] = useState("");
  const amount = parseFloat(value);
  const valid  = !isNaN(amount) && amount >= 0;

  return (
    <div className="flex flex-col flex-1">
      <TopBar onSkip={onSkip} progress={progress} />
      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-6">
        <div>
          <p className="font-display text-xl font-semibold text-ink-900 mb-2">What's your current balance?</p>
          <p className="text-xs text-ink-500 leading-relaxed max-w-[260px] mx-auto">
            We'll use this as your starting point. A rough estimate is totally fine.
          </p>
        </div>
        <div className="relative w-full max-w-[240px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-semibold select-none"
            style={{ color: value ? "#1c1917" : "#a8a29e" }}>
            $
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="w-full pl-10 pr-4 py-4 font-display text-3xl font-semibold text-ink-900 tabular-nums text-center border-2 border-cream-200 rounded-2xl outline-none focus:border-teal-500 transition-colors"
          />
        </div>
        <button type="button" onClick={onSkip}
          className="text-xs text-ink-400 hover:text-ink-600 transition-colors underline underline-offset-2">
          Skip for now
        </button>
      </div>
      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={() => onContinue(amount)} disabled={!valid}>Continue</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Screen: Add event ────────────────────────────────────────────────────────
function ScreenAddEvent({ onSkip, progress }: {
  onSkip: () => void;
  progress: { current: number; total: number };
}) {
  const [phase, setPhase]   = useState<"form" | "added">("form");
  const [title, setTitle]   = useState("");
  const [date, setDate]     = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime]     = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const [addedTitle, setAddedTitle] = useState("");

  const inputCls = "h-10 w-full rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-ink-400";

  function buildDateTime(d: string, t: string) {
    return t ? `${d}T${t}:00` : `${d}T00:00:00`;
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true); setErr(null);
    try {
      const startAt = buildDateTime(date, startTime);
      const endAt   = endTime ? buildDateTime(date, endTime) : startAt;
      await api("/api/calendar", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), startAt, endAt }),
      });
      setAddedTitle(title.trim());
      setPhase("added");
      setTitle(""); setDate(""); setStartTime(""); setEndTime("");
    } catch {
      setErr("Couldn't save the event. You can always add it later.");
    } finally {
      setSaving(false);
    }
  }

  function addAnother() {
    setPhase("form");
    setErr(null);
  }

  if (phase === "added") {
    return (
      <div className="flex flex-col flex-1">
        <TopBar onSkip={onSkip} progress={progress} />
        <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-6">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shadow-md"
            style={{ background: "linear-gradient(135deg,#D0EDE8,#EAF5F3)" }}>
            ✅
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-ink-900 mb-2">"{addedTitle}" added!</p>
            <p className="text-sm text-ink-500">Would you like to add another event?</p>
          </div>
          <div className="w-full space-y-2">
            <PrimaryBtn onClick={addAnother}>Add another event</PrimaryBtn>
            <button type="button" onClick={onSkip}
              className="w-full h-10 text-sm font-medium text-ink-500 hover:text-ink-700 transition-colors">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <TopBar onSkip={onSkip} progress={progress} />
      <div className="flex-1 flex flex-col px-5 py-2 overflow-y-auto">
        <p className="font-display text-xl font-semibold text-ink-900 mb-1">Add a family event</p>
        <p className="text-xs text-ink-500 mb-5 leading-relaxed">
          Drop something on the calendar to get started — a birthday, appointment, anything.
        </p>
        <form onSubmit={addEvent} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Event name</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Doctor's appointment" className={inputCls} required />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">Start time <span className="normal-case font-normal text-ink-400">(optional)</span></label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">End time <span className="normal-case font-normal text-ink-400">(optional)</span></label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className={inputCls} />
            </div>
          </div>
          {err && <p className="text-xs text-rust-600">{err}</p>}
          <div className="pt-2 space-y-2">
            <PrimaryBtn disabled={saving || !title.trim() || !date}>
              {saving ? "Saving…" : "Add event"}
            </PrimaryBtn>
            <button type="button" onClick={onSkip}
              className="w-full h-10 text-sm font-medium text-ink-500 hover:text-ink-700 transition-colors">
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();

  const [screen, setScreen]             = useState<ScreenId>("welcome");
  const [dir, setDir]                   = useState(1);
  const [features, setFeatures]         = useState<string[]>([]);
  const [householdType, setHouseholdType] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [budgetStyle, setBudgetStyle]   = useState("");
  const [bankBalance, setBankBalance]   = useState<number | null>(null);
  const [busy, setBusy]                 = useState(false);

  function goNext() {
    setDir(1);
    setScreen(s => nextScreen(s, features, householdType));
  }
  function goBack() {
    setDir(-1);
    setScreen(s => prevScreen(s, features, householdType));
  }

  function toggleFeature(id: string) {
    setFeatures(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  }

  async function finish() {
    setBusy(true);
    const quizAnswers: Record<string, string> = {};
    if (features.length)  quizAnswers.features      = features.join(",");
    if (householdType)    quizAnswers.householdType  = householdType;
    if (householdSize)    quizAnswers.householdSize  = householdSize;
    if (budgetStyle)      quizAnswers.budgetStyle    = budgetStyle;

    try {
      await api("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({ quizAnswers, startingBalance: bankBalance }),
      });
    } catch { /* never block navigation */ }

    navigate("/home", { replace: true });
  }

  // Progress dots for middle screens (everything between welcome and done)
  const flow = buildFlow(features, householdType);
  const middle = flow.filter(s => s !== "welcome" && s !== "done") as ScreenId[];
  const midIdx = middle.indexOf(screen);
  const progress = midIdx >= 0 ? { current: midIdx, total: middle.length } : undefined;

  function renderScreen() {
    switch (screen) {
      case "welcome":
        return <ScreenWelcome onContinue={goNext} />;

      case "features":
        return (
          <ScreenFeatures
            selected={features}
            onToggle={toggleFeature}
            onBack={goBack}
            onSkip={goNext}
            onContinue={goNext}
            progress={progress!}
          />
        );

      case "household":
        return (
          <ScreenHousehold
            value={householdType}
            onChange={setHouseholdType}
            onBack={goBack}
            onSkip={goNext}
            onContinue={goNext}
            progress={progress!}
          />
        );

      case "householdSize":
        return (
          <ScreenHouseholdSize
            householdType={householdType}
            value={householdSize}
            onChange={setHouseholdSize}
            onBack={goBack}
            onSkip={goNext}
            onContinue={goNext}
            progress={progress!}
          />
        );

      case "budgetStyle":
        return (
          <ScreenBudgetStyle
            value={budgetStyle}
            onChange={setBudgetStyle}
            onBack={goBack}
            onSkip={goNext}
            onContinue={goNext}
            progress={progress!}
          />
        );

      case "balance":
        return (
          <ScreenBalance
            onContinue={(amount) => { setBankBalance(amount); goNext(); }}
            onSkip={goNext}
            progress={progress!}
          />
        );

      case "addEvent":
        return (
          <ScreenAddEvent
            onSkip={goNext}
            progress={progress!}
          />
        );

      case "done":
        return <ScreenDone busy={busy} onContinue={finish} />;

      default:
        return null;
    }
  }

  return (
    <Shell>
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={screen}
          custom={dir}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={T}
          className="flex flex-col flex-1"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}
