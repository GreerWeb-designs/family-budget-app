import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { PanInfo } from "motion/react";
import { HeartPulse, TrendingUp, Compass, ArrowLeft, Check } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const QUIZ_KEY = "familybudget_quiz";

// ─── Data ─────────────────────────────────────────────────────────────────────

const VALUE_CARDS = [
  { Icon: HeartPulse, phrase: "Less Stress",  bg: "linear-gradient(135deg, #f0fdfb 0%, #ccfbf1 100%)", iconColor: "#0F766E" },
  { Icon: TrendingUp, phrase: "More Savings", bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", iconColor: "#D97706" },
  { Icon: Compass,    phrase: "More Control", bg: "linear-gradient(135deg, #f0fdfb 0%, #fef3c7 100%)", iconColor: "#0F766E" },
];

const TOUR_CARDS = [
  { headline: "Track every dollar",        desc: "Know exactly where your money goes each month, down to the last cent.",        keyword: "savings"  },
  { headline: "Set goals together",        desc: "Plan for the things that matter — a home, a trip, your kids' future.",          keyword: "goals"    },
  { headline: "See where it goes",         desc: "Visual charts show your spending patterns at a glance.",                        keyword: "analysis" },
  { headline: "Plan ahead",               desc: "Bills and recurring expenses are always in sight — no more surprises.",          keyword: "schedule" },
  { headline: "Stay in sync as a family", desc: "Your whole household sees the same picture in real time.",                       keyword: "team"     },
];

const QUIZ_QUESTIONS = [
  {
    id: "feeling",
    q: "How do you feel about your finances right now?",
    options: [
      { emoji: "😰", label: "Stressed" },
      { emoji: "😐", label: "Uncertain" },
      { emoji: "🙂", label: "Okay" },
      { emoji: "😎", label: "In control" },
    ],
  },
  {
    id: "challenge",
    q: "What's your biggest money challenge?",
    options: [
      { emoji: "🎯", label: "No clear goals" },
      { emoji: "🐢", label: "I overspend" },
      { emoji: "💸", label: "Surprise expenses" },
      { emoji: "📊", label: "Don't track anything" },
    ],
  },
  {
    id: "frequency",
    q: "How often do you check your accounts?",
    options: [
      { emoji: "📅", label: "Daily" },
      { emoji: "📆", label: "Weekly" },
      { emoji: "🗓️", label: "Monthly" },
      { emoji: "🤷", label: "Rarely" },
    ],
  },
  {
    id: "priority",
    q: "What matters most to you?",
    options: [
      { emoji: "🏠", label: "Saving for a home" },
      { emoji: "✈️", label: "Travel" },
      { emoji: "🎓", label: "Kids' future" },
      { emoji: "🛡️", label: "Emergency fund" },
      { emoji: "🎯", label: "Just feeling in control" },
    ],
  },
];

// ─── Animation ────────────────────────────────────────────────────────────────

const stepVariants = {
  enter:  (d: number) => ({ x: d * 8, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d * -8, opacity: 0 }),
};
const TRANSITION = { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const };

const valVariants = {
  enter:  { y: 12, opacity: 0 },
  center: { y: 0,  opacity: 1 },
  exit:   { y: -8, opacity: 0 },
};

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col md:items-center md:justify-center"
      style={{ background: "linear-gradient(135deg, #f0fdfb 0%, #fffbeb 100%)" }}
    >
      <div className={cn(
        "relative flex flex-col bg-white w-full min-h-svh",
        "md:min-h-0 md:rounded-3xl md:shadow-2xl md:max-w-[520px] md:my-10 md:overflow-hidden",
      )}>
        {children}
      </div>
    </div>
  );
}

// ─── TopBar (back + optional right action) ────────────────────────────────────

function TopBar({
  onBack,
  right,
}: {
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
      <div className="w-9">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
      </div>
      <div className="w-9 flex justify-end">{right}</div>
    </div>
  );
}

// ─── PrimaryBtn ───────────────────────────────────────────────────────────────

