import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Member = { id: string; name: string; email: string; role: string; joined_at: string };
type Household = { id: string; name: string; created_at: string };

// ---- Sub-components ----

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-slate-200 pb-3 mb-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

// ---- Profile Section ----

function ProfileSection({ name: initialName, email }: { name: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMsg(null);
    setNameLoading(true);
    try {
      await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      setNameMsg({ ok: true, text: "Name updated!" });
    } catch (err: any) {
      setNameMsg({ ok: false, text: err?.message || "Failed to update name." });
    } finally {
      setNameLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "Passwords do not match." }); return; }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: "Password must be at least 8 characters." }); return; }
    setPwLoading(true);
    try {
      await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
      setPwMsg({ ok: true, text: "Password updated!" });
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      setPwMsg({ ok: false, text: err?.message || "Failed to update password." });
    } finally {
      setPwLoading(false);
    }
  }

  const inputCls = "w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-medium text-slate-700 mb-4">Display name</h3>
        <form onSubmit={saveName} className="flex gap-3 items-end">
          <div className="flex-1">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <button
            type="submit"
            disabled={nameLoading}
            className="h-10 px-4 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all shrink-0"
          >
            {nameLoading ? "Saving…" : "Save"}
          </button>
        </form>
        {nameMsg && (
          <p className={`mt-2 text-xs ${nameMsg.ok ? "text-emerald-600" : "text-rose-500"}`}>{nameMsg.text}</p>
        )}
        <p className="mt-3 text-xs text-slate-400">Email: <span className="text-slate-600">{email}</span></p>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-slate-700 mb-4">Change password</h3>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            className={inputCls}
            type="password"
            placeholder="Current password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            autoComplete="current-password"
            required
          />
          <input
            className={inputCls}
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            required
          />
          <input
            className={`${inputCls} ${confirmPw && confirmPw !== newPw ? "border-rose-400" : ""}`}
            type="password"
            placeholder="Confirm new password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            required
          />
          {pwMsg && (
            <p className={`text-xs ${pwMsg.ok ? "text-emerald-600" : "text-rose-500"}`}>{pwMsg.text}</p>
          )}
          <button
            type="submit"
            disabled={pwLoading}
            className="h-10 px-4 rounded-xl bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 transition-all"
          >
            {pwLoading ? "Updating…" : "Update password"}
          </button>
        </form>
      </Card>
    </div>
  );
}

// ---- Household Section ----

