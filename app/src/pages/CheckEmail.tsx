import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { BrandMark, Wordmark } from "../components/ui";

export default function CheckEmail() {
  const { state } = useLocation() as { state: { email?: string } | null };
  const nav = useNavigate();
  const email = state?.email ?? "";
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resend() {
    if (!email) return;
    setBusy(true); setErr(null);
    try {
      await api("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch {
      setErr("Couldn't resend — please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#1B4243" }}>
      <div className="w-full max-w-100">
        <div className="text-center mb-8">
          <BrandMark size={48} className="mx-auto mb-3" />
          <Wordmark size="md" variant="plain" className="text-white" />
        </div>

        <div className="rounded-2xl border p-8 text-center" style={{ background: "#FFFDF8", borderColor: "#C9DEDF" }}>
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-2xl font-medium text-ink-900 mb-3"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Check your inbox
          </h2>
          <p className="text-sm text-ink-500 leading-relaxed mb-2">
            We sent a verification link to
          </p>
          {email && (
            <p className="text-sm font-semibold text-ink-900 mb-4">{email}</p>
          )}
          <p className="text-sm text-ink-500 leading-relaxed mb-6">
            Click the link in the email to activate your account. It expires in 24 hours.
          </p>

          {err && (
            <div className="rounded-xl border border-rust-600/30 bg-rust-50 px-4 py-2.5 text-sm text-rust-600 mb-4">
              {err}
            </div>
          )}

          {sent ? (
            <div className="rounded-xl border border-teal-500/30 bg-teal-50 px-4 py-2.5 text-sm text-teal-600 mb-4">
              Verification email resent — check your inbox.
            </div>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={busy || !email}
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
            >
              {busy ? "Sending…" : "Didn't get it? Resend"}
            </button>
          )}

          <div className="mt-6 pt-5 border-t border-cream-200">
            <button
              type="button"
              onClick={() => nav("/login")}
              className="text-xs text-ink-500 hover:text-ink-700 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
