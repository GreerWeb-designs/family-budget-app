import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold text-xl shadow-lg shadow-emerald-500/30 mb-4">
            DB
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ducharme Budget</h1>
          <p className="mt-1 text-sm text-slate-400">Set a new password</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {!token ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-400">
                Invalid reset link. Please request a new one.
              </div>
              <Link to="/forgot-password" className="block text-center text-sm text-emerald-400 hover:text-emerald-300">
                Request new link
              </Link>
            </div>
          ) : done ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-3 text-sm text-emerald-400">
                Password updated successfully!
              </div>
              <Link
                to="/login"
                className="block w-full h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 transition-all text-center leading-[2.75rem]"
              >
                Sign in now
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-white mb-5">Choose a new password</h2>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">New Password</span>
                  <input
                    className={inputCls}
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 block">Confirm Password</span>
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
                  className="w-full h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/20"
                >
                  {busy ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
