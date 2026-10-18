"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { useInvoices } from "@/app/components/invoice-state";
import { RightDrawer } from "@/app/components/right-drawer";
import { Tooltip } from "@/app/components/tooltip";
import { loadEmployeeOptions } from "@/app/lib/catalog/repository";
import { formatDate, todayIso, type Site } from "@/app/lib/invoices/model";
import { formatClock, formatStamp, overlapSeconds, type WorkSession } from "@/app/lib/work-sessions/model";
import { deleteWorkSession, loadSessionsBetween, updateWorkSession } from "@/app/lib/work-sessions/repository";
import { Check, MapPin, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

const WEEKDAYS = ["Sv", "Pr", "Ot", "Tr", "Ce", "Pk", "Se"];

export function TimesheetView() {
  const { notify, sites } = useInvoices();
  const today = todayIso(new Date());
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [detail, setDetail] = useState<{ id: string; name: string; day: string } | null>(null);
  const invalid = from !== "" && to !== "" && from > to;
  const days = invalid ? [] : eachDay(from, to);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    loadEmployeeOptions().then((result) => {
      if (active && result.ok) setPeople(result.employees.map((employee) => ({ id: employee.id, name: employee.name })));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (from === "" || to === "" || from > to) return;
    let active = true;
    loadSessionsBetween(from, to).then((result) => {
      if (!active) return;
      if (!result.ok) {
        notify(result.message, "error");
        return;
      }
      setSessions(result.sessions);
    });
    return () => {
      active = false;
    };
  }, [from, to, notify]);

  const rows = roster(people, sessions);
  const grid = rows.map((row) => ({
    ...row,
    days: days.map((day) => ({
      seconds: daySeconds(sessions, row.id, day, now),
      open: dayIsOpen(sessions, row.id, day, now),
    })),
  }));
  const dayTotals = days.map((_, index) => grid.reduce((sum, row) => sum + row.days[index].seconds, 0));
  const dayOpen = days.map((_, index) => grid.some((row) => row.days[index].open));

  return (
    <div className="animate-slide-up">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Darba laika atskaite</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Katras dienas nostrādātās stundas izvēlētajā periodā.</p>
      </div>
      <div className="mt-6 grid gap-4 sm:max-w-xl sm:grid-cols-2">
        <label className="block text-sm font-medium">
          No
          <DateField value={from} onChange={setFrom} />
        </label>
        <label className="block text-sm font-medium">
          Līdz
          <DateField value={to} onChange={setTo} />
        </label>
      </div>
      {invalid ? <p className="mt-3 text-sm text-[#b42318]">Sākuma datums ir vēlāk par beigu datumu.</p> : null}
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        <div className="border-b border-[#d3e4da] px-5 py-4">
          <h2 className="text-center text-lg font-semibold">Darba laika uzskaites tabula</h2>
          <p className="mt-1 text-center text-sm text-[#5f756a]">{invalid || days.length === 0 ? "Izvēlies periodu." : `${formatDate(days[0])} - ${formatDate(days[days.length - 1])}`}</p>
        </div>
        {invalid || days.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Izvēlies derīgu periodu.</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Darbinieku vēl nav.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#f4faf6] text-[#5f756a]">
                  <th className="sticky left-0 z-10 min-w-44 bg-[#f4faf6] px-3 py-2 text-left font-medium">Darbinieks</th>
                  {days.map((day) => {
                    const weekend = isWeekend(day);
                    return (
                      <th key={day} className={`w-10 min-w-10 px-1 py-2 text-center font-medium ${weekend ? "bg-[#e7f0ea]" : ""}`}>
                        <span className="block">{WEEKDAYS[weekday(day)]}</span>
                        <span className="block tabular-nums text-[#143028]">{day.slice(8)}</span>
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-10 min-w-16 bg-[#f4faf6] px-2 py-2 text-right font-medium">Kopā</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => {
                  const total = row.days.reduce((sum, value) => sum + value.seconds, 0);
                  return (
                    <tr key={row.id} className="border-t border-[#e4efe8]">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{row.name}</td>
                      {row.days.map((cell, index) => {
                        const day = days[index];
                        const weekend = isWeekend(day);
                        const label = formatHours(cell.seconds) || (cell.open ? "0" : "");
                        return (
                          <td key={day} className={`p-0 text-center ${cell.open ? "bg-[#fde8e6]" : weekend ? "bg-[#f7fbf8]" : ""}`}>
                            {cell.seconds > 0 || cell.open ? (
                              <button
                                type="button"
                                onClick={() => setDetail({ id: row.id, name: row.name, day })}
                                className={`h-full w-full px-1 py-2 tabular-nums ${cell.open ? "font-semibold text-[#7f1d1d]" : "font-medium text-[#143028] hover:bg-[#e7f3ec]"}`}
                              >
                                {label}
                              </button>
                            ) : (
                              <span className="block px-1 py-2 text-[#c5d8cc]" />
                            )}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 bg-white px-2 py-2 text-right font-semibold tabular-nums">{formatHours(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#d3e4da] bg-[#f4faf6] font-semibold">
                  <td className="sticky left-0 z-10 bg-[#f4faf6] px-3 py-2">Kopā</td>
                  {dayTotals.map((seconds, index) => (
                    <td key={days[index]} className={`px-1 py-2 text-center tabular-nums ${dayOpen[index] ? "bg-[#fde8e6] text-[#7f1d1d]" : isWeekend(days[index]) ? "bg-[#e7f0ea]" : ""}`}>
                      {formatHours(seconds)}
                    </td>
                  ))}
                  <td className="sticky right-0 z-10 bg-[#f4faf6] px-2 py-2 text-right tabular-nums">{formatHours(dayTotals.reduce((sum, value) => sum + value, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
      {detail ? (
        <DayDetail
          name={detail.name}
          day={detail.day}
          sites={sites}
          sessions={sessions.filter((session) => session.employeeId === detail.id && overlapSeconds(session, detail.day, detail.day, now) > 0)}
          now={now}
          onClose={() => setDetail(null)}
          onSaved={(session) => setSessions((current) => current.map((item) => (item.id === session.id ? session : item)))}
          onDeleted={(id) => setSessions((current) => current.filter((item) => item.id !== id))}
          notify={notify}
        />
      ) : null}
    </div>
  );
}

function DayDetail({
  name,
  day,
  sites,
  sessions,
  now,
  onClose,
  onSaved,
  onDeleted,
  notify,
}: {
  name: string;
  day: string;
  sites: Site[];
  sessions: WorkSession[];
  now: number;
  onClose: () => void;
  onSaved: (session: WorkSession) => void;
  onDeleted: (id: string) => void;
  notify: (text: string, tone?: "ok" | "error" | "info") => void;
}) {
  const rows = [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const [editing, setEditing] = useState<WorkSession | null>(null);
  const [removing, setRemoving] = useState<WorkSession | null>(null);
  const [pending, setPending] = useState(false);

  async function remove(session: WorkSession) {
    if (pending) return;
    setPending(true);
    const result = await deleteWorkSession(session.id);
    setPending(false);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    onDeleted(session.id);
    setRemoving(null);
    setEditing((current) => (current?.id === session.id ? null : current));
    notify("Ieraksts dzēsts.", "ok");
  }

  return (
    <>
      <RightDrawer
        title={name}
        hint={formatDate(day)}
        onClose={onClose}
        footer={(close) => (
          <button type="button" onClick={close} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
            <X className="size-4 shrink-0" aria-hidden="true" />
            Aizvērt
          </button>
        )}
      >
        {rows.length === 0 ? (
          <p className="text-sm text-[#5f756a]">Šajā dienā darba ierakstu nav.</p>
        ) : (
          <ol className="space-y-3">
            {rows.map((session) => {
              const open = session.endedAt == null && session.pausedAt == null;
              return (
                <li key={session.id} className={`flex items-start gap-2 rounded-2xl border px-3 py-3 ${open ? "border-[#f3c7c3] bg-[#fde8e6]" : "border-[#d3e4da]"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-start gap-2 font-medium">
                      <MapPin className={`mt-0.5 size-4 shrink-0 ${open ? "text-[#7f1d1d]" : "text-[#1a6b4a]"}`} aria-hidden="true" />
                      <span>
                        <span className="block">{session.placeAddress || session.placeName}</span>
                      </span>
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-[#5f756a]">Sākums</dt>
                        <dd className="font-medium tabular-nums">{sameDay(session.startedAt, day) ? formatClock(session.startedAt) : formatStamp(session.startedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-[#5f756a]">Beigas</dt>
                        <dd className={`font-medium tabular-nums ${open ? "text-[#7f1d1d]" : ""}`}>
                          {session.pausedAt ? "Pauzē" : open ? "Turpinās" : sameDay(session.endedAt ?? "", day) ? formatClock(session.endedAt ?? "") : formatStamp(session.endedAt ?? "")}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-sm text-[#5f756a]">Šajā dienā {formatHours(overlapSeconds(session, day, day, now)) || "0"} st.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip text="Labot">
                      <button type="button" onClick={() => setEditing(session)} className={iconButton} aria-label="Labot">
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Dzēst">
                      <button type="button" onClick={() => setRemoving(session)} className={`${iconButton} text-[#b42318] hover:bg-[#fdeceb]`} aria-label="Dzēst">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </RightDrawer>
      {editing ? (
        <SessionEditor
          session={editing}
          sites={sites}
          onClose={() => setEditing(null)}
          onSaved={(session) => {
            onSaved(session);
            notify("Ieraksts saglabāts.", "ok");
          }}
          onDelete={() => setRemoving(editing)}
          notify={notify}
        />
      ) : null}
      {removing ? (
        <ConfirmModal
          title="Dzēst ierakstu?"
          text="Šis darba laika ieraksts tiks noņemts no atskaites."
          confirmLabel="Dzēst"
          pending={pending}
          onCancel={() => {
            if (!pending) setRemoving(null);
          }}
          onConfirm={() => void remove(removing)}
        />
      ) : null}
    </>
  );
}

function SessionEditor({
  session,
  sites,
  onClose,
  onSaved,
  onDelete,
  notify,
}: {
  session: WorkSession;
  sites: Site[];
  onClose: () => void;
  onSaved: (session: WorkSession) => void;
  onDelete: () => void;
  notify: (text: string, tone?: "ok" | "error" | "info") => void;
}) {
  const initialStart = splitStamp(session.startedAt);
  const initialEnd = splitStamp(session.endedAt);
  const initialSite = session.siteId ?? "";
  const [siteId, setSiteId] = useState(initialSite);
  const [placeQuery, setPlaceQuery] = useState(sites.find((site) => site.id === session.siteId)?.address || session.placeAddress);
  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [pending, setPending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const dismissRef = useRef<() => void>(() => {});
  const endPartial = (endDate === "") !== (endTime === "");
  const startedAt = combineStamp(startDate, startTime);
  const endedAt = endDate === "" && endTime === "" ? null : combineStamp(endDate, endTime);
  const endBeforeStart = startedAt != null && endedAt != null && Date.parse(endedAt) < Date.parse(startedAt);
  const dirty = siteId !== initialSite || startDate !== initialStart.date || startTime !== initialStart.time || endDate !== initialEnd.date || endTime !== initialEnd.time;
  const ready = dirty && siteId !== "" && startedAt != null && !endPartial && !endBeforeStart && !pending;

  function blockClose() {
    if (pending || confirmClose) return false;
    if (dirty) {
      setConfirmClose(true);
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || startedAt == null) return false;
    const site = sites.find((item) => item.id === siteId);
    if (!site) return false;
    setPending(true);
    const result = await updateWorkSession({
      id: session.id,
      siteId: site.id,
      placeName: site.customer,
      placeAddress: site.address,
      startedAt,
      endedAt,
    });
    setPending(false);
    if (!result.ok) {
      notify(result.message, "error");
      return false;
    }
    onSaved(result.session);
  }

  const hints = placeHints(placeQuery, sites);

  return (
    <>
      <RightDrawer
        title="Labot ierakstu"
        hint={session.employeeName}
        beside={440}
        onClose={onClose}
        beforeClose={blockClose}
        dismissRef={dismissRef}
        onSubmit={submit}
        footer={(close) => (
          <>
            <button type="button" onClick={close} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f] disabled:text-[#5f756a]">
              <X className="size-4 shrink-0" aria-hidden="true" />
              Atcelt
            </button>
            <button type="button" onClick={onDelete} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#b42318] hover:bg-[#fdeceb] disabled:text-[#8aa396]">
              <Trash2 className="size-4 shrink-0" aria-hidden="true" />
              Dzēst
            </button>
            <button type="submit" disabled={!ready} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              Saglabāt
            </button>
          </>
        )}
      >
        <PlaceField
          value={placeQuery}
          hints={hints}
          onChange={(value) => {
            setPlaceQuery(value);
            const exact = sites.find((site) => site.address.toLowerCase() === value.trim().toLowerCase());
            setSiteId(exact?.id ?? "");
          }}
          onPick={(site) => {
            setPlaceQuery(site.address);
            setSiteId(site.id);
          }}
        />
        <div>
          <p className="text-sm font-medium">Sākums</p>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <DateField value={startDate} onChange={setStartDate} className={fieldClass} />
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={fieldClass} />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Beigas</p>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <DateField value={endDate} onChange={setEndDate} className={fieldClass} />
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={fieldClass} />
          </div>
          <p className="mt-1 text-xs text-[#5f756a]">Atstāj tukšu, ja darbs vēl nav beidzies.</p>
          {endPartial || endBeforeStart ? <p className="mt-1 text-xs text-[#b42318]">Norādi pilnu beigu laiku pēc sākuma.</p> : null}
        </div>
      </RightDrawer>
      {confirmClose ? (
        <ConfirmModal
          title="Aizvērt bez saglabāšanas?"
          text="Nesaglabātās izmaiņas pazudīs."
          confirmLabel="Aizvērt"
          tone="primary"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            dismissRef.current();
          }}
        />
      ) : null}
    </>
  );
}

function PlaceField({
  value,
  hints,
  onChange,
  onPick,
}: {
  value: string;
  hints: Site[];
  onChange: (value: string) => void;
  onPick: (site: Site) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <label className="relative block text-sm font-medium">
      Objekts
      <input
        value={value}
        placeholder="Objekta adrese"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className={fieldClass}
      />
      {open && hints.length > 0 ? (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-[#d3e4da] bg-white py-1 shadow-lg">
          {hints.map((site) => (
            <li key={site.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(site);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-[#f4faf6]"
              >
                <span className="block font-medium">{site.address}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

function placeHints(query: string, sites: Site[]) {
  const needle = query.trim().toLocaleLowerCase("lv");
  const sorted = [...sites].filter((site) => site.address.trim() !== "").sort((a, b) => a.address.localeCompare(b.address, "lv"));
  if (!needle) return sorted.slice(0, 8);
  return sorted.filter((site) => site.address.toLocaleLowerCase("lv").includes(needle)).slice(0, 8);
}

function splitStamp(iso: string | null) {
  if (!iso) return { date: "", time: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function combineStamp(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-0";

const iconButton = "grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]";

function monthStart(iso: string) {
  return `${iso.slice(0, 8)}01`;
}

function eachDay(fromIso: string, toIso: string) {
  const start = parseIso(fromIso);
  const end = parseIso(toIso);
  if (!start || !end || start.getTime() > end.getTime()) return [];
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime() && days.length < 370) {
    days.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function parseIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekday(iso: string) {
  return parseIso(iso)?.getDay() ?? 0;
}

function isWeekend(iso: string) {
  const day = weekday(iso);
  return day === 0 || day === 6;
}

function roster(people: { id: string; name: string }[], sessions: WorkSession[]) {
  const names = new Map(people.map((person) => [person.id, person.name]));
  for (const session of sessions) {
    if (!names.has(session.employeeId)) names.set(session.employeeId, session.employeeName);
  }
  return [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "lv"));
}

function dayIsOpen(sessions: WorkSession[], employeeId: string, day: string, now: number) {
  return sessions.some((session) => session.employeeId === employeeId && session.endedAt == null && session.pausedAt == null && overlapSeconds(session, day, day, now) > 0);
}

function sameDay(iso: string, day: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return toIsoDate(date) === day;
}

function daySeconds(sessions: WorkSession[], employeeId: string, day: string, now: number) {
  return sessions.filter((session) => session.employeeId === employeeId).reduce((sum, session) => sum + overlapSeconds(session, day, day, now), 0);
}

function formatHours(seconds: number) {
  if (seconds <= 0) return "";
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
}