function PrimaryBtn({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 w-full rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-50",
        className,
      )}
      style={{ background: "var(--color-primary)" }}
    >
      {children}
    </button>
  );
}

// ─── Step 1: Value prop sequence ──────────────────────────────────────────────

function Step1ValueProp({ onComplete }: { onComplete: () => void }) {
  const reduced = useReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (reduced) return; // handled separately
    if (current >= VALUE_CARDS.length) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setCurrent((c) => c + 1), 1300);
    return () => clearTimeout(t);
  }, [current, reduced, onComplete]);

  // Reduced motion: static stacked list
  if (reduced) {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex-1 flex flex-col justify-center gap-4 p-8">
          {VALUE_CARDS.map(({ Icon, phrase, iconColor }, i) => (
            <div
              key={i}
              className="flex items-center gap-5 p-5 rounded-2xl bg-stone-50 border border-stone-100"
            >
              <Icon size={32} style={{ color: iconColor }} />
              <span className="font-display text-2xl font-semibold text-stone-900">{phrase}</span>
            </div>
          ))}
        </div>
        <div className="px-5 pb-8 shrink-0">
          <PrimaryBtn onClick={onComplete}>Get started</PrimaryBtn>
        </div>
      </div>
    );
  }

  // Normal: full-screen auto-advancing cards
  const card = VALUE_CARDS[current];
  if (!card) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        variants={valVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={TRANSITION}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ background: card.bg }}
      >
        <card.Icon size={48} style={{ color: card.iconColor }} strokeWidth={1.5} />
        <p
          className="font-display text-5xl font-semibold text-stone-900 mt-6 tracking-tight"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,.06)" }}
        >
          {card.phrase}
        </p>

        {/* Dots */}
        <div className="absolute bottom-12 flex gap-2">
          {VALUE_CARDS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === current ? "w-6 bg-stone-700" : "w-1.5 bg-stone-300",
              )}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Step 2: Tour carousel ────────────────────────────────────────────────────

function Step2Tour({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const [idx, setIdx]             = useState(0);
  const [tourDir, setTourDir]     = useState(1);
  const [paused, setPaused]       = useState(false);

  // Auto-advance every 4s, pauses on user interaction
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      setTourDir(1);
      setIdx((i) => (i + 1 < TOUR_CARDS.length ? i + 1 : i));
    }, 4000);
    return () => clearTimeout(t);
  }, [paused, idx]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    setPaused(true);
    if (info.offset.x < -50 || info.velocity.x < -500) {
      setTourDir(1);
      setIdx((i) => Math.min(i + 1, TOUR_CARDS.length - 1));
    } else if (info.offset.x > 50 || info.velocity.x > 500) {
      setTourDir(-1);
      setIdx((i) => Math.max(i - 1, 0));
    }
  }

  const card = TOUR_CARDS[idx];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar onBack={onBack} />

      {/* Carousel area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden select-none">
        <AnimatePresence mode="wait" custom={tourDir}>
          <motion.div
            key={idx}
            custom={tourDir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={TRANSITION}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="w-full cursor-grab active:cursor-grabbing"
          >
            <div className="rounded-2xl border border-stone-100 bg-stone-50 p-6 text-center space-y-5">
              {/* TODO: unDraw illustration — 400×260 — suggested keyword: "{card.keyword}"
                  Drop an <img src="..." alt="..." className="w-full h-auto rounded-xl" /> here */}
              <div className="h-[200px] rounded-xl bg-stone-100 flex items-center justify-center border border-dashed border-stone-200">
                <span className="text-xs text-stone-400 font-medium">
                  {/* TODO: replace with unDraw illustration — keyword: "{card.keyword}" — 400×260 */}
                  Illustration coming soon
                </span>
              </div>

              <div>
                <p className="font-display text-2xl font-semibold text-stone-900 mb-2">{card.headline}</p>
                <p className="text-sm text-stone-500 leading-relaxed">{card.desc}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination dots */}
        <div className="flex gap-2 mt-6">
          {TOUR_CARDS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => { setPaused(true); setTourDir(i > idx ? 1 : -1); setIdx(i); }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === idx ? "w-6 bg-teal-600" : "w-1.5 bg-stone-300",
              )}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue}>Continue</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Step 3: Quiz ─────────────────────────────────────────────────────────────

