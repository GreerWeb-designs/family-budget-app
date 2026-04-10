import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { inputCls, labelCls, AuthError, PrimaryBtn } from "./Login";

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length === 0) return { label: "", color: "", pct: 0 };
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (/[A-Z]/.test(pw))       score++;
  if (/[0-9]/.test(pw))       score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak",   color: "#EF4444", pct: 33 };
  if (score <= 3) return { label: "Fair",   color: "#F59E0B", pct: 66 };
  return              { label: "Strong", color: "#10B981", pct: 100 };
}

export default function Signup() {
  const nav = useNavigate();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [err, setErr]           = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  const strength = passwordStrength(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm)   { setErr("Passwords don't match."); return; }
    if (password.length < 8)    { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
      nav("/home");
    } catch (e: any) {
      setErr(e?.message || "Couldn't create account — please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-100">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-white mb-3"
            style={{ background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" }}>
            DB
          </div>
          <div className="font-display text-xl font-semibold text-stone-900">Create your account</div>
          <div className="text-sm text-stone-400 mt-0.5">Family budget · Private household</div>
        </div>

        <div className="rounded-2xl bg-white border p-8 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className={labelCls}>Full name</span>
              <input className={inputCls} placeholder="Jane Ducharme"
                value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>

            <label className="block">
              <span className={labelCls}>Email</span>
              <input className={inputCls} type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>

            <label className="block">
              <span className={labelCls}>Password</span>
              <input className={inputCls} type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${strength.pct}%`, background: strength.color }} />
                  </div>
                  <div className="mt-1 text-xs font-medium" style={{ color: strength.color }}>{strength.label}</div>
                </div>
              )}
            </label>

            <label className="block">
              <span className={labelCls}>Confirm password</span>
              <input
                className={inputCls + (confirm && confirm !== password ? " border-red-300 focus:border-red-400 focus:ring-red-100" : "")}
                type="password" placeholder="••••••••"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>

            <AuthError msg={err} />
            <PrimaryBtn busy={busy} label="Create account" loadingLabel="Creating account…" />
          </form>

          <p className="mt-5 text-center text-xs text-stone-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
