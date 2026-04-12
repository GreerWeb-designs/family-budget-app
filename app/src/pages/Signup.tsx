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
  if (score <= 1) return { label: "Weak",   color: "#B8791F", pct: 33 };
  if (score <= 3) return { label: "Fair",   color: "#C8A464", pct: 66 };
  return              { label: "Strong", color: "#2F6B52", pct: 100 };
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
      nav("/onboarding");
    } catch (e: any) {
      setErr(e?.message || "Couldn't create account — please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#0B2A4A" }}>
      <div className="w-full max-w-100">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl font-bold mb-3"
            style={{ background: "#C8A464", color: "#0B2A4A" }}>
            KW
          </div>
          <div className="text-xl font-medium text-white">Take the helm.</div>
          <div className="text-sm text-[#5C6B7A] mt-0.5">Built for people who are tired of drifting.</div>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: "#0F3360", borderColor: "rgba(200,164,100,0.2)" }}>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className={labelCls}>Full name</span>
              <input className={inputCls} placeholder="Your name"
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
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "#143860" }}>
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
                className={inputCls + (confirm && confirm !== password ? " border-[#B8791F]/60" : "")}
                type="password" placeholder="••••••••"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>

            <AuthError msg={err} />
            <PrimaryBtn busy={busy} label="Create account" loadingLabel="Creating account…" />
          </form>

          <p className="mt-5 text-center text-xs text-[#5C6B7A]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#C8A464] hover:opacity-80 transition-opacity">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
