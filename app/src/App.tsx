import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Settings as SettingsIcon,
  LogOut, RefreshCw,
  ChevronDown, ChevronRight,
  Home, Wallet, HousePlus,
  PieChart, Receipt, CreditCard,
  Target, CalendarDays, BookOpen, Utensils, ShoppingCart, CheckSquare,
  BarChart2,
} from "lucide-react";
import { api } from "./lib/api";
import { cn, money } from "./lib/utils";
import { UserProvider, useUser } from "./lib/UserContext";
import { canAccess, isDependent } from "./lib/permissions";
import { Wordmark, SegmentedTabs, BottomNav, ToastProvider } from "./components/ui";
import { Splash } from "./components/Splash";
import { useIsMobile } from "./hooks/useIsMobile";

import Login          from "./pages/Login";
import Signup         from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword  from "./pages/ResetPassword";
import CheckEmail     from "./pages/CheckEmail";
import VerifyEmail    from "./pages/VerifyEmail";
import Home_          from "./pages/Home";
import Budget         from "./pages/Budget";
import Bills          from "./pages/Bills";
import Calendar       from "./pages/Calendar";
import Goals          from "./pages/Goals";
import Debts          from "./pages/Debts";
import SettingsPage   from "./pages/Settings";
import JoinHousehold  from "./pages/JoinHousehold";
import Onboarding     from "./pages/Onboarding";
import Grocery        from "./pages/Grocery";
import Chores         from "./pages/Chores";
import Recipes        from "./pages/Recipes";
import Meals          from "./pages/Meals";
import Spending       from "./pages/Spending";
import DesignSystem   from "./pages/DesignSystem";

// ── Types ─────────────────────────────────────────────────────────────────────

type Totals = {
  bankBalance: number;
  totalIncome: number;
  totalBudgeted: number;
  toBeBudgeted: number;
};

type NavChild = { to: string; label: string; icon: ReactNode };
type NavGroup = {
  to: string; label: string; icon: ReactNode;
  exact?: boolean; children?: NavChild[];
};

// ── Navigation data ───────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  { to: "/home",          label: "Overview",  icon: <Home size={16} />,        exact: true },
  {
    to: "/finances",      label: "Finances",  icon: <Wallet size={16} />,
    children: [
      { to: "/budget",    label: "Budget",    icon: <PieChart size={14} /> },
      { to: "/spending",  label: "Spending",  icon: <BarChart2 size={14} /> },
      { to: "/bills",     label: "Bills",     icon: <Receipt size={14} /> },
      { to: "/debts",     label: "Debts",     icon: <CreditCard size={14} /> },
    ],
  },
  {
    to: "/household-hub", label: "Household", icon: <HousePlus size={16} />,
    children: [
      { to: "/goals",     label: "Goals",     icon: <Target size={14} /> },
      { to: "/calendar",  label: "Calendar",  icon: <CalendarDays size={14} /> },
      { to: "/recipes",   label: "Recipes",   icon: <BookOpen size={14} /> },
      { to: "/meals",     label: "Meal plan", icon: <Utensils size={14} /> },
      { to: "/grocery",   label: "Grocery",   icon: <ShoppingCart size={14} /> },
      { to: "/chores",    label: "Chores",    icon: <CheckSquare size={14} /> },
    ],
  },
  { to: "/settings",      label: "Settings",  icon: <SettingsIcon size={16} />, exact: true },
];

const SUB_NAV: Record<string, { to: string; label: string; icon: ReactNode }[]> = {
  finances: [
    { to: "/budget",   label: "Budget",    icon: <PieChart size={13} /> },
    { to: "/spending", label: "Spending",  icon: <BarChart2 size={13} /> },
    { to: "/bills",    label: "Bills",     icon: <Receipt size={13} /> },
    { to: "/debts",    label: "Debts",     icon: <CreditCard size={13} /> },
  ],
  household: [
    { to: "/goals",    label: "Goals",     icon: <Target size={13} /> },
    { to: "/calendar", label: "Calendar",  icon: <CalendarDays size={13} /> },
    { to: "/recipes",  label: "Recipes",   icon: <BookOpen size={13} /> },
    { to: "/meals",    label: "Meal plan", icon: <Utensils size={13} /> },
    { to: "/grocery",  label: "Grocery",   icon: <ShoppingCart size={13} /> },
    { to: "/chores",   label: "Chores",    icon: <CheckSquare size={13} /> },
  ],
};