function HouseholdSection({ currentUserId }: { currentUserId: string }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const APP_URL = "https://app.ducharmefamilybudget.com";

  async function loadHousehold() {
    try {
      const data = await api<{ household: Household | null; members: Member[] }>("/api/household");
      setHousehold(data.household);
      setMembers(data.members);
      if (data.household) setHouseholdName(data.household.name);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadHousehold(); }, []);

  async function saveHouseholdName(e: React.FormEvent) {
    e.preventDefault();
    setNameLoading(true);
    try {
      await api("/api/household", { method: "PATCH", body: JSON.stringify({ name: householdName }) });
      setHousehold((h) => h ? { ...h, name: householdName } : h);
      setEditingName(false);
    } finally {
      setNameLoading(false);
    }
  }

  async function generateInvite() {
    setInviteLoading(true);
    try {
      const res = await api<{ ok: boolean; code: string; expiresAt: string }>("/api/household/invite");
      setInviteCode(res.code);
      setInviteExpiry(res.expiresAt);
      setCopied(false);
    } finally {
      setInviteLoading(false);
    }
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member from the household?")) return;
    try {
      await api(`/api/household/members/${memberId}`, { method: "DELETE" });
      setMembers((m) => m.filter((x) => x.id !== memberId));
    } catch (err: any) {
      alert(err?.message || "Failed to remove member.");
    }
  }

  async function joinHousehold(e: React.FormEvent) {
    e.preventDefault();
    setJoinMsg(null);
    setJoinLoading(true);
    try {
      const res = await api<{ ok: boolean; householdName: string }>("/api/household/join", {
        method: "POST",
        body: JSON.stringify({ code: joinCode }),
      });
      setJoinMsg({ ok: true, text: `You've joined "${res.householdName}"! Refreshing…` });
      setJoinCode("");
      setTimeout(() => loadHousehold(), 1200);
    } catch (err: any) {
      setJoinMsg({ ok: false, text: err?.message || "Invalid or expired invite code." });
    } finally {
      setJoinLoading(false);
    }
  }

  const myRole = members.find((m) => m.id === currentUserId)?.role;
  const adminCount = members.filter((m) => m.role === "admin").length;

  if (loading) return <div className="text-sm text-slate-400 py-4">Loading…</div>;

  const inputCls = "w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="space-y-4">

      {/* Household Name */}
      {household && (
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-slate-700">Household name</h3>
            {!editingName && (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-xs text-emerald-600 hover:text-emerald-500 font-medium"
              >
                Edit
              </button>
            )}
          </div>
          {editingName ? (
            <form onSubmit={saveHouseholdName} className="flex gap-3 mt-2">
              <input
                className={`${inputCls} flex-1`}
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={nameLoading}
                className="h-10 px-4 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all shrink-0"
              >
                {nameLoading ? "…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setEditingName(false); setHouseholdName(household.name); }}
                className="h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-all shrink-0"
              >
                Cancel
              </button>
            </form>
          ) : (
            <p className="text-base font-semibold text-slate-900 mt-1">{household.name}</p>
          )}
        </Card>
      )}

      {/* Members */}
      {household && members.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium text-slate-700 mb-4">Members ({members.length})</h3>
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">{m.name}</span>
                    {m.id === currentUserId && <span className="text-xs text-slate-400">(you)</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.role === "admin"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {m.role === "admin" ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">{m.email}</div>
                </div>
                {(myRole === "admin" || m.id === currentUserId) && (
                  !(m.id === currentUserId && adminCount <= 1) && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-rose-400 hover:text-rose-600 font-medium shrink-0 transition-colors"
                    >
                      Remove
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Invite Code */}
      {household && (
        <Card>
          <h3 className="text-sm font-medium text-slate-700 mb-4">Invite someone</h3>
          {inviteCode ? (
            <div className="space-y-4">
              <div className="font-mono text-3xl font-bold text-slate-900 tracking-widest bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center select-all">
                {inviteCode}
              </div>
              <div className="text-xs text-slate-500 text-center">
                Expires {new Date(inviteExpiry!).toLocaleString()} · Share this link:
              </div>
              <div className="text-xs text-emerald-600 text-center break-all font-medium">
                {APP_URL}/join/{inviteCode}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={copyCode}
                  className="h-9 px-4 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 transition-all"
                >
                  {copied ? "Copied!" : "Copy code"}
                </button>
                <button
                  type="button"
                  onClick={generateInvite}
                  disabled={inviteLoading}
                  className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-all"
                >
                  New code
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={generateInvite}
              disabled={inviteLoading}
              className="h-10 px-5 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all"
            >
              {inviteLoading ? "Generating…" : "Generate invite code"}
            </button>
          )}
        </Card>
      )}

      {/* Join a household */}
      <Card>
        <h3 className="text-sm font-medium text-slate-700 mb-1">Join a household</h3>
        <p className="text-xs text-slate-400 mb-4">Enter an invite code to join someone's household.</p>
        <form onSubmit={joinHousehold} className="flex gap-3">
          <input
            className={`${inputCls} flex-1 font-mono uppercase tracking-wider`}
            placeholder="ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={8}
            required
          />
          <button
            type="submit"
            disabled={joinLoading}
            className="h-10 px-4 rounded-xl bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 transition-all shrink-0"
          >
            {joinLoading ? "Joining…" : "Join"}
          </button>
        </form>
        {joinMsg && (
          <p className={`mt-2 text-xs ${joinMsg.ok ? "text-emerald-600" : "text-rose-500"}`}>{joinMsg.text}</p>
        )}
      </Card>
    </div>
  );
}

// ---- Main Page ----

export default function Settings() {
  const nav = useNavigate();
  const [me, setMe] = useState<{ userId: string; name: string; email: string } | null>(null);

  async function handleLogout() {
    try { await api("/api/auth/logout", { method: "POST" }); } finally { nav("/login", { replace: true }); }
  }

  useEffect(() => {
    api<{ userId: string; name: string; email: string }>("/api/auth/me")
      .then(setMe)
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Profile */}
      <section id="profile">
        <SectionHeader title="Profile" />
        {me ? (
          <ProfileSection name={me.name} email={me.email} />
        ) : (
          <div className="text-sm text-slate-400">Loading…</div>
        )}
      </section>

      {/* Household */}
      <section id="household">
        <SectionHeader title="Household" />
        {me ? (
          <HouseholdSection currentUserId={me.userId} />
        ) : (
          <div className="text-sm text-slate-400">Loading…</div>
        )}
      </section>

      {/* Mobile sign out */}
      <div className="md:hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900 mb-3">Account</div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-11 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-all"
        >
          → Sign out
        </button>
      </div>

    </div>
  );
}
