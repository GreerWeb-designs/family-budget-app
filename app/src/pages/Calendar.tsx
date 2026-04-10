import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type Bill = { id: string; name: string; mode: "auto" | "manual"; due_date: string };
type FamEvent = { id: string; title: string; start_at: string; end_at: string | null; location: string | null };
type RangeRes = { bills: Bill[]; events: FamEvent[] };
type FCEvent = { id: string; title: string; start: string; end?: string; allDay?: boolean; backgroundColor?: string; borderColor?: string; textColor?: string; extendedProps?: Record<string, any> };

function checkIsMobile() {
  return window.innerWidth < 640 && window.innerHeight > window.innerWidth;
}

function ymd(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function toLocalDT(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function prettyDT(iso: string) { return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function prettyDate(iso: string) { return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

export default function Calendar() {
  const [rangeData, setRangeData] = useState<RangeRes | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isMobile, setIsMobile] = useState(checkIsMobile());

  const [visibleStart, setVisibleStart] = useState(() => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [visibleEnd, setVisibleEnd] = useState(() => ymd(new Date(new Date().getFullYear(), new Date().getMonth()+1, 1)));

  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => toLocalDT(new Date()));
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<{ kind: "bill" | "family"; id: string; title: string; start: string; end?: string; location?: string | null } | null>(null);

  useEffect(() => {
    const handler = () => setIsMobile(checkIsMobile());
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, []);
  
  async function loadRange(start: string, end: string) {
    const r = await api<RangeRes>(`/api/calendar/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    setRangeData(r);
  }

  useEffect(() => { loadRange(visibleStart, visibleEnd).catch((e) => setMsg(e?.message || "Error")); }, []);

  const fcEvents: FCEvent[] = useMemo(() => {
    if (!rangeData) return [];
    const bills: FCEvent[] = rangeData.bills.map((b) => ({
      id: `bill:${b.id}`, title: `📄 ${b.name}`, start: b.due_date, allDay: true,
      backgroundColor: "#fef3c7", borderColor: "#fde68a", textColor: "#92400e",
      extendedProps: { kind: "bill", billMode: b.mode },
    }));
    const events: FCEvent[] = rangeData.events.map((e) => ({
      id: `cal:${e.id}`, title: e.title, start: e.start_at, end: e.end_at || undefined,
      backgroundColor: "#dbeafe", borderColor: "#bfdbfe", textColor: "#1e40af",
      extendedProps: { kind: "family", location: e.location },
    }));
    return [...bills, ...events];
  }, [rangeData]);

  // Combined list for mobile, sorted by date
  const listItems = useMemo(() => {
    if (!rangeData) return [];
    const items: { date: string; label: string; type: "bill" | "event"; id: string; kind: "bill" | "family"; mode?: string; location?: string | null }[] = [
      ...rangeData.bills.map((b) => ({ date: b.due_date, label: b.name, type: "bill" as const, id: b.id, kind: "bill" as const, mode: b.mode })),
      ...rangeData.events.map((e) => ({ date: e.start_at.slice(0, 10), label: e.title, type: "event" as const, id: e.id, kind: "family" as const, location: e.location })),
    ];
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [rangeData]);

  function openAdd(d: Date, hasTime: boolean) {
    if (!hasTime) d.setHours(9, 0, 0, 0);
    const end = new Date(d.getTime() + 3600000);
    setTitle(""); setStartAt(toLocalDT(d)); setEndAt(toLocalDT(end)); setLocation(""); setNotes(""); setMsg(null); setAddOpen(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!title.trim()) { setMsg("Enter a title."); return; }
    setBusy(true);
    try {
      await api("/api/calendar", { method: "POST", body: JSON.stringify({ title: title.trim(), startAt: new Date(startAt).toISOString(), endAt: endAt ? new Date(endAt).toISOString() : null, location: location.trim() || undefined, notes: notes.trim() || undefined }) });
      setAddOpen(false); await loadRange(visibleStart, visibleEnd);
    } catch (err: any) { setMsg(err?.message || "Error saving."); } finally { setBusy(false); }
  }

  function onEventClick(info: any) {
    const ev = info.event; const rawId: string = ev.id || "";
    const kind: "bill" | "family" = rawId.startsWith("bill:") ? "bill" : "family";
    const id = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    setSelected({ kind, id, title: ev.title, start: ev.startStr, end: ev.endStr || undefined, location: ev.extendedProps?.location ?? null });
    setViewOpen(true);
  }

  async function deleteSelected() {
    if (!selected || selected.kind !== "family") return;
    setBusy(true); setMsg(null);
    try {
      await api(`/api/calendar/${selected.id}`, { method: "DELETE" });
      setViewOpen(false); setSelected(null); await loadRange(visibleStart, visibleEnd);
    } catch (err: any) { setMsg(err?.message || "Error."); } finally { setBusy(false); }
  }

  const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Click a day to add an event · Click an event to view</p>
        <button type="button" onClick={() => openAdd(new Date(), true)}
          className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 transition-all">
          + Add Event
        </button>
      </div>

      {msg && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{msg}</div>}

      {/* Mobile: list view */}
      {isMobile ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">This Month</div>
            <div className="flex gap-2">
              <span className="text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5">📄 Bills</span>
              <span className="text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5">📅 Events</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {listItems.length === 0 && <div className="px-4 py-8 text-sm text-slate-400 text-center">Nothing this month.</div>}
            {listItems.map((item, i) => (
              <div key={`${item.type}-${item.id}-${i}`} className="flex items-center gap-3 px-4 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${item.type === "bill" ? "bg-amber-100" : "bg-blue-100"}`}>
                  {item.type === "bill" ? "📄" : "📅"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.type === "bill" ? prettyDate(item.date) : prettyDT(item.date + "T00:00:00")}</div>
                </div>
                {item.type === "bill" && <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${item.mode === "auto" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{item.mode === "auto" ? "Auto" : "Manual"}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Desktop: FullCalendar */
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
            height="auto"
            events={fcEvents}
            dateClick={(arg) => openAdd(arg.date, !arg.allDay)}
            eventClick={onEventClick}
            datesSet={(arg) => {
              const start = ymd(arg.start); const end = ymd(arg.end);
              setVisibleStart(start); setVisibleEnd(end);
              loadRange(start, end).catch((e) => setMsg(e?.message || "Error"));
            }}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          />
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Bills due
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Family events
        </span>
      </div>

      {/* Add Event Modal */}
      {addOpen && (
        <Modal onClose={() => setAddOpen(false)}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Add Event</div>
              <div className="text-xs text-slate-400 mt-0.5">Shows in blue on the calendar</div>
            </div>
            <button type="button" onClick={() => setAddOpen(false)} disabled={busy}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
          <form onSubmit={saveEvent} className="space-y-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Title</span>
              <input className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Soccer, dentist, trip…" autoFocus />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Start</span>
                <input type="datetime-local" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">End (optional)</span>
                <input type="datetime-local" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Location</span>
                <input className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</span>
                <input className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </label>
            </div>
            {msg && <div className="text-sm text-rose-600">{msg}</div>}
            <button disabled={busy}
              className="h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all">
              {busy ? "Saving…" : "Save Event"}
            </button>
          </form>
        </Modal>
      )}

      {/* View Modal */}
      {viewOpen && selected && (
        <Modal onClose={() => setViewOpen(false)}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{selected.kind === "bill" ? "Bill reminder" : "Family event"}</div>
              <div className="text-lg font-semibold text-slate-900 mt-1">{selected.title}</div>
            </div>
            <button type="button" onClick={() => setViewOpen(false)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-slate-400 w-14 shrink-0">Start</span><span className="text-slate-900">{selected.kind === "bill" ? prettyDate(selected.start) : prettyDT(selected.start)}</span></div>
            {selected.end && selected.kind === "family" && <div className="flex gap-2"><span className="text-slate-400 w-14 shrink-0">End</span><span className="text-slate-900">{prettyDT(selected.end)}</span></div>}
            {selected.location && <div className="flex gap-2"><span className="text-slate-400 w-14 shrink-0">Where</span><span className="text-slate-900">{selected.location}</span></div>}
          </div>
          {selected.kind === "bill" && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-800">
              Edit bills from the Bills page, not the calendar.
            </div>
          )}
          <div className="mt-5 flex gap-2 justify-end">
            {selected.kind === "family" && (
              <button type="button" disabled={busy} onClick={deleteSelected}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 transition-all">
                Delete event
              </button>
            )}
            <button type="button" onClick={() => setViewOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}