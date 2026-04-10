import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { inputCls, labelCls, AuthError, PrimaryBtn } from "./Login";

export default function ForgotPassword() {
  const [email, setEmail]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [err, setErr]           = useState<string | null>(null);

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
      setErr(e?.message || "Something went wrong — please try again.");
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
          <div className="font-display text-xl font-semibold text-stone-900">Reset your password</div>
          <div className="text-sm text-stone-400 mt-0.5">We'll send you a link to get back in</div>
        </div>

        <div className="rounded-2xl bg-white border p-8 shadow-sm" style={{ borderColor: "var(--color-border)" }}>
          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800">
                If an account with that email exists, you'll receive reset instructions shortly.
              </div>
              {devToken && (
                <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 text-xs text-stone-600 space-y-2">
                  <div className="font-semibold text-amber-600">Dev mode — reset link:</div>
                  <Link to={`/reset-password?token=${devToken}`}
                    className="text-teal-600 hover:text-teal-700 break-all block transition-colors">
                    /reset-password?token={devToken.slice(0, 16)}…
                  </Link>
                </div>
              )}
              <Link to="/login"
                className="block text-center text-sm text-stone-500 hover:text-stone-700 transition-colors">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-stone-500 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className={labelCls}>Email address</span>
                  <input className={inputCls} type="email" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
                <AuthError msg={err} />
                <PrimaryBtn busy={busy} label="Send reset link" loadingLabel="Sending…" />
              </form>
              <p className="mt-5 text-center">
                <Link to="/login" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
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
