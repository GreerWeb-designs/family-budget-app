import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { BrandMark, Wordmark } from "../components/ui";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setErrMsg("No verification token found."); return; }
    api(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("success"))
      .catch((e: any) => {
        setStatus("error");
        setErrMsg(e?.message || "This link is invalid or has expired.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#1B4243" }}>
      <div className="w-full max-w-100">
        <div className="text-center mb-8">
          <BrandMark size={48} className="mx-auto mb-3" />
          <Wordmark size="md" variant="plain" className="text-white" />
        </div>

        <div className="rounded-2xl border p-8 text-center" style={{ background: "#FFFDF8", borderColor: "#C9DEDF" }}>
          {status === "loading" && (
            <>
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <h2 className="text-xl font-medium text-ink-900"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                Verifying your email…
              </h2>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-2xl font-medium text-ink-900 mb-3"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                Email verified!
              </h2>
              <p className="text-sm text-ink-500 mb-6">
                Your account is active. Sign in to get started.
              </p>
              <button
                type="button"
                onClick={() => nav("/login")}
                className="h-11 w-full rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "#1B4243" }}
              >
                Sign in →
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h2 className="text-2xl font-medium text-ink-900 mb-3"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                Link not valid
              </h2>
              <p className="text-sm text-ink-500 mb-6">{errMsg}</p>
              <button
                type="button"
                onClick={() => nav("/login")}
                className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
