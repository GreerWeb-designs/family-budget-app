import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      nav("/home");
    } catch (e: any) {
  setErr(e?.message || "Login failed.");
} finally {

      setBusy(false);
    }
  }

  return (
  <div className="mx-auto mt-10 max-w-md">
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500">Log in to your family budget.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
            placeholder="you@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-700">Password</span>
          <input
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button
          disabled={busy}
          className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {err && <div className="text-sm text-red-600">{err}</div>}
      </form>
    </div>
  </div>
);

}