const ROUTE_GROUP: Record<string, string> = {
  "/budget":   "finances",
  "/spending": "finances",
  "/bills":    "finances",
  "/debts":    "finances",
  "/goals":    "household",
  "/calendar": "household",
  "/recipes":  "household",
  "/meals":    "household",
  "/grocery":  "household",
  "/chores":   "household",
};

// ── Auth spinner ──────────────────────────────────────────────────────────────

function AuthSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-teal-100 border-t-teal-500 animate-spin" />
        <div className="text-sm text-ink-500">Loading…</div>
      </div>
    </div>
  );
}

// ── Auth guards ───────────────────────────────────────────────────────────────

type MeResponse = {
  ok: boolean; userId: string; name: string;
  email: string; onboardingCompletedAt: string | null;
};

function Protected({ children }: { children: ReactElement }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    api<MeResponse>("/api/auth/me")
      .then((me) => {
        if (!alive) return;
        if (!me.onboardingCompletedAt) nav("/onboarding", { replace: true });
        else setOk(true);
      })
      .catch(() => { if (!alive) return; nav("/login", { replace: true }); });
    return () => { alive = false; };
  }, [nav]);

  if (ok === null) return <AuthSpinner />;
  return children;
}

function ProtectedOnboarding({ children }: { children: ReactElement }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    api<MeResponse>("/api/auth/me")
      .then((me) => {
        if (!alive) return;
        if (me.onboardingCompletedAt) nav("/home", { replace: true });
        else setOk(true);
      })
      .catch(() => { if (!alive) return; nav("/login", { replace: true }); });
    return () => { alive = false; };
  }, [nav]);

  if (ok === null) return <AuthSpinner />;
  return children;
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sz = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div className={cn(
      "flex shrink-0 items-center justify-center rounded-full font-bold",
      "bg-teal-500 text-white", sz
    )}>
      {initials}
    </div>
  );
}

function TbbPill({ tbb, loading }: { tbb: number; loading: boolean }) {
  const positive = tbb >= 0;
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums border",
      positive
        ? "bg-teal-50 text-teal-600 border-teal-300/50"
        : "bg-rust-50 text-rust-600 border-rust-300/50"
    )}>
      <span className="text-[10px] uppercase tracking-wider opacity-60">TBB</span>
      <span>{loading ? "—" : money(tbb)}</span>
    </div>
  );
}

// ── Sub-nav strip (uses SegmentedTabs) ────────────────────────────────────────

function SubNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();

  const groupKey = Object.entries(ROUTE_GROUP).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/")
  )?.[1];

  const tabs = groupKey ? SUB_NAV[groupKey] : null;
  if (!tabs) return null;

  const activeId =
    tabs.find(t => pathname === t.to || pathname.startsWith(t.to + "/"))?.to ??
    tabs[0]?.to ?? "";

  return (
    <div
      className="sticky z-10 px-4 py-2 bg-cream-50/95 backdrop-blur-sm border-b border-cream-200"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
    >
      <SegmentedTabs
        layoutId="sub-nav-pill"
        scrollable
        tabs={tabs.map(t => ({ id: t.to, label: t.label, icon: t.icon }))}
        activeId={activeId}
        onChange={(id) => nav(id)}
      />
    </div>
  );
}

// ── Page meta (title + icon for top bar) ─────────────────────────────────────

