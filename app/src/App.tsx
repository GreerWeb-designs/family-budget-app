import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { api } from "./lib/api";

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

type Totals = {
  bankBalance: number;
  totalIncome: number;
  totalBudgeted: number;
  toBeBudgeted: number;
};

function money(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function Protected({ children }: { children: ReactElement }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    api<{ ok: boolean }>("/api/auth/me")
      .then(() => { if (alive) setOk(true); })
      .catch(() => { if (!alive) return; setOk(false); nav("/login", { replace: true }); });
    return () => { alive = false; };
  }, [nav]);

  if (ok === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  return children;
}

const NAV_ITEMS = [
  { to: "/home",     label: "Home",     icon: "🏠" },
  { to: "/budget",   label: "Budget",   icon: "📊" },
  { to: "/bills",    label: "Bills",    icon: "📄" },
  { to: "/goals",    label: "Goals",    icon: "🎯" },
  { to: "/calendar", label: "Calendar", icon: "📅" },
  { to: "/debts",    label: "Debts",    icon: "💳" },
];

function SideLink({ to, label, icon, onClick }: { to: string; label: string; icon: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
          isActive
            ? "bg-white/10 text-white"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
        }`
      }
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function PageTitle() {
  const { pathname } = useLocation();

  const { title, icon } = useMemo(() => {
    if (pathname.startsWith("/budget"))   return { title: "Budget",   icon: "📊" };
    if (pathname.startsWith("/bills"))    return { title: "Bills",    icon: "📄" };
    if (pathname.startsWith("/calendar")) return { title: "Calendar", icon: "📅" };
    if (pathname.startsWith("/goals"))    return { title: "Goals",    icon: "🎯" };
    if (pathname.startsWith("/debts"))    return { title: "Debts",    icon: "💳" };
    return { title: "Home", icon: "🏠" };
  }, [pathname]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function refreshTotals() {
    setLoadingTotals(true);
    try {
      const t = await api<Totals>("/api/totals");
      setTotals(t);
    } catch {
      setTotals(null);
    } finally {
      setLoadingTotals(false);
    }
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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); }
    finally { nav("/login", { replace: true }); }
  }

  const tbb = Number(totals?.toBeBudgeted ?? 0);
  const tbbColor = tbb < 0 ? "text-red-400" : tbb === 0 ? "text-emerald-400" : "text-emerald-300";
  const tbbBg   = tbb < 0 ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20";

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 bg-slate-950 min-h-screen fixed left-0 top-0 z-30">

        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg">
              DB
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">Ducharme</div>
              <div className="text-xs text-slate-400 leading-tight">Family Budget</div>
            </div>
          </div>
        </div>

        {/* TBB Widget */}
        <div className="px-3 pb-4">
          <div className={`rounded-xl border px-4 py-3 ${tbbBg}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              To Be Budgeted
            </div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${tbbColor}`}>
              {loadingTotals ? "—" : money(tbb)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Available to assign</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 px-3 py-4 space-y-1">
          {userName && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-200">{userName}</div>
                {userEmail && <div className="truncate text-[10px] text-slate-500">{userEmail}</div>}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={refreshTotals}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
          >
            <span>↻</span>
            <span>Refresh totals</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-rose-400 transition-all"
          >
            <span>→</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col md:ml-60">

        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur md:px-6">
          <PageTitle />
          <div className="flex items-center gap-3">
            <div className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tbbBg} ${tbbColor}`}>
              <span>TBB</span>
              <span>{loadingTotals ? "—" : money(tbb)}</span>
            </div>

            {/* User dropdown */}
            {userName && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block max-w-25 truncate text-xs font-medium text-slate-600">{userName}</span>
                  <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 py-2">
                    {/* User info */}
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <div className="text-sm font-semibold text-slate-800 truncate">{userName}</div>
                      {userEmail && <div className="text-xs text-slate-400 truncate mt-0.5">{userEmail}</div>}
                    </div>

                    {/* Actions */}
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => { setDropdownOpen(false); alert("Settings coming soon"); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span>⚙️</span>
                        <span>Settings</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDropdownOpen(false); alert("Household management coming soon"); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span>🏠</span>
                        <span>Household</span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 py-1">
                      <button
                        type="button"
                        onClick={() => { setDropdownOpen(false); logout(); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <span>→</span>
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>

        {/* ── Mobile bottom tab bar ── */}
       <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  isActive ? "text-emerald-600" : "text-slate-400"
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom padding for mobile tab bar */}
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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home"     element={<ProtectedLayout><Home /></ProtectedLayout>} />
      <Route path="/budget"   element={<ProtectedLayout><Budget /></ProtectedLayout>} />
      <Route path="/bills"    element={<ProtectedLayout><Bills /></ProtectedLayout>} />
      <Route path="/goals"    element={<ProtectedLayout><Goals /></ProtectedLayout>} />
      <Route path="/calendar" element={<ProtectedLayout><Calendar /></ProtectedLayout>} />
      <Route path="/debts"    element={<ProtectedLayout><Debts /></ProtectedLayout>} />
      <Route path="*"         element={<Navigate to="/home" replace />} />
    </Routes>
  );
}