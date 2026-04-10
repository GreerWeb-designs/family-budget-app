import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-rose-500", width: "33%" };
  if (score <= 3) return { label: "Fair", color: "bg-amber-500", width: "66%" };
  return { label: "Strong", color: "bg-emerald-500", width: "100%" };
}

export default function Signup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = passwordStrength(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      nav("/home");
    } catch (e: any) {
      setErr(e?.message || "Signup failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";
  const labelCls = "text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold text-xl shadow-lg shadow-emerald-500/30 mb-4">
            DB
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ducharme Budget</h1>
          <p className="mt-1 text-sm text-slate-400">Family financial dashboard</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-semibold text-white mb-5">Create your account</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className={labelCls}>Full Name</span>
              <input
                className={inputCls}
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>

            <label className="block">
              <span className={labelCls}>Email</span>
              <input
                className={inputCls}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                type="email"
                required
              />
            </label>

            <label className="block">
              <span className={labelCls}>Password</span>
              <input
                className={inputCls}
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="h-1 w-full rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${strength.color}`}
                      style={{ width: strength.width }}
                    />
                  </div>
                  <div className={`mt-1 text-xs font-medium ${
                    strength.label === "Weak" ? "text-rose-400"
                    : strength.label === "Fair" ? "text-amber-400"
                    : "text-emerald-400"
                  }`}>{strength.label}</div>
                </div>
              )}
            </label>

            <label className="block">
              <span className={labelCls}>Confirm Password</span>
              <input
                className={`${inputCls} ${confirm && confirm !== password ? "border-rose-500/50" : ""}`}
                placeholder="••••••••"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {err && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-400">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/20 mt-2"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
