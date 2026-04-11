import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  LayoutDashboard, PieChart, Receipt, Target, CalendarDays,
  CreditCard, Settings, LogOut, RefreshCw, ChevronDown,
  Home as HomeIcon,
} from "lucide-react";
import { api } from "./lib/api";
import { cn, money } from "./lib/utils";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import Budget from "./pages/Budget";
import Bills from "./pages/Bills";
import Calendar from "./pages/Calendar";
import Goals from "./pages/Goals";
import Debts from "./pages/Debts";
import SettingsPage from "./pages/Settings";
import JoinHousehold from "./pages/JoinHousehold";
import Onboarding from "./pages/Onboarding";

type Totals = {
  bankBalance: number;
  totalIncome: number;
  totalBudgeted: number;
  toBeBudgeted: number;
};

const ONBOARDING_KEY = "familybudget_onboarded";

function AuthSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--sidebar-bg)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-teal-400/30 border-t-teal-400 animate-spin" />
        <div className="text-sm text-stone-500">Loading…</div>
      </div>
    </div>
  );
}

/** Guards main app routes — redirects to /login if unauthenticated, /onboarding if not yet onboarded. */
function Protected({ children }: { children: ReactElement }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    api<{ ok: boolean }>("/api/auth/me")
      .then(() => {
        if (!alive) return;
        if (localStorage.getItem(ONBOARDING_KEY) !== "true") {
          nav("/onboarding", { replace: true });
        } else {
          setOk(true);
        }
      })
      .catch(() => { if (!alive) return; nav("/login", { replace: true }); });
    return () => { alive = false; };
  }, [nav]);

  if (ok === null) return <AuthSpinner />;
  return children;
}

/** Guards the onboarding route — only checks auth (no onboarding flag check to avoid redirect loop). */
function ProtectedOnboarding({ children }: { children: ReactElement }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    api<{ ok: boolean }>("/api/auth/me")
      .then(() => { if (alive) setOk(true); })
      .catch(() => { if (!alive) return; nav("/login", { replace: true }); });
    return () => { alive = false; };
  }, [nav]);

  if (ok === null) return <AuthSpinner />;
  return children;
}

const NAV_ITEMS = [
  { to: "/home",     label: "Overview",  Icon: LayoutDashboard },
  { to: "/budget",   label: "Budget",    Icon: PieChart },
  { to: "/bills",    label: "Bills",     Icon: Receipt },
  { to: "/goals",    label: "Goals",     Icon: Target },
  { to: "/calendar", label: "Calendar",  Icon: CalendarDays },
  { to: "/debts",    label: "Debts",     Icon: CreditCard },
  { to: "/settings", label: "Settings",  Icon: Settings },
];

const MOBILE_NAV = [
  { to: "/home",     label: "Home",     Icon: HomeIcon },
  { to: "/budget",   label: "Budget",   Icon: PieChart },
  { to: "/bills",    label: "Bills",    Icon: Receipt },
  { to: "/goals",    label: "Goals",    Icon: Target },
  { to: "/calendar", label: "Cal",      Icon: CalendarDays },
  { to: "/debts",    label: "Debts",    Icon: CreditCard },
  { to: "/settings", label: "Settings", Icon: Settings },
];

function SideLink({ to, label, Icon }: { to: string; label: string; Icon: React.FC<{ size?: number; className?: string }> }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
          isActive
            ? "text-teal-300 font-semibold"
            : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
        )
      }
      style={({ isActive }) => isActive ? { background: "var(--sidebar-active-bg)" } : {}}
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className={isActive ? "text-teal-400" : "text-stone-500"} />
          <span>{label}</span>
          {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" />}
        </>
      )}
    </NavLink>
  );
}

function PageTitle() {
  const { pathname } = useLocation();
  const { title } = useMemo(() => {
    if (pathname.startsWith("/budget"))   return { title: "Budget" };
    if (pathname.startsWith("/bills"))    return { title: "Bills" };
    if (pathname.startsWith("/calendar")) return { title: "Calendar" };
    if (pathname.startsWith("/goals"))    return { title: "Goals" };
    if (pathname.startsWith("/debts"))    return { title: "Debts" };
    if (pathname.startsWith("/settings")) return { title: "Settings" };
    return { title: "Overview" };
  }, [pathname]);

  return (
    <h1 className="font-display text-lg font-semibold text-stone-900">{title}</h1>
  );
}

function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sz = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", sz)}
      style={{ background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)", color: "#fff" }}>
      {initials}
    </div>
  );
}