function usePageMeta() {
  const { pathname } = useLocation();
  return useMemo((): { title: string; icon: ReactNode } => {
    if (pathname.startsWith("/budget"))   return { title: "Budget",    icon: <PieChart size={18} /> };
    if (pathname.startsWith("/bills"))    return { title: "Bills",     icon: <Receipt size={18} /> };
    if (pathname.startsWith("/debts"))    return { title: "Debts",     icon: <CreditCard size={18} /> };
    if (pathname.startsWith("/goals"))    return { title: "Goals",     icon: <Target size={18} /> };
    if (pathname.startsWith("/calendar")) return { title: "Calendar",  icon: <CalendarDays size={18} /> };
    if (pathname.startsWith("/grocery"))  return { title: "Grocery",   icon: <ShoppingCart size={18} /> };
    if (pathname.startsWith("/chores"))   return { title: "Chores",    icon: <CheckSquare size={18} /> };
    if (pathname.startsWith("/recipes"))  return { title: "Recipes",   icon: <BookOpen size={18} /> };
    if (pathname.startsWith("/meals"))    return { title: "Meal plan", icon: <Utensils size={18} /> };
    if (pathname.startsWith("/settings")) return { title: "Settings",  icon: <SettingsIcon size={18} /> };
    return { title: "Overview", icon: null };
  }, [pathname]);
}

// ── App Shell ─────────────────────────────────────────────────────────────────

