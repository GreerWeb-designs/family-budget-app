import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Home, Wallet, HousePlus, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

const TABS = [
  {
    to: "/home",
    label: "Overview",
    icon: Home,
    activeFor: [] as string[],
  },
  {
    to: "/budget",
    label: "Finances",
    icon: Wallet,
    activeFor: ["/budget", "/bills", "/debts"],
  },
  {
    to: "/goals",
    label: "Household",
    icon: HousePlus,
    activeFor: ["/goals", "/calendar", "/grocery", "/chores", "/recipes", "/meals"],
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    activeFor: [] as string[],
  },
] as const;

/**
 * Fixed bottom tab bar — 4 tabs, Lucide icons only.
 * Active tab: teal-500 icon + label, teal-100 pill behind icon.
 * Tab activation triggers a subtle icon bounce.
 */
export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className={cn(
        "mobile-bottom-nav",
        "lg:hidden fixed bottom-0 left-0 right-0 z-30",
        "flex border-t border-cream-200",
        "bg-[#FFFDF8]/95 backdrop-blur-sm"
      )}
      aria-label="Main navigation"
    >
      {TABS.map(({ to, label, icon: Icon, activeFor }) => {
        const active =
          pathname === to ||
          (activeFor.length > 0 &&
            activeFor.some((p) => pathname === p || pathname.startsWith(p + "/")));

        return (
          <NavLink
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5",
              "text-[10px] font-medium transition-colors duration-150",
              active ? "text-teal-500" : "text-ink-500"
            )}
            aria-current={active ? "page" : undefined}
          >
            <div className="relative flex items-center justify-center w-10 h-7">
              {/* Active background pill */}
              {active && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-0 rounded-full bg-teal-100"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              {/* Icon — bounces when tab becomes active */}
              <motion.span
                className="relative z-10"
                animate={active ? { y: [0, -3, 0] } : { y: 0 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.8}
                  aria-hidden
                />
              </motion.span>
            </div>
            <span className={cn("leading-none", active && "font-semibold")}>
              {label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
