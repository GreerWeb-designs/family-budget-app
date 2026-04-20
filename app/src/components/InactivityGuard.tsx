import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const IDLE_MS  = 8 * 60 * 1000;  // 8 minutes until warning
const WARN_MS  = 2 * 60 * 1000;  // 2-minute countdown before auto-logout
const TICK_MS  = 10_000;          // idle check every 10 seconds

const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

export function InactivityGuard() {
  const nav            = useNavigate();
  const lastActivity   = useRef(Date.now());
  const warnStarted    = useRef<number | null>(null);
  const [warning, setWarning]     = useState(false);
  const [countdown, setCountdown] = useState(WARN_MS / 1000);

  // ── Track any user activity ──────────────────────────────────────────────
  useEffect(() => {
    function touch() { lastActivity.current = Date.now(); }
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, touch));
  }, []);

  // ── Poll for idle (only while not in warning state) ──────────────────────
  useEffect(() => {
    if (warning) return;
    const id = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_MS) {
        warnStarted.current = Date.now();
        setWarning(true);
        setCountdown(WARN_MS / 1000);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [warning]);

  // ── Countdown tick while warning is visible ──────────────────────────────
  useEffect(() => {
    if (!warning) return;
    const id = setInterval(() => {
      const elapsed   = Date.now() - (warnStarted.current ?? Date.now());
      const remaining = Math.max(0, Math.ceil((WARN_MS - elapsed) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        doLogout();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [warning]);

  async function doLogout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    nav("/login", { replace: true });
  }

  function stayLoggedIn() {
    lastActivity.current = Date.now();
    warnStarted.current  = null;
    setWarning(false);
    setCountdown(WARN_MS / 1000);
  }

  if (!warning) return null;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const pct  = (countdown / (WARN_MS / 1000)) * 100;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div className="bg-white rounded-3xl p-7 max-w-xs w-full shadow-2xl text-center space-y-5">
        {/* Icon */}
        <div
          className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shadow-md"
          style={{ background: "linear-gradient(135deg,#2F8F7E 0%,#1B4243 100%)" }}
        >
          🔒
        </div>

        {/* Heading */}
        <div className="space-y-1.5">
          <p className="font-display text-xl font-semibold text-ink-900">Still there?</p>
          <p className="text-sm text-ink-500 leading-relaxed">
            You've been inactive for a bit. For your security, you'll be signed out in:
          </p>
        </div>

        {/* Countdown ring */}
        <div className="relative mx-auto h-24 w-24">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="none" stroke="#FAF6EF" strokeWidth="8" />
            <circle
              cx="48" cy="48" r="42" fill="none"
              stroke="#2F8F7E" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-2xl font-bold text-ink-900 tabular-nums">
              {mins}:{secs.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={stayLoggedIn}
            className="h-12 w-full rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--color-primary)" }}
          >
            I'm still here
          </button>
          <button
            type="button"
            onClick={doLogout}
            className="h-10 w-full rounded-xl text-sm font-medium text-ink-500 hover:bg-cream-100 transition-colors"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
