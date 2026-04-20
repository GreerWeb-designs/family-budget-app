import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { User, Lock, Home, Users, Link2, LogOut, Copy, Check, Pencil, X, UserPlus, Plug } from "lucide-react";
import { api, getApiBase } from "../lib/api";
import { cn } from "../lib/utils";
import { useUser } from "../lib/UserContext";
import { isAdminOrPrimary } from "../lib/permissions";

type DepPermissions = {
  finances_enabled: boolean;
  can_see_budget: boolean; can_see_transactions: boolean; can_see_bills: boolean;
  can_see_debts: boolean; can_see_spending: boolean; can_see_goals: boolean;
  can_add_chores: boolean; can_add_grocery: boolean; can_add_calendar: boolean;
  can_view_notes: boolean; can_post_notes: boolean;
  can_see_recipes: boolean; can_see_meals: boolean; can_see_todo: boolean;
  can_see_allowance: boolean;
};
type Member    = { id: string; name: string; email: string; role: string; joined_at: string; account_type?: string; permissions?: DepPermissions | null };
type Household = { id: string; name: string; created_at: string };

const inputCls = "w-full h-10 rounded-xl border border-cream-200 bg-cream-50 px-3 text-sm text-ink-900 placeholder-ink-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all";

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
      <Icon size={15} className="text-ink-500" />
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">{title}</h2>
    </div>
  );
}

function StatusMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={cn("mt-2 text-xs font-medium", msg.ok ? "text-teal-600" : "text-rust-600")}>{msg.text}</p>
  );
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: "#2D6E70" }}>
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
          <User size={14} className="text-ink-500" />
          <span className="text-sm font-semibold text-ink-900">Display name</span>
        </div>
        <form onSubmit={saveName} className="flex gap-2">
          <input className={cn(inputCls, "flex-1")} value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit" disabled={nameLoading}
            className="h-10 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: "#1B4243" }}>
            {nameLoading ? "…" : "Save"}
          </button>
        </form>
        <StatusMsg msg={nameMsg} />
        <p className="mt-3 text-xs text-ink-500">Email: <span className="text-ink-500">{email}</span></p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={14} className="text-ink-500" />
          <span className="text-sm font-semibold text-ink-900">Change password</span>
        </div>
        <form onSubmit={changePassword} className="space-y-2.5">
          <input className={inputCls} type="password" placeholder="Current password"
            value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" required />
          <input className={inputCls} type="password" placeholder="New password (min 8 chars)"
            value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
          <input
            className={cn(inputCls, confirmPw && confirmPw !== newPw ? "border-rust-600/50" : "")}
            type="password" placeholder="Confirm new password"
            value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required />
          <StatusMsg msg={pwMsg} />
          <button type="submit" disabled={pwLoading}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-ink-900 bg-cream-100 hover:bg-cream-200 disabled:opacity-60 transition-all">
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

  const APP_URL = "https://app.nestotter.com";

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

  if (loading) return <div className="text-sm text-ink-500 py-4 animate-pulse">Loading household…</div>;

  return (
    <div className="space-y-3">
      {/* Household name */}
      {household && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Home size={14} className="text-ink-500" />
              <span className="text-sm font-semibold text-ink-900">Household name</span>
            </div>
            {!editingName && (
              <button type="button" onClick={() => setEditingName(true)}
                className="p-1.5 rounded-lg text-ink-500 hover:text-rust-300 hover:bg-cream-100 transition-colors">
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
                style={{ background: "#1B4243" }}>
                {nameLoading ? "…" : "Save"}
              </button>
              <button type="button" onClick={() => { setEditingName(false); setHouseholdName(household.name); }}
                className="h-10 w-10 rounded-xl border border-cream-200 text-ink-500 hover:bg-cream-50 flex items-center justify-center transition-all">
                <X size={14} />
              </button>
            </form>
          ) : (
            <div className="text-base font-semibold text-ink-900">{household.name}</div>
          )}
        </Card>
      )}

      {/* Members */}
      {household && members.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-ink-500" />
            <span className="text-sm font-semibold text-ink-900">Members ({members.length})</span>
          </div>
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <MemberAvatar name={m.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-ink-900 truncate">{m.name}</span>
                    {m.id === currentUserId && <span className="text-xs text-ink-500">(you)</span>}
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                      m.account_type === "dependent" ? "bg-teal-50 text-teal-600 border-teal-500/30" :
                      m.role === "admin" ? "bg-rust-50 text-rust-600 border-rust-500/30" : "bg-cream-100 text-ink-500 border-cream-200")}>
                      {m.account_type === "dependent" ? "Dependent" : m.role === "admin" ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 truncate">{m.email}</div>
                </div>
                {(myRole === "admin" || m.id === currentUserId) && !(m.id === currentUserId && adminCount <= 1) && (
                  <button type="button" onClick={() => removeMember(m.id)}
                    className="text-xs text-ink-500 hover:text-rust-600 transition-colors font-medium shrink-0">
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
            <Link2 size={14} className="text-ink-500" />
            <span className="text-sm font-semibold text-ink-900">Invite a crew member</span>
          </div>
          {inviteCode ? (
            <div className="space-y-3">
              <div className="text-center py-5 rounded-2xl border-2 border-dashed border-teal-500 bg-cream-100">
                <div className="font-mono text-3xl font-semibold text-ink-900 tracking-widest select-all">{inviteCode}</div>
                <div className="text-xs text-ink-500 mt-2">
                  Expires {new Date(inviteExpiry!).toLocaleString()}
                </div>
              </div>
              <div className="text-xs text-center break-all text-rust-300 font-medium">
                {APP_URL}/join/{inviteCode}
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <button type="button" onClick={() => copyToClipboard(inviteCode!, "code")}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "#1B4243" }}>
                  {copied === "code" ? <Check size={13} /> : <Copy size={13} />}
                  {copied === "code" ? "Copied!" : "Copy code"}
                </button>
                <button type="button" onClick={() => copyToClipboard(`${APP_URL}/join/${inviteCode}`, "link")}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-cream-200 text-sm text-ink-500 hover:bg-cream-50 transition-all">
                  {copied === "link" ? <Check size={13} /> : <Copy size={13} />}
                  {copied === "link" ? "Copied!" : "Copy link"}
                </button>
                <button type="button" onClick={generateInvite} disabled={inviteLoading}
                  className="h-9 px-4 rounded-xl border border-cream-200 text-sm text-ink-500 hover:bg-cream-50 disabled:opacity-60 transition-all">
                  New code
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={generateInvite} disabled={inviteLoading}
              className="h-10 px-5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: "#1B4243" }}>
              {inviteLoading ? "Generating…" : "Generate invite code"}
            </button>
          )}
        </Card>
      )}

      {/* Join */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={14} className="text-ink-500" />
          <span className="text-sm font-semibold text-ink-900">Join a household</span>
        </div>
        <p className="text-xs text-ink-500 mb-4">Enter an invite code to join someone's household.</p>
        <form onSubmit={joinHousehold} className="flex gap-2">
          <input className={cn(inputCls, "flex-1 font-display tracking-widest uppercase")}
            placeholder="ABC123" value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={8} required />
          <button type="submit" disabled={joinLoading}
            className="h-10 px-4 rounded-xl text-sm font-semibold text-ink-900 bg-cream-100 hover:bg-cream-200 disabled:opacity-60 transition-all">
            {joinLoading ? "Joining…" : "Join"}
          </button>
        </form>
        {joinMsg && <p className={cn("mt-2 text-xs font-medium", joinMsg.ok ? "text-teal-600" : "text-rust-600")}>{joinMsg.text}</p>}
      </Card>
    </div>
  );
}

// ── Children section ──────────────────────────────────
type ChildProfile = { id: string; name: string; emoji: string };

const CHILD_EMOJIS = ["🧒","👦","👧","🧒‍♂️","🧒‍♀️","🐣","⭐","🦁","🐻","🐼","🦊","🐸"];

