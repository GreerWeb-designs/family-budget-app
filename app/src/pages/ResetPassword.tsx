import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { inputCls, labelCls, AuthError, PrimaryBtn } from "./Login";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm)  { setErr("Passwords don't match."); return; }
    if (password.length < 8)   { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Reset failed — the link may have expired.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-100">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-white mb-3"
            style={{ background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" }}>
            DB
          </div>
          <div className="font-display text-xl font-semibold text-stone-900">Choose a new password</div>
        </div>

        <div className="rounded-2xl bg-white border p-8 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
          {!token ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                This reset link isn't valid. Please request a new one.
              </div>
              <Link to="/forgot-password"
                className="block text-center text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                Request a new link
              </Link>
            </div>
          ) : done ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800">
                Password updated successfully! You can now sign in with your new password.
              </div>
              <Link to="/login"
                className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "var(--color-primary)" }}>
                Sign in now
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className={labelCls}>New password</span>
                <input className={inputCls} type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              </label>
              <label className="block">
                <span className={labelCls}>Confirm password</span>
                <input
                  className={inputCls + (confirm && confirm !== password ? " border-red-300 focus:border-red-400 focus:ring-red-100" : "")}
                  type="password" placeholder="••••••••"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
              </label>
              <AuthError msg={err} />
              <PrimaryBtn busy={busy} label="Update password" loadingLabel="Updating…" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
