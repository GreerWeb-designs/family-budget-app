import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Call toast("Message") or toast("Oops", "error") anywhere inside ToastProvider. */
export function useToast(): ToastContextValue["toast"] {
  return useContext(ToastContext).toast;
}

// ── Toaster (renders the stack) ───────────────────────────────────────────────

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Individual Toast ──────────────────────────────────────────────────────────

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
};

const borderColors: Record<ToastType, string> = {
  success: "border-l-teal-500",
  error:   "border-l-danger",
  info:    "border-l-rust-500",
};

const iconColors: Record<ToastType, string> = {
  success: "text-teal-500",
  error:   "text-danger",
  info:    "text-rust-500",
};

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const Icon = icons[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{    opacity: 0, y: 6,  scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "flex min-w-[260px] max-w-[340px] items-center gap-3 rounded-lg px-4 py-3",
        "border-l-4 shadow-float",
        "bg-[#FFFDF8] border border-cream-200",
        borderColors[item.type]
      )}
      role="status"
    >
      <Icon size={16} className={cn("flex-shrink-0", iconColors[item.type])} />
      <span className="flex-1 text-sm font-medium text-ink-900">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 text-ink-300 hover:text-ink-500 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