function Step3Quiz({
  quizIdx,
  answers,
  onAnswer,
  onBack,
  onSkip,
  onContinue,
}: {
  quizIdx: number;
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const q       = QUIZ_QUESTIONS[quizIdx];
  const selected = answers[q.id] ?? null;
  const progress = ((quizIdx + 1) / QUIZ_QUESTIONS.length) * 100;

  return (
    <div className="flex flex-col flex-1">
      {/* Progress bar */}
      <div className="h-1 bg-stone-100 shrink-0">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--color-primary)" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <TopBar
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
          >
            Skip
          </button>
        }
      />

      <div className="flex-1 flex flex-col px-5 py-2 overflow-y-auto">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
          Question {quizIdx + 1} of {QUIZ_QUESTIONS.length}
        </p>
        <p className="font-display text-xl font-semibold text-stone-900 mb-5 leading-snug">{q.q}</p>

        <div className="space-y-2.5">
          {q.options.map(({ emoji, label }) => {
            const isSelected = selected === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => onAnswer(q.id, label)}
                className={cn(
                  "w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all",
                  isSelected
                    ? "border-teal-500 bg-teal-50/60 shadow-sm"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
                )}
              >
                <span className="text-2xl leading-none">{emoji}</span>
                <span className={cn("flex-1 text-sm font-medium", isSelected ? "text-teal-900" : "text-stone-800")}>
                  {label}
                </span>
                {isSelected && (
                  <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-teal-600">
                    <Check size={11} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue} disabled={!selected}>
          Continue
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Step 4: Motivational interlude ───────────────────────────────────────────

function Step4Interlude({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <TopBar onBack={onBack} />

      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
        {/* TODO: unDraw illustration — 400×280 — suggested keyword: "together" or "people money"
            Drop an <img src="..." alt="..." className="w-full max-w-xs mx-auto mb-8" /> here */}
        <div className="w-full max-w-xs mx-auto mb-8 h-[200px] rounded-2xl bg-gradient-to-br from-teal-50 to-amber-50 border border-dashed border-stone-200 flex items-center justify-center">
          <span className="text-xs text-stone-400">
            {/* TODO: unDraw illustration — keyword: "together" — 400×280 */}
            Illustration coming soon
          </span>
        </div>

        <p className="font-display text-2xl font-semibold text-stone-900 leading-snug mb-3">
          You're not alone — and it gets better from here.
        </p>
        <p className="text-sm text-stone-500 leading-relaxed max-w-[320px]">
          Most families feel overwhelmed before they start. The hardest part is showing up.
        </p>
      </div>

      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue}>Let's go 💪</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Step 5: Commitment ───────────────────────────────────────────────────────

function Step5Commitment({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div className="flex flex-col flex-1">
      <TopBar onBack={onBack} />

      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
        {/* Brand mark */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl font-bold text-xl text-white mb-8 shadow-lg"
          style={{ background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" }}
        >
          DB
        </div>

        <p className="font-display text-2xl font-semibold text-stone-900 leading-snug mb-3">
          Ready to take control of your financial future?
        </p>
        <p className="text-sm text-stone-500 leading-relaxed max-w-[280px]">
          It starts with one small step.
        </p>
      </div>

      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={onContinue}>Get Started</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Step 6: Bank balance ─────────────────────────────────────────────────────

function Step6Balance({ onComplete }: { onComplete: (amount: number | null) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy]   = useState(false);
  const amount            = parseFloat(value) || 0;

  async function submit(skip: boolean) {
    setBusy(true);
    try {
      await onComplete(skip ? null : amount > 0 ? amount : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Top bar — no back arrow on step 6; skip link top right */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <div className="w-9" />
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={busy}
          className="text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
        >
          Skip for now
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center">
        <p className="font-display text-2xl font-semibold text-stone-900 mb-2">
          What's your current balance?
        </p>
        <p className="text-sm text-stone-500 mb-8">
          We'll use this as your starting point.
        </p>

        {/* Currency input */}
        <div className="relative w-full max-w-[280px]">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-semibold select-none"
            style={{ color: value ? "#1c1917" : "#a8a29e" }}
          >
            $
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            className="w-full pl-10 pr-4 py-4 font-display text-3xl font-semibold text-stone-900 tabular-nums text-center border-2 border-stone-200 rounded-2xl outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        <p className="text-xs text-stone-400 mt-4 max-w-[260px] leading-relaxed">
          Not sure of your exact balance? You can add it later — even a rough estimate works.
        </p>
      </div>

      <div className="px-5 pb-8 pt-4 shrink-0">
        <PrimaryBtn onClick={() => submit(false)} disabled={busy}>
          {busy ? "Saving…" : "Continue"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Main Onboarding orchestrator ─────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();

  // Redirect handled by ProtectedOnboarding guard in App.tsx — no localStorage check needed here.

  const [step, setStep]       = useState(1);
  const [dir, setDir]         = useState(1);  // 1=forward, -1=backward
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizDir, setQuizDir] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function goForward() {
    setDir(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setDir(-1);
    // Within quiz: go to previous question
    if (step === 3 && quizIdx > 0) {
      setQuizDir(-1);
      setQuizIdx((q) => q - 1);
      return;
    }
    // Back from step 4: return to last quiz question
    if (step === 4) {
      setQuizIdx(QUIZ_QUESTIONS.length - 1);
    }
    setStep((s) => Math.max(1, s - 1));
  }

  function skipToInterlude() {
    setDir(1);
    setStep(4);
  }

  function handleAnswer(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function advanceQuiz() {
    const saved = { ...answers };
    try { localStorage.setItem(QUIZ_KEY, JSON.stringify(saved)); } catch {}

    if (quizIdx < QUIZ_QUESTIONS.length - 1) {
      setQuizDir(1);
      setQuizIdx((q) => q + 1);
    } else {
      goForward(); // Step 3 → Step 4
    }
  }

  async function finish(amount: number | null) {
    const quizAnswers: Record<string, string> = {};
    try { Object.assign(quizAnswers, JSON.parse(localStorage.getItem(QUIZ_KEY) || "{}")); } catch {}

    try {
      await api("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          startingBalance: amount,
          quizAnswers: Object.keys(quizAnswers).length > 0 ? quizAnswers : undefined,
        }),
      });
    } catch {
      // Don't block navigation — worst case they re-see onboarding on next load,
      // but /api/onboarding/reset exists to recover.
    }

    // Clear cached quiz data
    try { localStorage.removeItem(QUIZ_KEY); } catch {}

    navigate("/home", { replace: true });
  }

  // Step 1 is special — full-screen auto-advancing, no Shell yet
  if (step === 1) {
    return <Step1ValueProp onComplete={goForward} />;
  }

  function renderStep() {
    switch (step) {
      case 2:
        return (
          <Step2Tour
            onBack={goBack}
            onContinue={goForward}
          />
        );
      case 3:
        return (
          <Step3Quiz
            quizIdx={quizIdx}
            answers={answers}
            onAnswer={handleAnswer}
            onBack={goBack}
            onSkip={skipToInterlude}
            onContinue={advanceQuiz}
          />
        );
      case 4:
        return <Step4Interlude onBack={goBack} onContinue={goForward} />;
      case 5:
        return <Step5Commitment onBack={goBack} onContinue={goForward} />;
      case 6:
        return <Step6Balance onComplete={finish} />;
      default:
        return null;
    }
  }

  // For quiz step, use quizDir for the AnimatePresence key so within-quiz
  // transitions animate properly without conflicting with inter-step transitions.
  const animKey = step === 3 ? `quiz-${quizIdx}` : `step-${step}`;
  const animDir = step === 3 ? quizDir : dir;

  return (
    <Shell>
      <AnimatePresence mode="wait" custom={animDir}>
        <motion.div
          key={animKey}
          custom={animDir}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={TRANSITION}
          className="flex flex-col flex-1"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}