function TbbPill({ tbb, loading }: { tbb: number; loading: boolean }) {
  const positive = tbb >= 0;
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums",
      positive ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"
    )}>
      <span className="text-[10px] uppercase tracking-wider opacity-60">TBB</span>
      <span>{loading ? "—" : money(tbb)}</span>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [totals, setTotals]           = useState<Totals | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [userName, setUserName]       = useState("");
  const [userEmail, setUserEmail]     = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function refreshTotals() {
    setLoadingTotals(true);
    try { const t = await api<Totals>("/api/totals"); setTotals(t); }
    catch { setTotals(null); }
    finally { setLoadingTotals(false); }
  }

  useEffect(() => {
    refreshTotals();
    api<{ name: string; email: string }>("/api/auth/me")
      .then((r) => { setUserName(r.name || ""); setUserEmail(r.email || ""); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); }
    finally { nav("/login", { replace: true }); }
  }

  const tbb = Number(totals?.toBeBudgeted ?? 0);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-bg)" }}>

      {/* ── Desktop Sidebar ───────────────────────────── */}
      <aside
        className="hidden md:flex md:w-60 md:flex-col md:shrink-0 fixed left-0 top-0 bottom-0 z-30 overflow-y-auto"
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" }}>
              DB
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">Ducharme</div>
              <div className="text-xs leading-tight" style={{ color: "var(--sidebar-text-muted)" }}>Family Budget</div>
            </div>
          </div>
        </div>

        {/* TBB card */}
        <div className="px-3 pb-4">
          <div className={cn(
            "rounded-xl px-4 py-3 border",
            tbb < 0
              ? "border-red-900/40 bg-red-950/40"
              : "border-teal-900/40 bg-teal-950/30"
          )}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--sidebar-text-muted)" }}>
              To Be Budgeted
            </div>
            <div className={cn("text-2xl font-display font-semibold tabular-nums", tbb < 0 ? "text-red-400" : "text-teal-300")}>
              {loadingTotals ? "—" : money(tbb)}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--sidebar-text-muted)" }}>Available to assign</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 space-y-1" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          {userName && (
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              <UserAvatar name={userName} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-stone-200">{userName}</div>
                {userEmail && <div className="truncate text-[10px]" style={{ color: "var(--sidebar-text-muted)" }}>{userEmail}</div>}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={refreshTotals}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all hover:bg-white/5"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            <RefreshCw size={14} />
            <span>Refresh totals</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all hover:bg-red-950/40 hover:text-red-400"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col md:ml-60 min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white/90 backdrop-blur px-4 md:px-6"
          style={{ borderColor: "var(--color-border)" }}>
          <PageTitle />

          <div className="flex items-center gap-2.5">
            {/* TBB pill — desktop only */}
            <div className="hidden sm:block">
              <TbbPill tbb={tbb} loading={loadingTotals} />
            </div>

            {/* User dropdown */}
            {userName && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-xl px-2 py-1 transition-colors hover:bg-stone-100"
                >
                  <UserAvatar name={userName} />
                  <span className="hidden sm:block max-w-[120px] truncate text-xs font-medium text-stone-600">{userName}</span>
                  <ChevronDown size={12} className={cn("text-stone-400 transition-transform", dropdownOpen && "rotate-180")} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border bg-white shadow-xl z-50 overflow-hidden"
                    style={{ borderColor: "var(--color-border)" }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={userName} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-stone-800 truncate">{userName}</div>
                          {userEmail && <div className="text-xs text-stone-400 truncate">{userEmail}</div>}
                        </div>
                      </div>
                    </div>
                    <div className="py-1.5">
                      <button type="button" onClick={() => { setDropdownOpen(false); nav("/settings"); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                        <Settings size={14} className="text-stone-400" />
                        Settings
                      </button>
                      <button type="button" onClick={() => { setDropdownOpen(false); nav("/settings#household"); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                        <HomeIcon size={14} className="text-stone-400" />
                        Household
                      </button>
                    </div>
                    <div className="py-1.5" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                      <button type="button" onClick={() => { setDropdownOpen(false); logout(); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
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

        {/* Page content */}
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6 max-w-[1200px] w-full mx-auto">
          {children}
        </main>

        {/* ── Mobile bottom tab bar ──────────────────── */}
        <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t bg-white/95 backdrop-blur-sm"
          style={{ borderColor: "var(--color-border)" }}>
          {MOBILE_NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-teal-600" : "text-stone-400"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                  <span className={isActive ? "font-semibold" : ""}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mobile-tab-spacer h-16 md:hidden" />
      </div>
    </div>
  );
}

function ProtectedLayout({ children }: { children: ReactElement }) {
  return (
    <Protected>
      <AppShell>{children}</AppShell>
    </Protected>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"           element={<Login />} />
      <Route path="/signup"          element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/"                element={<Navigate to="/home" replace />} />
      <Route path="/onboarding"      element={<ProtectedOnboarding><Onboarding /></ProtectedOnboarding>} />
      <Route path="/home"     element={<ProtectedLayout><Home /></ProtectedLayout>} />
      <Route path="/budget"   element={<ProtectedLayout><Budget /></ProtectedLayout>} />
      <Route path="/bills"    element={<ProtectedLayout><Bills /></ProtectedLayout>} />
      <Route path="/goals"    element={<ProtectedLayout><Goals /></ProtectedLayout>} />
      <Route path="/calendar" element={<ProtectedLayout><Calendar /></ProtectedLayout>} />
      <Route path="/debts"    element={<ProtectedLayout><Debts /></ProtectedLayout>} />
      <Route path="/settings" element={<ProtectedLayout><SettingsPage /></ProtectedLayout>} />
      <Route path="/join/:code" element={<JoinHousehold />} />
      <Route path="*"         element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
