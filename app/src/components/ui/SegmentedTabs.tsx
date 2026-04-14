import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface SegmentedTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** Allow horizontal scroll when tabs overflow (e.g. Household row) */
  scrollable?: boolean;
  className?: string;
  /** Unique layoutId so multiple instances on the same page don't fight */
  layoutId?: string;
}

/**
 * Pill-shaped tab switcher.
 * Active state: teal-500 bg + white text, animated sliding pill via layoutId.
 * Inactive: ink-500 text, transparent bg.
 */
export function SegmentedTabs({
  tabs,
  activeId,
  onChange,
  scrollable = false,
  className,
  layoutId = "seg-pill",
}: SegmentedTabsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-xl",
        "bg-cream-100 border border-cream-200",
        scrollable && "overflow-x-auto scrollbar-hide",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              "text-sm font-medium whitespace-nowrap",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-1",
              active ? "text-white" : "text-ink-500 hover:text-ink-700"
            )}
          >
            {/* Animated background pill */}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-teal-500"
                style={{ zIndex: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            {/* Content sits above the pill */}
            {tab.icon && (
              <span className="relative z-10 flex-shrink-0">{tab.icon}</span>
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
