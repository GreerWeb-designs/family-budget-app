import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Home, Users, Link2, LogOut, Copy, Check, Pencil, X } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Member    = { id: string; name: string; email: string; role: string; joined_at: string };
type Household = { id: string; name: string; created_at: string };

const inputCls = "w-full h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-[#C8A464] focus:ring-2 focus:ring-[#C8A464]/15 transition-all";

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-white p-5", className)}
      style={{ borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.FC<{ size?: number; className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={15} className="text-stone-400" />
      <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">{title}</h2>
    </div>
  );
}

function StatusMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={cn("mt-2 text-xs font-medium", msg.ok ? "text-[#2F6B52]" : "text-[#B8791F]")}>{msg.text}</p>
  );
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: "#C8A464", color: "#0B2A4A" }}>
      {initials}
    </div>
  );
}

// ── Profile Section ────────────────────────────────────
function ProfileSection({ name: initialName, email }: { name: string; email: string }) {
  const [name, setName]         = useState(initialName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  const [curPw, setCurPw]       = useState("");
  const [newPw, setNewPw]       = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault(); setNameMsg(null); setNameLoading(true);
    try {
      await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      setNameMsg({ ok: true, text: "Name updated." });
    } catch (err: any) { setNameMsg({ ok: false, text: err?.message || "Failed to update name." }); }
    finally { setNameLoading(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPwMsg(null);
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "Passwords don't match." }); return; }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: "Password must be at least 8 characters." }); return; }
    setPwLoading(true);
    try {
      await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
      setPwMsg({ ok: true, text: "Password updated." });
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) { setPwMsg({ ok: false, text: err?.message || "Failed to update password." }); }
    finally { setPwLoading(false); }
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-[#0B2A4A]">Display name</span>
        </div>
        <form onSubmit={saveName} className="flex gap-2">
          <input className={cn(inputCls, "flex-1")} value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit" disabled={nameLoading}
            className="h-10 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: "#0B2A4A" }}>
            {nameLoading ? "…" : "Save"}
          </button>
        </form>
        <StatusMsg msg={nameMsg} />
        <p className="mt-3 text-xs text-stone-400">Email: <span className="text-stone-600">{email}</span></p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-[#0B2A4A]">Change password</span>
        </div>
        <form onSubmit={changePassword} className="space-y-2.5">
          <input className={inputCls} type="password" placeholder="Current password"
            value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" required />
          <input className={inputCls} type="password" placeholder="New password (min 8 chars)"
            value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
          <input
            className={cn(inputCls, confirmPw && confirmPw !== newPw ? "border-[#B8791F]/50" : "")}
            type="password" placeholder="Confirm new password"
            value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required />
          <StatusMsg msg={pwMsg} />
          <button type="submit" disabled={pwLoading}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 disabled:opacity-60 transition-all">
            {pwLoading ? "Updating…" : "Update password"}
          </button>
        </form>
      </Card>
    </div>
  );
}