function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { title: pageTitle, icon: pageIcon } = usePageMeta();

  const [totals, setTotals]               = useState<Totals | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userName  = user?.name  ?? "";
  const userEmail = user?.email ?? "";
  const tbb       = Number(totals?.toBeBudgeted ?? 0);

  // Auto-expand the active sidebar group
  useEffect(() => {
    const path = location.pathname;
    if (["/budget", "/bills", "/debts"].some(p => path === p || path.startsWith(p + "/")))
      setExpandedGroups(prev => [...new Set([...prev, "finances"])]);
    if (["/goals", "/calendar", "/grocery", "/chores", "/recipes", "/meals"].some(
      p => path === p || path.startsWith(p + "/")
    ))
      setExpandedGroups(prev => [...new Set([...prev, "household"])]);
  }, [location.pathname]);

  // Load totals on mount
  useEffect(() => { refreshTotals(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function refreshTotals() {
    setLoadingTotals(true);
    try { const t = await api<Totals>("/api/totals"); setTotals(t); }
    catch { setTotals(null); }
    finally { setLoadingTotals(false); }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); }
    finally { nav("/login", { replace: true }); }
  }

  return (
    <div className="flex min-h-screen bg-cream-50 overflow-x-hidden w-full">

      {/* ── Desktop Sidebar ───────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0 fixed left-0 top-0 bottom-0 z-30 overflow-y-auto bg-cream-50"
        style={{ borderRight: "1px solid var(--color-cream-200)" }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <Wordmark size="xl" />
          <p className="mt-1 text-[11px] text-ink-500">
            Your family, organized.
          </p>
        </div>

        {/* Ready to Assign card */}
        <div className="px-3 pb-4">
          <div className={cn(
            "rounded-lg px-4 py-3 border",
            tbb < 0
              ? "bg-rust-50 border-rust-500/30"
              : "bg-teal-50 border-teal-500/20"
          )}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-ink-500">
              Ready to assign
            </div>
            <div
              className={cn("text-2xl font-medium tabular-nums leading-tight",
                tbb < 0 ? "text-rust-600" : "text-teal-700"
              )}
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              {loadingTotals ? "—" : money(tbb)}
            </div>
            <div className="text-[11px] mt-0.5 text-ink-500">
              Available to budget
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_GROUPS.map((group) => {
            // Permission filtering for dependent accounts
            const visibleChildren = group.children?.filter((child) => {
              if (child.to === "/budget") return canAccess(user, "can_see_budget");
              if (child.to === "/bills")  return canAccess(user, "can_see_bills");
              if (child.to === "/debts")  return canAccess(user, "can_see_debts");
              if (child.to === "/goals")  return canAccess(user, "can_see_goals");
              return true;
            });
            if (group.label === "Finances" && isDependent(user) && visibleChildren?.length === 0)
              return null;
            const g = visibleChildren ? { ...group, children: visibleChildren } : group;

            // Simple link (no children)
            if (!g.children) {
              return (
                <NavLink
                  key={g.to}
                  to={g.to}
                  end={g.exact}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "text-teal-700 bg-teal-500/10"
                      : "text-ink-500 hover:text-ink-900 hover:bg-cream-100"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn("shrink-0", isActive ? "text-teal-500" : "")}>
                        {g.icon}
                      </span>
                      <span>{g.label}</span>
                      {isActive && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-500" />
                      )}
                    </>
                  )}
                </NavLink>
              );
            }

            // Expandable group
            const groupKey = g.label.toLowerCase();
            const isExpanded = expandedGroups.includes(groupKey);
            const hasActiveChild = g.children.some(
              c => location.pathname === c.to || location.pathname.startsWith(c.to + "/")
            );

            return (
              <div key={g.to}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups(prev =>
                      prev.includes(groupKey)
                        ? prev.filter(x => x !== groupKey)
                        : [...prev, groupKey]
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    hasActiveChild
                      ? "text-teal-700 bg-teal-500/10 border-l-2 border-teal-500 pl-2.5"
                      : "text-ink-500 hover:text-ink-900 hover:bg-cream-100"
                  )}
                >
                  <span className="shrink-0">{g.icon}</span>
                  <span>{g.label}</span>
                  <span className="ml-auto text-ink-300">
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-0.5 space-y-0.5 pl-4">
                    {g.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) => cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                          isActive
                            ? "text-teal-700 bg-teal-500/10"
                            : "text-ink-500 hover:text-ink-900 hover:bg-cream-100"
                        )}
                      >
                        <span className="shrink-0">{child.icon}</span>
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 space-y-1 border-t border-cream-200">
          {userName && (
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              <UserAvatar name={userName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-ink-900">{userName}</div>
                {userEmail && (
                  <div className="truncate text-[10px] text-ink-500">
                    {userEmail}
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={refreshTotals}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all text-ink-500 hover:text-ink-900 hover:bg-cream-100"
          >
            <RefreshCw size={13} />
            <span>Refresh totals</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all text-ink-500 hover:text-rust-600 hover:bg-rust-50"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:ml-60 min-w-0 w-full">

        {/* Top bar */}
        <header
          className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-cream-200 bg-cream-50/95 backdrop-blur-sm px-4 md:px-6"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >

          {/* Left: Wordmark on mobile, page title on desktop */}
          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <Wordmark size="xs" />
            </div>
            <div className="hidden lg:flex items-center gap-2">
              {pageIcon && (
                <span className="text-teal-500 shrink-0" aria-hidden>{pageIcon}</span>
              )}
              <h1
                className="text-lg font-medium text-ink-900 leading-tight"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                {pageTitle}
              </h1>
            </div>
          </div>

          {/* Right: TBB pill + user dropdown */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:block">
              <TbbPill tbb={tbb} loading={loadingTotals} />
            </div>

            {userName && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                  onClick={() => setDropdownOpen(o => !o)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-cream-100"
                >
                  <UserAvatar name={userName} />
                  <span className="hidden sm:block max-w-[120px] truncate text-xs font-medium text-ink-500">
                    {userName}
                  </span>
                  <ChevronDown
                    size={12}
                    className={cn("text-ink-400 transition-transform duration-200", dropdownOpen && "rotate-180")}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-cream-200 shadow-float z-50 overflow-hidden"
                    style={{ backgroundColor: "#FFFDF8" }}>
                    <div className="px-4 py-3 border-b border-cream-200">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={userName} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink-900 truncate">{userName}</div>
                          {userEmail && (
                            <div className="text-xs text-ink-500 truncate">{userEmail}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="py-1.5">
                      <button type="button"
                        onClick={() => { setDropdownOpen(false); nav("/settings"); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-900 hover:bg-cream-100 transition-colors">
                        <SettingsIcon size={14} className="text-ink-500" />
                        Settings
                      </button>
                      <button type="button"
                        onClick={() => { setDropdownOpen(false); nav("/settings#household"); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-900 hover:bg-cream-100 transition-colors">
                        <HousePlus size={14} className="text-ink-500" />
                        Household
                      </button>
                      <button type="button"
                        onClick={() => { setDropdownOpen(false); refreshTotals(); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-900 hover:bg-cream-100 transition-colors">
                        <RefreshCw size={14} className="text-ink-500" />
                        Refresh totals
                      </button>
                    </div>
                    <div className="py-1.5 border-t border-cream-200">
                      <button type="button"
                        onClick={() => { setDropdownOpen(false); logout(); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-danger hover:bg-rust-50 transition-colors">
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Sub-nav strip */}
        <SubNav />

        {/* Page content */}
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6 max-w-300 w-full mx-auto min-w-0 overflow-x-hidden">
          {children}
        </main>

        {/* Spacer so content isn't hidden behind mobile nav */}
        <div className="mobile-tab-spacer lg:hidden" />
      </div>

      {/* Mobile bottom nav — uses the Phase 1 primitive */}
      <BottomNav />
    </div>
  );
}

// ── Layout wrapper ────────────────────────────────────────────────────────────

function ProtectedLayout({ children }: { children: ReactElement }) {
  return (
    <Protected>
      <AppShell>{children}</AppShell>
    </Protected>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const isMobile = useIsMobile();
  // Desktop skips splash entirely; mobile shows it once per session
  const [splashDone, setSplashDone] = useState(() => {
    if (!isMobile) return true;
    if (sessionStorage.getItem("nestotter_splashed")) return true;
    sessionStorage.setItem("nestotter_splashed", "1");
    return false;
  });

  return (
    <>
      {!splashDone && isMobile && (
        <Splash onDone={() => setSplashDone(true)} />
      )}
      <UserProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login"           element={<Login />} />
            <Route path="/signup"          element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            <Route path="/check-email"     element={<CheckEmail />} />
            <Route path="/verify-email"    element={<VerifyEmail />} />
            <Route path="/"                element={<Navigate to="/home" replace />} />
            <Route path="/onboarding"      element={<ProtectedOnboarding><Onboarding /></ProtectedOnboarding>} />
            <Route path="/home"            element={<ProtectedLayout><Home_ /></ProtectedLayout>} />
            <Route path="/finances"        element={<Navigate to="/budget" replace />} />
            <Route path="/budget"          element={<ProtectedLayout><Budget /></ProtectedLayout>} />
            <Route path="/spending"        element={<ProtectedLayout><Spending /></ProtectedLayout>} />
            <Route path="/bills"           element={<ProtectedLayout><Bills /></ProtectedLayout>} />
            <Route path="/debts"           element={<ProtectedLayout><Debts /></ProtectedLayout>} />
            <Route path="/household-hub"   element={<Navigate to="/goals" replace />} />
            <Route path="/goals"           element={<ProtectedLayout><Goals /></ProtectedLayout>} />
            <Route path="/calendar"        element={<ProtectedLayout><Calendar /></ProtectedLayout>} />
            <Route path="/grocery"         element={<ProtectedLayout><Grocery /></ProtectedLayout>} />
            <Route path="/chores"          element={<ProtectedLayout><Chores /></ProtectedLayout>} />
            <Route path="/recipes"         element={<ProtectedLayout><Recipes /></ProtectedLayout>} />
            <Route path="/meals"           element={<ProtectedLayout><Meals /></ProtectedLayout>} />
            <Route path="/settings"        element={<ProtectedLayout><SettingsPage /></ProtectedLayout>} />
            <Route path="/join/:code"      element={<JoinHousehold />} />
            <Route path="/design-system"   element={<DesignSystem />} />
            <Route path="*"               element={<Navigate to="/home" replace />} />
          </Routes>
        </ToastProvider>
      </UserProvider>
    </>
  );
}
