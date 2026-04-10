import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function JoinHousehold() {
  const { code } = useParams<{ code: string }>();
  const nav = useNavigate();

  const [status, setStatus] = useState<"checking" | "joining" | "success" | "error" | "unauthenticated">("checking");
  const [householdName, setHouseholdName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Check if logged in, then auto-join
    api<{ userId: string }>("/api/auth/me")
      .then(() => {
        // Logged in — attempt join
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
        // Check if the error is auth-related (401)
        if (String(err?.message).includes("HTTP 401") || String(err?.message).toLowerCase().includes("unauthorized")) {
          setStatus("unauthenticated");
        } else {
          setErrorMsg(err?.message || "Something went wrong.");
          setStatus("error");
        }
      });
  }, [code, nav]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold text-xl shadow-lg shadow-emerald-500/30 mb-4">
            DB
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ducharme Budget</h1>
          <p className="mt-1 text-sm text-slate-400">Family household invite</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">

          {(status === "checking" || status === "joining") && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <span className="text-emerald-400 text-lg animate-spin">↻</span>
              </div>
              <p className="text-sm text-slate-300">
                {status === "checking" ? "Checking your account…" : "Joining household…"}
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
                ✓
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  You've joined "{householdName}"!
                </p>
                <p className="text-sm text-slate-400 mt-1">Redirecting to your dashboard…</p>
              </div>
            </div>
          )}

          {status === "unauthenticated" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-3 text-sm text-amber-400">
                You need an account to join this household.
              </div>
              <p className="text-xs text-slate-400 text-center">
                The invite code is: <span className="font-mono font-bold text-slate-200">{code}</span>
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  to={`/signup`}
                  className="block w-full h-11 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 transition-all text-center leading-11"
                >
                  Create an account
                </Link>
                <Link
                  to={`/login`}
                  className="block w-full h-11 rounded-xl border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-all text-center leading-11"
                >
                  Sign in
                </Link>
              </div>
              <p className="text-xs text-slate-500 text-center">
                After signing in, visit{" "}
                <Link to="/settings" className="text-emerald-400 hover:text-emerald-300">
                  Settings → Household
                </Link>{" "}
                and enter the code.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-3 text-sm text-rose-400">
                {errorMsg}
              </div>
              <Link
                to="/settings"
                className="block text-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back to Settings
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