// ── Household Section ──────────────────────────────────
function HouseholdSection({ currentUserId }: { currentUserId: string }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied]     = useState<"code" | "link" | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMsg, setJoinMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  const APP_URL = "https://app.ducharmefamilybudget.com";

  async function loadHousehold() {
    try {
      const data = await api<{ household: Household | null; members: Member[] }>("/api/household");
      setHousehold(data.household);
      setMembers(data.members);
      if (data.household) setHouseholdName(data.household.name);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadHousehold(); }, []);

  async function saveHouseholdName(e: React.FormEvent) {
    e.preventDefault(); setNameLoading(true);
    try {
      await api("/api/household", { method: "PATCH", body: JSON.stringify({ name: householdName }) });
      setHousehold((h) => h ? { ...h, name: householdName } : h);
      setEditingName(false);
    } finally { setNameLoading(false); }
  }

  async function generateInvite() {
    setInviteLoading(true);
    try {
      const res = await api<{ ok: boolean; code: string; expiresAt: string }>("/api/household/invite", { method: "POST" });
      setInviteCode(res.code); setInviteExpiry(res.expiresAt); setCopied(null);
    } finally { setInviteLoading(false); }
  }

  function copyToClipboard(text: string, type: "code" | "link") {
    navigator.clipboard.writeText(text).then(() => { setCopied(type); setTimeout(() => setCopied(null), 1500); });
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member from the household?")) return;
    try {
      await api(`/api/household/members/${memberId}`, { method: "DELETE" });
      setMembers((m) => m.filter((x) => x.id !== memberId));
    } catch (err: any) { alert(err?.message || "Failed to remove member."); }
  }

  async function joinHousehold(e: React.FormEvent) {
    e.preventDefault(); setJoinMsg(null); setJoinLoading(true);
    try {
      const res = await api<{ ok: boolean; householdName: string }>("/api/household/join", {
        method: "POST", body: JSON.stringify({ code: joinCode }),
      });
      setJoinMsg({ ok: true, text: `You've joined "${res.householdName}"! Refreshing…` });
      setJoinCode("");
      setTimeout(() => loadHousehold(), 1200);
    } catch (err: any) {
      setJoinMsg({ ok: false, text: err?.message || "Invalid or expired invite code." });
    } finally { setJoinLoading(false); }
  }

  const myRole   = members.find((m) => m.id === currentUserId)?.role;
  const adminCount = members.filter((m) => m.role === "admin").length;

  if (loading) return <div className="text-sm text-stone-400 py-4 animate-pulse">Loading household…</div>;

  return (
    <div className="space-y-3">
      {/* Household name */}
      {household && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Home size={14} className="text-stone-400" />
              <span className="text-sm font-semibold text-[#0B2A4A]">Household name</span>
            </div>
            {!editingName && (
              <button type="button" onClick={() => setEditingName(true)}
                className="p-1.5 rounded-lg text-[#5C6B7A] hover:text-[#C8A464] hover:bg-[#F5F1EA] transition-colors">
                <Pencil size={13} />
              </button>
            )}
          </div>
          {editingName ? (
            <form onSubmit={saveHouseholdName} className="flex gap-2">
              <input className={cn(inputCls, "flex-1")} value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)} autoFocus required />
              <button type="submit" disabled={nameLoading}
                className="h-10 px-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#0B2A4A" }}>
                {nameLoading ? "…" : "Save"}
              </button>
              <button type="button" onClick={() => { setEditingName(false); setHouseholdName(household.name); }}
                className="h-10 w-10 rounded-xl border border-stone-200 text-stone-400 hover:bg-stone-50 flex items-center justify-center transition-all">
                <X size={14} />
              </button>
            </form>
          ) : (
            <div className="text-base font-semibold text-stone-900">{household.name}</div>
          )}
        </Card>
      )}

      {/* Members */}
      {household && members.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-stone-400" />
            <span className="text-sm font-semibold text-[#0B2A4A]">Members ({members.length})</span>
          </div>
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <MemberAvatar name={m.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-stone-800 truncate">{m.name}</span>
                    {m.id === currentUserId && <span className="text-xs text-stone-400">(you)</span>}
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                      m.role === "admin" ? "bg-[#FDF8F0] text-[#B8791F] border-[#C8A464]/30" : "bg-[#F5F1EA] text-[#5C6B7A] border-[#E8E2D9]")}>
                      {m.role === "admin" ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 truncate">{m.email}</div>
                </div>
                {(myRole === "admin" || m.id === currentUserId) && !(m.id === currentUserId && adminCount <= 1) && (
                  <button type="button" onClick={() => removeMember(m.id)}
                    className="text-xs text-[#5C6B7A] hover:text-[#B8791F] transition-colors font-medium shrink-0">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Invite */}
      {household && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Link2 size={14} className="text-stone-400" />
            <span className="text-sm font-semibold text-[#0B2A4A]">Invite a crew member</span>
          </div>
          {inviteCode ? (
            <div className="space-y-3">
              <div className="text-center py-5 rounded-2xl border-2 border-dashed border-[#C8A464] bg-[#F5F1EA]">
                <div className="font-mono text-3xl font-semibold text-[#0B2A4A] tracking-widest select-all">{inviteCode}</div>
                <div className="text-xs text-[#5C6B7A] mt-2">
                  Expires {new Date(inviteExpiry!).toLocaleString()}
                </div>
              </div>
              <div className="text-xs text-center break-all text-[#C8A464] font-medium">
                {APP_URL}/join/{inviteCode}
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <button type="button" onClick={() => copyToClipboard(inviteCode!, "code")}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "#0B2A4A" }}>
                  {copied === "code" ? <Check size={13} /> : <Copy size={13} />}
                  {copied === "code" ? "Copied!" : "Copy code"}
                </button>
                <button type="button" onClick={() => copyToClipboard(`${APP_URL}/join/${inviteCode}`, "link")}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-all">
                  {copied === "link" ? <Check size={13} /> : <Copy size={13} />}
                  {copied === "link" ? "Copied!" : "Copy link"}
                </button>
                <button type="button" onClick={generateInvite} disabled={inviteLoading}
                  className="h-9 px-4 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-60 transition-all">
                  New code
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={generateInvite} disabled={inviteLoading}
              className="h-10 px-5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: "#0B2A4A" }}>
              {inviteLoading ? "Generating…" : "Generate invite code"}
            </button>
          )}
        </Card>
      )}

      {/* Join */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-[#0B2A4A]">Join a household</span>
        </div>
        <p className="text-xs text-stone-400 mb-4">Enter an invite code to join someone's household.</p>
        <form onSubmit={joinHousehold} className="flex gap-2">
          <input className={cn(inputCls, "flex-1 font-display tracking-widest uppercase")}
            placeholder="ABC123" value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={8} required />
          <button type="submit" disabled={joinLoading}
            className="h-10 px-4 rounded-xl text-sm font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 disabled:opacity-60 transition-all">
            {joinLoading ? "Joining…" : "Join"}
          </button>
        </form>
        {joinMsg && <p className={cn("mt-2 text-xs font-medium", joinMsg.ok ? "text-[#2F6B52]" : "text-[#B8791F]")}>{joinMsg.text}</p>}
      </Card>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────
export default function Settings() {
  const nav = useNavigate();
  const [me, setMe] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  async function handleLogout() {
    try { await api("/api/auth/logout", { method: "POST" }); } finally { nav("/login", { replace: true }); }
  }

  async function resetOnboarding() {
    setResetting(true);
    try {
      await api("/api/onboarding/reset", { method: "POST" });
      nav("/onboarding", { replace: true });
    } catch (err: any) {
      alert(err?.message || "Failed to reset onboarding.");
    } finally { setResetting(false); }
  }

  useEffect(() => {
    api<{ userId: string; name: string; email: string }>("/api/auth/me")
      .then(setMe).catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Profile */}
      <section id="profile">
        <SectionTitle icon={User} title="Your profile" />
        {me ? <ProfileSection name={me.name} email={me.email} /> : <div className="text-sm text-stone-400 animate-pulse">Loading…</div>}
      </section>

      {/* Household */}
      <section id="household">
        <SectionTitle icon={Home} title="Your household" />
        {me ? <HouseholdSection currentUserId={me.userId} /> : <div className="text-sm text-stone-400 animate-pulse">Loading…</div>}
      </section>

      {/* Mobile sign out */}
      <div className="md:hidden">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <LogOut size={14} className="text-stone-400" />
            <span className="text-sm font-semibold text-stone-900">Account</span>
          </div>
          <button type="button" onClick={handleLogout}
            className="w-full h-10 rounded-xl border border-[#B8791F]/30 bg-[#FDF3E3] text-sm font-semibold text-[#B8791F] hover:bg-[#FAE8D0] transition-all">
            Sign out
          </button>
        </Card>
      </div>

      {/* Dev-only: Reset onboarding */}
      {import.meta.env.DEV && (
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              DEV ONLY
            </span>
          </div>
          <p className="text-xs text-stone-400 mb-3 mt-2">
            Clears your onboarding status so you can test the flow again without creating a new account.
          </p>
          <button type="button" onClick={resetOnboarding} disabled={resetting}
            className="h-9 px-4 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60 transition-all">
            {resetting ? "Resetting…" : "Reset onboarding"}
          </button>
        </Card>
      )}

    </div>
  );
}
