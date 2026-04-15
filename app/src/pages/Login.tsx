import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { Wordmark } from "../components/ui";

function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-cream-50">
      {/* Left panel — desktop only, light cream */}
      <div
        className="hidden lg:flex lg:w-104 lg:flex-col lg:justify-between lg:p-10 lg:shrink-0 bg-cream-50"
        style={{ borderRight: "1px solid var(--color-cream-200)" }}
      >
        {/* inline variant: embedded logo fine on cream bg */}
        <Wordmark size="md" variant="inline" />
        <div>
          <p
            className="text-4xl font-medium text-ink-900 leading-tight mb-4"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Your Home,<br />Organized.
          </p>
          <p className="text-sm text-ink-500 leading-relaxed">
            A warm, clear home for your household budget.
          </p>
        </div>
        <p className="text-xs text-ink-500">Private household dashboard</p>
      </div>

      {/* Right panel — dark teal on desktop, cream on mobile */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 lg:bg-teal-700">

        {/* Mobile header — logo + plain text + subtitle, cream bg */}
        <div className="lg:hidden mb-8 text-center">
          <img
            src="/nestotter-logo.svg"
            alt="NestOtter"
            draggable={false}
            className="mx-auto select-none"
            style={{ width: 120, height: "auto" }}
          />
          <div style={{ height: 16 }} />
          <p
            className="text-ink-900"
            style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 32, lineHeight: 1 }}
          >
            NestOtter
          </p>
          <p className="text-ink-500 mt-2" style={{ fontSize: 15 }}>{subtitle}</p>
        </div>

        <div className="w-full max-w-100">
          {children}
        </div>
      </div>
    </div>
  );
}

export const inputCls = cn(
  "w-full rounded-lg border px-[14px] py-3 text-sm outline-none transition-all",
  "border-cream-200 bg-[#FFFDF8] text-ink-900 placeholder-ink-300",
  "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
);

export const labelCls = "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 mb-1.5 block";

export function AuthError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-lg border border-rust-500/30 bg-rust-50 px-3 py-2.5 text-sm text-rust-600">
      {msg}
    </div>
  );
}

export function PrimaryBtn({ busy, label, loadingLabel }: { busy: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-lg text-sm font-medium transition-all disabled:opacity-60 mt-1 hover:opacity-90 text-white bg-teal-500 disabled:bg-teal-600"
      style={{ padding: "14px" }}
    >
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
      <div
        className="rounded-xl p-6"
        style={{ background: "#FFFDF8", border: "1px solid var(--color-cream-200)", boxShadow: "var(--shadow-card)" }}
      >
        <h2
          className="font-medium text-ink-900 mb-1"
          style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22 }}
        >
          Welcome back
        </h2>
        <p className="text-ink-500 mb-6" style={{ fontSize: 14 }}>Sign in to your household</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className={labelCls}>Email</span>
            <input
              className={inputCls}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className={labelCls} style={{ marginBottom: 0 }}>Password</span>
              <Link
                to="/forgot-password"
                className="font-medium text-teal-500 hover:opacity-80 transition-opacity"
                style={{ fontSize: 13 }}
              >
                Forgot?
              </Link>
            </div>
            <input
              className={inputCls}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <AuthError msg={err} />
          <PrimaryBtn busy={busy} label="Sign in" loadingLabel="Signing in…" />
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          No account yet?{" "}
          <Link to="/signup" className="font-medium text-teal-500 hover:opacity-80 transition-opacity">
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
