import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";

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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--sidebar-bg)" }}>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl font-bold mb-3"
            style={{ background: "#C8A464", color: "#0B2A4A" }}>
            KW
          </div>
          <div className="font-display text-xl font-semibold text-white">KeelWise</div>
          <div className="text-sm text-stone-500 mt-0.5">Household invite</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl" style={{ border: "1px solid var(--sidebar-border)" }}>

          {(status === "checking" || status === "joining") && (
            <div className="text-center py-6 space-y-4">
              <Loader2 size={32} className="mx-auto text-[#C8A464] animate-spin" />
              <p className="text-sm text-stone-600">
                {status === "checking" ? "Checking your account…" : "Joining household…"}
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 size={40} className="mx-auto text-[#2F6B52]" />
              <div>
                <p className="text-base font-semibold text-stone-900">You've joined "{householdName}"!</p>
                <p className="text-sm text-stone-400 mt-1">Redirecting to your dashboard…</p>
              </div>
            </div>
          )}

          {status === "unauthenticated" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                You need an account to join this household.
              </div>
              <p className="text-xs text-stone-500 text-center">
                Invite code: <span className="font-display font-semibold text-stone-800 tracking-wider">{code}</span>
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/signup"
                  className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "var(--color-primary)" }}>
                  Create an account
                </Link>
                <Link to="/login"
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-all">
                  Sign in
                </Link>
              </div>
              <p className="text-xs text-stone-400 text-center">
                After signing in, go to{" "}
                <Link to="/settings" className="font-semibold text-[#C8A464] hover:text-[#C8A464]/80">
                  Settings → Household
                </Link>{" "}
                and enter the code.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-xl bg-[#FDF3E3] border border-[#B8791F]/30 px-4 py-3">
                <AlertCircle size={16} className="text-[#B8791F] shrink-0 mt-0.5" />
                <p className="text-sm text-[#B8791F]">{errorMsg}</p>
              </div>
              <Link to="/settings"
                className="block text-center text-sm text-stone-500 hover:text-stone-700 transition-colors">
                ← Back to Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
