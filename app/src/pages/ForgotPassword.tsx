import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { inputCls, labelCls, AuthError, PrimaryBtn } from "./Login";
import { BrandMark, Wordmark } from "../components/ui";

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
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#1B4243" }}>
      <div className="w-full max-w-100">
        <div className="text-center mb-8">
          <BrandMark size={48} className="mx-auto mb-3" />
          <Wordmark size="md" className="text-white" />
          <div className="text-sm mt-1" style={{ color: "#6FA3A5" }}>Reset your password</div>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: "#FFFDF8", borderColor: "#C9DEDF" }}>
          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-teal-50 border border-teal-500/30 px-4 py-3 text-sm text-teal-600">
                If an account with that email exists, you'll receive reset instructions shortly.
              </div>
              {devToken && (
                <div className="rounded-xl bg-cream-100 border border-cream-200 px-4 py-3 text-xs text-ink-700 space-y-2">
                  <div className="font-semibold text-amber-600">Dev mode — reset link:</div>
                  <Link to={`/reset-password?token=${devToken}`}
                    className="text-teal-500 hover:text-teal-600 break-all block transition-colors">
                    /reset-password?token={devToken.slice(0, 16)}…
                  </Link>
                </div>
              )}
              <Link to="/login"
                className="block text-center text-sm text-ink-500 hover:text-ink-700 transition-colors">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-medium text-ink-900 mb-1"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                Forgot your password?
              </h2>
              <p className="text-sm text-ink-500 mb-6">
                Enter your email and we'll send you a reset link.
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
                <Link to="/login" className="text-xs text-ink-400 hover:text-ink-600 transition-colors">
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
