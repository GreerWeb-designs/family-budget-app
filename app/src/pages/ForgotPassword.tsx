import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; devToken?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDevToken(res.devToken ?? null);
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold text-xl shadow-lg shadow-emerald-500/30 mb-4">
            DB
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ducharme Budget</h1>
          <p className="mt-1 text-sm text-slate-400">Password reset</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-3 text-sm text-emerald-400">
                If an account with that email exists, you'll receive reset instructions.
              </div>
              {devToken && (
                <div className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-xs text-slate-400 space-y-2">
                  <div className="font-semibold text-amber-400">Dev mode — reset link:</div>
                  <Link
                    to={`/reset-password?token=${devToken}`}
                    className="text-emerald-400 hover:text-emerald-300 break-all block"
                  >
                    /reset-password?token={devToken.slice(0, 16)}…
                  </Link>
                </div>
              )}
              <Link
                to="/login"
                className="block text-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-white mb-2">Forgot your password?</h2>
              <p className="text-xs text-slate-400 mb-5">Enter your email and we'll send reset instructions.</p>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">Email</span>
                  <input
                    className="w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
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
                  className="w-full h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/20"
                >
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="mt-4 text-center">
                <Link to="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
