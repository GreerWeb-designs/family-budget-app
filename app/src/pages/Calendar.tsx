import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type Bill = { id: string; name: string; mode: "auto" | "manual"; due_date: string };
type FamEvent = { id: string; title: string; start_at: string; end_at: string | null; location: string | null };
type RangeRes = { bills: Bill[]; events: FamEvent[] };

type FCEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: Record<string, any>;
};

function ymd(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalDatetimeInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function prettyDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Calendar() {
  const [rangeData, setRangeData] = useState<RangeRes | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [visibleStart, setVisibleStart] = useState<string>(() =>
    ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [visibleEnd, setVisibleEnd] = useState<string>(() =>
    ymd(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1))
  );

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => toLocalDatetimeInputValue(new Date()));
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // View/Delete modal
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<{
    kind: "bill" | "family";
    id: string;
    title: string;
    start: string;
    end?: string;
    location?: string | null;
  } | null>(null);

  async function loadRange(start: string, end: string) {
    const r = await api<RangeRes>(
      `/api/calendar/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
    setRangeData(r);
  }

  async function refreshVisibleRange() {
    await loadRange(visibleStart, visibleEnd);
  }

  useEffect(() => {
    loadRange(visibleStart, visibleEnd).catch((e) => setMsg(e?.message || "Error loading calendar"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fcEvents: FCEvent[] = useMemo(() => {
    if (!rangeData) return [];

    const bills: FCEvent[] = rangeData.bills.map((b) => ({
      id: `bill:${b.id}`,
      title: `Bill: ${b.name}`,
      start: b.due_date,
      allDay: true,
      backgroundColor: "#fee2e2",
      borderColor: "#fecaca",
      textColor: "#991b1b",
      extendedProps: {
        kind: "bill",
        billMode: b.mode,
        dueDate: b.due_date,
      },
    }));

    const family: FCEvent[] = rangeData.events.map((e) => ({
      id: `cal:${e.id}`,
      title: e.title,
      start: e.start_at,
      end: e.end_at || undefined,
      allDay: false,
      backgroundColor: "#dbeafe",
      borderColor: "#bfdbfe",
      textColor: "#1e3a8a",
      extendedProps: {
        kind: "family",
        location: e.location,
      },
    }));

    return [...bills, ...family];
  }, [rangeData]);

  function openAddEventModal(clickedDate: Date, hasTime: boolean) {
    setMsg(null);

    const d = new Date(clickedDate);
    if (!hasTime) d.setHours(9, 0, 0, 0);

    const end = new Date(d.getTime() + 60 * 60 * 1000);

    setTitle("");
    setStartAt(toLocalDatetimeInputValue(d));
    setEndAt(toLocalDatetimeInputValue(end));
    setLocation("");
    setNotes("");
    setAddOpen(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!title.trim()) {
      setMsg("Enter a title.");
      return;
    }

    const startIso = new Date(startAt).toISOString();
    const endIso = endAt ? new Date(endAt).toISOString() : null;

    setBusy(true);
    try {
      await api("/api/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          startAt: startIso,
          endAt: endIso,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      setAddOpen(false);
      await refreshVisibleRange();
    } catch (err: any) {
      setMsg(err?.message || "Error saving event.");
    } finally {
      setBusy(false);
    }
  }

  function onEventClick(info: any) {
    // FullCalendar gives EventApi
    const ev = info.event;
    const rawId: string = ev.id || "";
    const kind: "bill" | "family" = rawId.startsWith("bill:") ? "bill" : "family";
    const id = rawId.includes(":") ? rawId.split(":")[1] : rawId;

    setSelected({
      kind,
      id,
      title: ev.title,
      start: ev.startStr,
      end: ev.endStr || undefined,
      location: ev.extendedProps?.location ?? null,
    });
    setViewOpen(true);
  }

  async function deleteSelected() {
    if (!selected) return;
    if (selected.kind !== "family") return;

    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/calendar/${selected.id}`, { method: "DELETE" });
      setViewOpen(false);
      setSelected(null);
      await refreshVisibleRange();
    } catch (err: any) {
      setMsg(err?.message || "Error deleting event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Calendar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Click a day (or a time slot in week view) to add an event. Click an event to view/delete.
        </p>
        {msg && <div className="mt-2 text-sm text-red-700">{msg}</div>}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek",
          }}
          height="auto"
          events={fcEvents}
          dateClick={(arg) => openAddEventModal(arg.date, !arg.allDay)}
          eventClick={onEventClick}
          datesSet={(arg) => {
            const start = ymd(arg.start);
            const end = ymd(arg.end);
            setVisibleStart(start);
            setVisibleEnd(end);
            loadRange(start, end).catch((e) => setMsg(e?.message || "Error loading calendar"));
          }}
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Legend</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Bills due
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Family scheduled
          </span>
        </div>
      </div>

      {/* Add Event Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setAddOpen(false)} />

          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Add event</div>
                <div className="mt-1 text-sm text-zinc-500">This will show in blue on the calendar.</div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => setAddOpen(false)}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveEvent} className="mt-4 grid gap-4">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-zinc-700">Title</span>
                <input
                  className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Soccer practice, dentist, trip planning..."
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700">Start</span>
                  <input
                    type="datetime-local"
                    className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700">End (optional)</span>
                  <input
                    type="datetime-local"
                    className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700">Location (optional)</span>
                  <input
                    className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="School, Greer, etc."
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700">Notes (optional)</span>
                  <input
                    className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-zinc-900/10 focus:ring-4"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything important…"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  disabled={busy}
                  className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  Save event
                </button>
                {busy && <div className="text-sm text-zinc-500">Saving…</div>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View/Delete Modal */}
      {viewOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setViewOpen(false)} />

          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  {selected.kind === "bill" ? "Bill reminder" : "Family event"}
                </div>
                <div className="mt-1 text-sm text-zinc-500">Click delete to remove (family events only).</div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => setViewOpen(false)}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-lg font-semibold text-zinc-900">{selected.title}</div>
              <div className="text-sm text-zinc-600">
                Start: {selected.kind === "bill" ? selected.start : prettyDT(selected.start)}
              </div>
              {selected.end && selected.kind === "family" && (
                <div className="text-sm text-zinc-600">End: {prettyDT(selected.end)}</div>
              )}
              {selected.kind === "family" && selected.location && (
                <div className="text-sm text-zinc-600">Location: {selected.location}</div>
              )}

              {selected.kind === "bill" && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  Bills are generated from your Bills page. To change this, edit the bill (not the calendar).
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              {selected.kind === "family" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={deleteSelected}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setViewOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