function ChildrenSection() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState("");
  const [emoji, setEmoji]       = useState("🧒");
  const [adding, setAdding]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const data = await api<{ children: ChildProfile[] }>("/api/household/children");
      setChildren(data.children ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addChild(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setAdding(true);
    try {
      const child = await api<ChildProfile>("/api/household/children", {
        method: "POST", body: JSON.stringify({ name: name.trim(), emoji }),
      });
      setChildren(prev => [...prev, child]);
      setName(""); setEmoji("🧒"); setShowForm(false);
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || "Failed to add child." });
    } finally { setAdding(false); }
  }

  async function removeChild(id: string) {
    if (!confirm("Remove this child profile?")) return;
    try {
      await api(`/api/household/children/${id}`, { method: "DELETE" });
      setChildren(prev => prev.filter(c => c.id !== id));
    } catch { setMsg({ ok: false, text: "Failed to remove." }); }
  }

  if (loading) return <div className="text-sm text-ink-500 animate-pulse py-2">Loading…</div>;

  return (
    <div className="space-y-3">
      {msg && (
        <div className={cn("rounded-xl px-4 py-2.5 text-sm font-medium border",
          msg.ok ? "bg-teal-50 text-teal-600 border-teal-500/30" : "bg-rust-50 text-rust-600 border-rust-600/30")}>
          {msg.text}
        </div>
      )}

      {children.map((child) => (
        <Card key={child.id}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{child.emoji}</span>
              <div>
                <div className="text-sm font-semibold text-ink-900">{child.name}</div>
                <div className="text-xs text-ink-500">No account — chore assignment only</div>
              </div>
            </div>
            <button type="button" onClick={() => removeChild(child.id)}
              className="p-1.5 rounded-lg text-ink-500 hover:text-rust-600 hover:bg-rust-50 transition-colors">
              <X size={14} />
            </button>
          </div>
        </Card>
      ))}

      {children.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-cream-200 px-4 py-8 text-center">
          <div className="text-2xl mb-2">🧒</div>
          <p className="text-sm text-ink-500">No dependents added yet.</p>
          <p className="text-xs text-ink-500 mt-0.5">Add a dependent to assign them chores without giving them an account.</p>
        </div>
      )}

      {!showForm ? (
        <button type="button" onClick={() => { setShowForm(true); setMsg(null); }}
          className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "#1B4243" }}>
          <UserPlus size={14} />
          Add dependent non-account
        </button>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-ink-900">Add child</span>
            <button type="button" onClick={() => { setShowForm(false); setMsg(null); }}
              className="p-1.5 rounded-lg text-ink-500 hover:bg-cream-100 transition-colors">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={addChild} className="space-y-3">
            <input className={inputCls} placeholder="Child's name" value={name}
              onChange={(e) => setName(e.target.value)} required autoFocus />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Pick an emoji</label>
              <div className="flex flex-wrap gap-2">
                {CHILD_EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => setEmoji(e)}
                    className={cn("text-xl w-9 h-9 rounded-xl border transition-all",
                      emoji === e ? "border-teal-500 bg-teal-50" : "border-cream-200 hover:bg-cream-100")}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={adding}
              className="h-10 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: "#1B4243" }}>
              {adding ? "Adding…" : "Add child"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}

// ── Dependents section ─────────────────────────────────
type PermGroup = { heading: string; items: { key: keyof DepPermissions; label: string }[] };

const PERM_GROUPS: PermGroup[] = [
  {
    heading: "Household",
    items: [
      { key: "can_see_goals",    label: "See goals" },
      { key: "can_add_chores",   label: "Add/manage chores" },
      { key: "can_add_grocery",  label: "Add grocery items" },
      { key: "can_add_calendar", label: "Add calendar events" },
      { key: "can_view_notes",   label: "View crew notes" },
      { key: "can_post_notes",   label: "Post crew notes" },
      { key: "can_see_recipes",  label: "See recipes" },
      { key: "can_see_meals",    label: "See meal plan" },
      { key: "can_see_todo",     label: "See to-do lists" },
      { key: "can_see_allowance",label: "See allowance" },
    ],
  },
  {
    heading: "Finances (requires master switch on)",
    items: [
      { key: "can_see_budget",       label: "See budget" },
      { key: "can_see_transactions", label: "See transactions" },
      { key: "can_see_spending",     label: "See spending charts" },
      { key: "can_see_bills",        label: "See bills" },
      { key: "can_see_debts",        label: "See debts" },
    ],
  },
];

function PermToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-teal-600" : "bg-cream-200"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

