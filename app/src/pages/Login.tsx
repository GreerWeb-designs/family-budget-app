import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      nav("/home");
    } catch (e: any) {
      setErr(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold text-xl shadow-lg shadow-emerald-500/30 mb-4">
            DB
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ducharme Budget</h1>
          <p className="mt-1 text-sm text-slate-400">Family financial dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-semibold text-white mb-5">Sign in to your account</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">Email</span>
              <input
                className="w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                type="email"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">Password</span>
              <input
                className="w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            {err && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-400">
                {err}
              </div>
            )}

            <button
              disabled={busy}
              className="w-full h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/20 mt-2"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Ducharme Family Budget • Private household
        </p>
      </div>
    </div>
  );
}