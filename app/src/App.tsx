import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { api } from "./lib/api";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Budget from "./pages/Budget";
import Bills from "./pages/Bills";
import Calendar from "./pages/Calendar";
import Goals from "./pages/Goals";
import Debts from "./pages/Debts";

type Totals = {
  bankBalance: number;
  expectedBalance: number;
  toBeBudgeted: number;
  totalBudgeted: number;
  totalLoggedSpentOut: number;
  totalLoggedIncomeIn: number;
  unloggedDifference: number;
};

function Protected({ children }: { children: ReactElement }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;

    api<{ ok: boolean }>("/api/auth/me")
      .then(() => {
        if (alive) setOk(true);
      })
      .catch(() => {
        if (!alive) return;
        setOk(false);
        nav("/login", { replace: true });
      });

    return () => {
      alive = false;
    };
  }, [nav]);

  if (ok === null) return <div className="p-6 text-sm text-zinc-600">Loading…</div>;
  return children;
}

function SideLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
          isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
        }`
      }
    >
      <span>{label}</span>
    </NavLink>
  );
}

function TopTitle() {
  const { pathname } = useLocation();

  const title = useMemo(() => {
    if (pathname.startsWith("/budget")) return "Budget";
    if (pathname.startsWith("/bills")) return "Bills";
    if (pathname.startsWith("/calendar")) return "Calendar";
    if (pathname.startsWith("/goals")) return "Goals";
    if (pathname.startsWith("/debts")) return "Debts";
    if (pathname.startsWith("/home")) return "Dashboard";
    return "Dashboard";
  }, [pathname]);

  return (
    <div>
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="text-xs text-zinc-500">Ducharme Family Budget</div>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);

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
  }, []);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      nav("/login", { replace: true });
    }
  }

  const toBeBudgeted = totals?.toBeBudgeted ?? 0;
  const toBeBudgetedStyle =
    toBeBudgeted < 0
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto flex max-w-[1400px] gap-4 p-4">
        <aside className="w-64 shrink-0 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-zinc-900" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-zinc-900">Ducharme</div>
                <div className="text-xs text-zinc-500">Family Budget</div>
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border px-3 py-2 ${toBeBudgetedStyle}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">To Be Budgeted</div>
              <div className="mt-1 text-lg font-semibold">
                {loadingTotals ? "—" : `$${toBeBudgeted.toFixed(2)}`}
              </div>
              <div className="mt-1 text-xs opacity-80">Placeholder until Plaid cash is wired</div>
            </div>
          </div>

          <div className="space-y-1 p-3">
            <SideLink to="/home" label="Home" />
            <SideLink to="/budget" label="Budget" />
            <SideLink to="/bills" label="Bills" />
            <SideLink to="/goals" label="Goals" />
            <SideLink to="/calendar" label="Calendar" />
            <SideLink to="/debts" label="Debts" />
          </div>

          <div className="border-t border-zinc-200 p-3">
            <button
              type="button"
              onClick={refreshTotals}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Refresh totals
            </button>

            <button
              type="button"
              onClick={logout}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <TopTitle />
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                Single account
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">{children}</div>
        </main>
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
    <div className="min-h-screen bg-[#FBF5E6] text-zinc-900">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<ProtectedLayout><Home /></ProtectedLayout>} />
        <Route path="/budget" element={<ProtectedLayout><Budget /></ProtectedLayout>} />
        <Route path="/bills" element={<ProtectedLayout><Bills /></ProtectedLayout>} />
        <Route path="/goals" element={<ProtectedLayout><Goals /></ProtectedLayout>} />
        <Route path="/calendar" element={<ProtectedLayout><Calendar /></ProtectedLayout>} />
        <Route path="/debts" element={<ProtectedLayout><Debts /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}
