import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: "#0B2A4A" }}>
      {/* Left panel — desktop only */}
      <div className="hidden lg:flex lg:w-105 lg:flex-col lg:justify-between lg:p-10 lg:shrink-0"
        style={{ background: "#071E33", borderRight: "1px solid #143860" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-sm"
            style={{ background: "#C8A464", color: "#0B2A4A" }}>
            KW
          </div>
          <div>
            <div className="text-sm font-semibold text-white">KeelWise</div>
            <div className="text-xs text-[#5C6B7A]">Steady money. Straight course.</div>
          </div>
        </div>
        <div>
          <p className="text-4xl font-medium text-white leading-tight mb-4">
            Steady money.<br />Straight course.
          </p>
          <p className="text-sm text-[#5C6B7A] leading-relaxed">
            Built for households who want clarity, not complexity.
          </p>
        </div>
        <p className="text-xs text-[#5C6B7A]">Private household dashboard</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl font-bold mb-3"
            style={{ background: "#C8A464", color: "#0B2A4A" }}>
            KW
          </div>
          <div className="text-xl font-medium text-white">KeelWise</div>
          <div className="text-sm text-[#5C6B7A] mt-0.5">{subtitle}</div>
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
  "border-[#5C6B7A]/40 bg-[#0B2A4A] text-white placeholder-[#5C6B7A]",
  "focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/20"
);

export const labelCls = "text-xs font-semibold uppercase tracking-wider text-[#5C6B7A] mb-1.5 block";

export function AuthError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl border border-[#B8791F]/30 bg-[#FDF3E3]/10 px-3 py-2.5 text-sm text-[#B8791F]">
      {msg}
    </div>
  );
}

export function PrimaryBtn({ busy, label, loadingLabel }: { busy: boolean; label: string; loadingLabel: string }) {
  return (
    <button type="submit" disabled={busy}
      className="w-full h-11 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 mt-1 hover:opacity-90"
      style={{ background: busy ? "#B8974A" : "#C8A464", color: "#0B2A4A" }}>
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
      <div className="rounded-2xl border p-8" style={{ background: "#0F3360", borderColor: "rgba(200,164,100,0.2)" }}>
        <h2 className="text-2xl font-medium text-white mb-1">Welcome back</h2>
        <p className="text-sm text-[#5C6B7A] mb-6">Sign in to your household</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className={labelCls}>Email</span>
            <input className={inputCls} type="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>

          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className={labelCls} style={{ marginBottom: 0 }}>Password</span>
              <Link to="/forgot-password" className="text-xs text-[#C8A464] hover:opacity-80 transition-opacity">
                Forgot?
              </Link>
            </div>
            <input className={inputCls} type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>

          <AuthError msg={err} />
          <PrimaryBtn busy={busy} label="Sign in" loadingLabel="Signing in…" />
        </form>

        <p className="mt-5 text-center text-xs text-[#5C6B7A]">
          No account yet?{" "}
          <Link to="/signup" className="font-semibold text-[#C8A464] hover:opacity-80 transition-opacity">
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
