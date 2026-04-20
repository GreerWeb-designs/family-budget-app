import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { inputCls, labelCls, AuthError, PrimaryBtn } from "./Login";
import { BrandMark, Wordmark } from "../components/ui";

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length === 0) return { label: "", color: "", pct: 0 };
  let score = 0;
  if (pw.length >= 8)           score++;
  if (pw.length >= 12)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak",   color: "#A3632F", pct: 33 };
  if (score <= 3) return { label: "Fair",   color: "#D99A66", pct: 66 };
  return              { label: "Strong", color: "#2D6E70", pct: 100 };
}

// TESTING: set to false to remove the test code gate
const TEST_CODE_REQUIRED = true;
const VALID_TEST_CODE    = "TestUser12!";

export default function Signup() {
  const nav = useNavigate();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [testCode, setTestCode] = useState("");
  const [err, setErr]           = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  const strength = passwordStrength(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (TEST_CODE_REQUIRED && testCode !== VALID_TEST_CODE) {
      setErr("Incorrect test code. Contact the admin for access.");
      return;
    }
    if (password !== confirm)   { setErr("Passwords don't match."); return; }
    if (password.length < 8)    { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const res = await api<{ requiresVerification?: boolean }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (res.requiresVerification) {
        nav("/check-email", { state: { email } });
      } else {
        nav("/login", { state: { justSignedUp: true } });
      }
    } catch (e: any) {
      setErr(e?.message || "Couldn't create account — please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#1B4243" }}>
      <div className="w-full max-w-100">
        {/* Logo */}
        <div className="text-center mb-8">
          <BrandMark size={48} className="mx-auto mb-3" />
          <Wordmark size="md" variant="plain" className="text-white" />
          <div className="text-sm mt-1" style={{ color: "#6FA3A5" }}>Your Home, Organized.</div>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: "#FFFDF8", borderColor: "#C9DEDF" }}>
          <h2 className="text-2xl font-medium text-ink-900 mb-6"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Create your account
          </h2>
          <form onSubmit={onSubmit} className="space-y-4">
            {TEST_CODE_REQUIRED && (
              <label className="block">
                <span className={labelCls}>Test code</span>
                <input
                  className={inputCls + (testCode && testCode !== VALID_TEST_CODE ? " border-rust-500/60" : "")}
                  placeholder="Enter test code to continue"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  autoComplete="off"
                  required
                />
                <p className="mt-1 text-[11px] text-ink-400">NestOtter is currently in closed testing. Contact the admin for your code.</p>
              </label>
            )}

            <label className="block">
              <span className={labelCls}>Full name</span>
              <input className={inputCls} placeholder="Your name"
                value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>

            <label className="block">
              <span className={labelCls}>Email</span>
              <input className={inputCls} type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>

            <label className="block">
              <span className={labelCls}>Password</span>
              <input className={inputCls} type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="h-1 w-full rounded-full overflow-hidden bg-cream-200">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${strength.pct}%`, background: strength.color }} />
                  </div>
                  <div className="mt-1 text-xs font-medium" style={{ color: strength.color }}>{strength.label}</div>
                </div>
              )}
            </label>

            <label className="block">
              <span className={labelCls}>Confirm password</span>
              <input
                className={inputCls + (confirm && confirm !== password ? " border-rust-500/60" : "")}
                type="password" placeholder="••••••••"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>

            <AuthError msg={err} />
            <PrimaryBtn busy={busy} label="Create account" loadingLabel="Creating account…" />
          </form>

          <p className="mt-5 text-center text-xs text-ink-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-teal-500 hover:opacity-80 transition-opacity">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