function DependentsSection() {
  const [dependents, setDependents] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ members: Member[] }>("/api/household");
      setDependents((data.members ?? []).filter((m) => m.account_type === "dependent"));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addDependent(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setAdding(true);
    try {
      await api("/api/auth/signup-dependent", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setMsg({ ok: true, text: `${name} added as a dependent.` });
      setName(""); setEmail(""); setPassword(""); setShowAddForm(false);
      await load();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || "Failed to add dependent." });
    } finally { setAdding(false); }
  }

  async function updatePerm(userId: string, key: keyof DepPermissions, value: boolean) {
    setSaving(userId);
    try {
      await api(`/api/household/members/${userId}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      setDependents((prev) => prev.map((d) =>
        d.id === userId
          ? { ...d, permissions: { ...(d.permissions as DepPermissions), [key]: value } }
          : d
      ));
    } catch { /* silent */ } finally { setSaving(null); }
  }

  if (loading) return <div className="text-sm text-ink-500 animate-pulse py-2">Loading…</div>;

  return (
    <div className="space-y-3">
      {msg && (
        <div className={cn("rounded-xl px-4 py-2.5 text-sm font-medium border",
          msg.ok ? "bg-teal-50 text-teal-600 border-teal-500/30" : "bg-rust-50 text-rust-600 border-rust-600/30")}>
          {msg.text}
        </div>
      )}

      {dependents.length > 0 && dependents.map((dep) => {
        const perms = dep.permissions as DepPermissions;
        const finOn = !!perms?.finances_enabled;
        return (
          <Card key={dep.id}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-ink-900">{dep.name}</div>
                <div className="text-xs text-ink-500">{dep.email}</div>
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-teal-50 text-teal-600 border-teal-500/30">
                Dependent
              </span>
            </div>

            {/* Master Finances toggle */}
            <div className="rounded-xl border mb-4 overflow-hidden" style={{ borderColor: finOn ? "rgba(45,110,112,0.25)" : "rgba(193,122,63,0.25)" }}>
              <div className="flex items-center justify-between px-3 py-2.5" style={{
                background: finOn ? "rgba(45,110,112,0.08)" : "rgba(193,122,63,0.08)"
              }}>
                <div>
                  <span className="text-xs font-bold text-ink-900">Finances</span>
                  <p className="text-[11px] text-ink-500 mt-0.5">Master switch — locks all financial features</p>
                </div>
                <PermToggle
                  checked={finOn}
                  onChange={(v) => updatePerm(dep.id, "finances_enabled", v)}
                />
              </div>
            </div>

            {/* Grouped permission rows */}
            <div className="space-y-4">
              {PERM_GROUPS.map((group) => (
                <div key={group.heading}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">{group.heading}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.items.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-ink-500">{label}</span>
                        <PermToggle
                          checked={!!perms?.[key]}
                          onChange={(v) => updatePerm(dep.id, key, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {saving === dep.id && <div className="text-xs text-ink-500 mt-2 text-right">Saving…</div>}
          </Card>
        );
      })}

      {dependents.length === 0 && !showAddForm && (
        <div className="rounded-xl border border-dashed border-cream-200 px-4 py-8 text-center">
          <div className="text-2xl mb-2">👦</div>
          <p className="text-sm text-ink-500">No dependent accounts yet.</p>
          <p className="text-xs text-ink-500 mt-0.5">Create one to give a family member limited access.</p>
        </div>
      )}

      {!showAddForm ? (
        <button
          type="button"
          onClick={() => { setShowAddForm(true); setMsg(null); }}
          className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "#1B4243" }}
        >
          <UserPlus size={14} />
          Add dependent account
        </button>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-ink-900">New dependent account</span>
            <button type="button" onClick={() => { setShowAddForm(false); setMsg(null); }}
              className="p-1.5 rounded-lg text-ink-500 hover:text-ink-500 hover:bg-cream-100 transition-colors">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={addDependent} className="space-y-3">
            <input className={inputCls} placeholder="Name" value={name}
              onChange={(e) => setName(e.target.value)} required autoFocus />
            <input className={inputCls} type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <input className={inputCls} type="password" placeholder="Password (min 8 chars)" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <p className="text-xs text-ink-500">They'll log in with this email + password. You can adjust their permissions after adding them.</p>
            <button type="submit" disabled={adding}
              className="h-10 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
              style={{ background: "#1B4243" }}>
              {adding ? "Adding…" : "Create dependent account"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}

// ── Google Calendar card ───────────────────────────────
const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

type SyncPrefs = { syncEvents: boolean; syncMeals: boolean; syncBills: boolean };

function GoogleCalendarCard({ oauthResult }: { oauthResult: string | null }) {
  const [connected, setConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prefs, setPrefs] = useState<SyncPrefs>({ syncEvents: true, syncMeals: false, syncBills: false });
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    api<{ connected: boolean; email: string | null; prefs?: SyncPrefs }>("/api/auth/google/status")
      .then(d => {
        setConnected(d.connected);
        setGoogleEmail(d.email);
        if (d.prefs) setPrefs(d.prefs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (oauthResult === "connected") { setMsg({ ok: true, text: "Google Calendar connected!" }); setConnected(true); }
    if (oauthResult === "error")     { setMsg({ ok: false, text: "Google authorisation failed — please try again." }); }
  }, [oauthResult]);

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar?")) return;
    setDisconnecting(true);
    try {
      await api("/api/auth/google", { method: "DELETE" });
      setConnected(false); setGoogleEmail(null);
      setMsg({ ok: true, text: "Disconnected." });
    } catch { setMsg({ ok: false, text: "Failed to disconnect." }); }
    finally { setDisconnecting(false); }
  }

  async function togglePref(key: keyof SyncPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPrefsSaving(true);
    try {
      await api("/api/auth/google/sync-prefs", {
        method: "PATCH",
        body: JSON.stringify({ syncEvents: next.syncEvents, syncMeals: next.syncMeals, syncBills: next.syncBills }),
      });
    } catch { setPrefs(prefs); setMsg({ ok: false, text: "Failed to save preference." }); }
    finally { setPrefsSaving(false); }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-white border border-cream-200 flex items-center justify-center shadow-sm">
            <GoogleLogo />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900">Google Calendar</div>
            {loading ? (
              <div className="text-xs text-ink-400 animate-pulse">Checking…</div>
            ) : connected ? (
              <div className="text-xs text-teal-600 truncate">{googleEmail ?? "Connected"}</div>
            ) : (
              <div className="text-xs text-ink-500">Sync NestOtter events to your Google Calendar</div>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {!loading && !connected && (
            <a href={`${getApiBase()}/api/auth/google`}
              className="inline-flex h-8 items-center rounded-xl px-3 text-xs font-semibold text-white transition-all"
              style={{ background: "#1B4243" }}>
              Connect
            </a>
          )}
          {!loading && connected && (
            <button type="button" onClick={disconnect} disabled={disconnecting}
              className="h-8 rounded-xl border border-rust-600/30 px-3 text-xs font-semibold text-rust-600 hover:bg-rust-50 disabled:opacity-50 transition-all">
              {disconnecting ? "…" : "Disconnect"}
            </button>
          )}
        </div>
      </div>

      {connected && !loading && (
        <div className="mt-4 space-y-2 border-t border-cream-100 pt-4">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Sync categories</p>
          {([
            { key: "syncEvents" as const, label: "Calendar events" },
            { key: "syncMeals"  as const, label: "Meal plans" },
            { key: "syncBills"  as const, label: "Bills & due dates" },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-ink-700">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                disabled={prefsSaving}
                onClick={() => togglePref(key)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50",
                  prefs[key] ? "bg-teal-600" : "bg-cream-300"
                )}
              >
                <span className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200",
                  prefs[key] ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
            </label>
          ))}
        </div>
      )}

      {msg && (
        <p className={cn("mt-3 text-xs font-medium", msg.ok ? "text-teal-600" : "text-rust-600")}>{msg.text}</p>
      )}
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────
export default function Settings() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const googleParam = searchParams.get("google");
  const { user } = useUser();
  const canManageDependents = isAdminOrPrimary(user);

  // Clear the ?google= param from URL after reading it
  useEffect(() => {
    if (googleParam) setSearchParams({}, { replace: true });
  }, [googleParam]);
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
        {me ? <ProfileSection name={me.name} email={me.email} /> : <div className="text-sm text-ink-500 animate-pulse">Loading…</div>}
      </section>

      {/* Household */}
      <section id="household">
        <SectionTitle icon={Home} title="Your household" />
        {me ? <HouseholdSection currentUserId={me.userId} /> : <div className="text-sm text-ink-500 animate-pulse">Loading…</div>}
      </section>

      {/* Dependents */}
      {canManageDependents && (
        <section id="dependents">
          <SectionTitle icon={UserPlus} title="Dependent accounts" />
          <DependentsSection />
        </section>
      )}

      {/* Children */}
      {canManageDependents && (
        <section id="children">
          <SectionTitle icon={UserPlus} title="Children" />
          <ChildrenSection />
        </section>
      )}

      {/* Integrations */}
      <section id="integrations">
        <SectionTitle icon={Plug} title="Integrations" />
        <GoogleCalendarCard oauthResult={googleParam} />
      </section>

      {/* Mobile sign out */}
      <div className="md:hidden">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <LogOut size={14} className="text-ink-500" />
            <span className="text-sm font-semibold text-ink-900">Account</span>
          </div>
          <button type="button" onClick={handleLogout}
            className="w-full h-10 rounded-xl border border-rust-600/30 bg-rust-50 text-sm font-semibold text-rust-600 hover:bg-[#FAE8D0] transition-all">
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
          <p className="text-xs text-ink-500 mb-3 mt-2">
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
