import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { BrandMark, Wordmark } from "../components/ui";

function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: "#FAF6EE" }}>
      {/* Left panel — desktop only */}
      <div className="hidden lg:flex lg:w-104 lg:flex-col lg:justify-between lg:p-10 lg:shrink-0"
        style={{ background: "#1B4243", borderRight: "1px solid #245759" }}>
        <Wordmark size="md" className="text-white" />
        <div>
          <p className="text-4xl font-medium text-white leading-tight mb-4"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Where your<br />nest egg grows.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#6FA3A5" }}>
            A warm, clear home for your household budget.
          </p>
        </div>
        <p className="text-xs" style={{ color: "#6FA3A5" }}>Private household dashboard</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <BrandMark size={48} className="mx-auto mb-3" />
          <Wordmark size="md" />
          <div className="text-sm text-ink-500 mt-1">{subtitle}</div>
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
  "border-cream-200 bg-cream-50 text-ink-900 placeholder-ink-300",
  "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
);

export const labelCls = "text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5 block";

export function AuthError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl border border-rust-500/30 bg-rust-50 px-3 py-2.5 text-sm text-rust-600">
      {msg}
    </div>
  );
}

export function PrimaryBtn({ busy, label, loadingLabel }: { busy: boolean; label: string; loadingLabel: string }) {
  return (
    <button type="submit" disabled={busy}
      className="w-full h-11 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 mt-1 hover:opacity-90 text-white"
      style={{ background: busy ? "#245759" : "#2D6E70" }}>
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
      <div className="rounded-2xl border p-8"
        style={{ background: "#FFFDF8", borderColor: "#C9DEDF" }}>
        <h2 className="text-2xl font-medium text-ink-900 mb-1"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          Welcome back
        </h2>
        <p className="text-sm text-ink-500 mb-6">Sign in to your household</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className={labelCls}>Email</span>
            <input className={inputCls} type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>

          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className={labelCls} style={{ marginBottom: 0 }}>Password</span>
              <Link to="/forgot-password" className="text-xs text-teal-500 hover:opacity-80 transition-opacity">
                Forgot?
              </Link>
            </div>
            <input className={inputCls} type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>

          <AuthError msg={err} />
          <PrimaryBtn busy={busy} label="Sign in" loadingLabel="Signing in…" />
        </form>

        <p className="mt-5 text-center text-xs text-ink-500">
          No account yet?{" "}
          <Link to="/signup" className="font-semibold text-teal-500 hover:opacity-80 transition-opacity">
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
