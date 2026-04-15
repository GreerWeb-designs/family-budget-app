import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { BrandMark, Wordmark } from "../components/ui";

export default function JoinHousehold() {
  const { code } = useParams<{ code: string }>();
  const nav = useNavigate();

  const [status, setStatus] = useState<"checking" | "joining" | "success" | "error" | "unauthenticated">("checking");
  const [householdName, setHouseholdName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    api<{ userId: string }>("/api/auth/me")
      .then(() => {
        setStatus("joining");
        return api<{ ok: boolean; householdName: string }>("/api/household/join", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
      })
      .then((res) => {
        setHouseholdName(res.householdName);
        setStatus("success");
        setTimeout(() => nav("/home", { replace: true }), 2500);
      })
      .catch((err) => {
        const msg = String(err?.message || "");
        if (msg.includes("HTTP 401") || msg.toLowerCase().includes("unauthorized")) {
          setStatus("unauthenticated");
        } else {
          const isExpired = msg.toLowerCase().includes("invalid or expired") || msg.toLowerCase().includes("expired invite");
          setErrorMsg(
            isExpired
              ? "This invite code has already been used or has expired. Ask your household admin to generate a new one."
              : msg || "Something went wrong. Please try again."
          );
          setStatus("error");
        }
      });
  }, [code, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#1B4243" }}>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <BrandMark size={48} className="mx-auto mb-3" />
          <Wordmark size="md" variant="plain" className="text-white" />
          <div className="text-sm text-teal-300 mt-1">Household invite</div>
        </div>

        <div className="rounded-2xl bg-white p-6" style={{ border: "1px solid #C9DEDF", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>

          {(status === "checking" || status === "joining") && (
            <div className="text-center py-6 space-y-4">
              <Loader2 size={32} className="mx-auto text-teal-500 animate-spin" />
              <p className="text-sm text-ink-500">
                {status === "checking" ? "Checking your account…" : "Joining household…"}
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 size={40} className="mx-auto text-teal-600" />
              <div>
                <p className="text-base font-semibold text-ink-900">You've joined "{householdName}"!</p>
                <p className="text-sm text-ink-400 mt-1">Redirecting to your dashboard…</p>
              </div>
            </div>
          )}

          {status === "unauthenticated" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                You need an account to join this household.
              </div>
              <p className="text-xs text-ink-500 text-center">
                Invite code: <span className="font-semibold text-ink-900 tracking-wider"
                  style={{ fontFamily: "'Fraunces', Georgia, serif" }}>{code}</span>
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/signup"
                  className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-all bg-teal-500 hover:bg-teal-600">
                  Create an account
                </Link>
                <Link to="/login"
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-cream-200 text-sm font-medium text-ink-700 hover:bg-cream-50 transition-all">
                  Sign in
                </Link>
              </div>
              <p className="text-xs text-ink-400 text-center">
                After signing in, go to{" "}
                <Link to="/settings" className="font-semibold text-teal-500 hover:text-teal-600">
                  Settings → Household
                </Link>{" "}
                and enter the code.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-xl bg-rust-50 border border-rust-600/30 px-4 py-3">
                <AlertCircle size={16} className="text-rust-600 shrink-0 mt-0.5" />
                <p className="text-sm text-rust-600">{errorMsg}</p>
              </div>
              <Link to="/settings"
                className="block text-center text-sm text-ink-500 hover:text-ink-700 transition-colors">
                ← Back to Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
