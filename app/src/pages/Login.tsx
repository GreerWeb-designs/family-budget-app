import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      {/* Left panel — desktop only */}
      <div className="hidden lg:flex lg:w-105 lg:flex-col lg:justify-between lg:p-10 lg:shrink-0"
        style={{ background: "var(--sidebar-bg)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-sm text-white"
            style={{ background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" }}>
            DB
          </div>
          <div>
            <div className="text-sm font-bold text-white">Ducharme</div>
            <div className="text-xs text-stone-500">Family Budget</div>
          </div>
        </div>
        <div>
          <p className="font-display text-4xl font-semibold text-white leading-tight mb-4">
            Your family's financial story, beautifully organized.
          </p>
          <p className="text-sm text-stone-500 leading-relaxed">
            Budget together, save together, grow together.
          </p>
        </div>
        <p className="text-xs text-stone-600">Private household dashboard</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-white mb-3"
            style={{ background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" }}>
            DB
          </div>
          <div className="font-display text-xl font-semibold text-stone-900">Ducharme Budget</div>
          <div className="text-sm text-stone-400 mt-0.5">{subtitle}</div>
        </div>

        <div className="w-full max-w-100">
          {children}
        </div>
      </div>
    </div>
  );
}

export const inputCls = cn(
  "w-full h-11 rounded-xl border px-3 text-sm outline-none transition-all",
  "border-stone-200 bg-white text-stone-900 placeholder-stone-400",
  "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
);

export const labelCls = "text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5 block";

export function AuthError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
      {msg}
    </div>
  );
}

export function PrimaryBtn({ busy, label, loadingLabel }: { busy: boolean; label: string; loadingLabel: string }) {
  return (
    <button type="submit" disabled={busy}
      className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 mt-1"
      style={{ background: busy ? "#0D5C57" : "var(--color-primary)" }}>
      {busy ? loadingLabel : label}
    </button>
  );
}

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      nav("/home");
    } catch (e: any) {
      setErr(e?.message || "Couldn't sign in — please check your credentials.");
    } finally { setBusy(false); }
  }

  return (
    <AuthShell subtitle="Sign in to your account">
      <div className="rounded-2xl bg-white border p-8 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="font-display text-2xl font-semibold text-stone-900 mb-1">Welcome back</h2>
        <p className="text-sm text-stone-400 mb-6">Sign in to your family budget</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className={labelCls}>Email</span>
            <input className={inputCls} type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>

          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className={labelCls} style={{ marginBottom: 0 }}>Password</span>
              <Link to="/forgot-password" className="text-xs text-teal-600 hover:text-teal-700 transition-colors">
                Forgot?
              </Link>
            </div>
            <input className={inputCls} type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>

          <AuthError msg={err} />
          <PrimaryBtn busy={busy} label="Sign in" loadingLabel="Signing in…" />
        </form>

        <p className="mt-5 text-center text-xs text-stone-500">
          No account yet?{" "}
          <Link to="/signup" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
