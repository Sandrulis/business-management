"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { useInvoices } from "@/app/components/invoice-state";
import { RightDrawer } from "@/app/components/right-drawer";
import type { EmployeeOption } from "@/app/lib/catalog/types";
import { loadEmployeeOptions } from "@/app/lib/catalog/repository";
import type { Site } from "@/app/lib/invoices/model";
import { formatClock, formatDuration, formatStamp, workedSeconds, type WorkSession } from "@/app/lib/work-sessions/model";
import { endWorkSession, loadOpenSessions, pauseWorkSession, resumeWorkSession, startWorkSession } from "@/app/lib/work-sessions/repository";
import { Check, Pause, Play, Plus, Square, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export function OnShiftView() {
  const { sites, notify } = useInvoices();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState<WorkSession | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [people, open] = await Promise.all([loadEmployeeOptions(), loadOpenSessions()]);
    if (people.ok) setEmployees(people.employees);
    if (!open.ok) {
      notify(open.message, "error");
      return;
    }
    setSessions(open.sessions);
  }

  async function stop(session: WorkSession) {
    if (pending) return;
    setPending(true);
    const result = await endWorkSession(session.id);
    setPending(false);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    setSessions((current) => current.filter((item) => item.id !== session.id));
    setEnding(null);
    notify("Darbs pabeigts.", "ok");
  }

  async function togglePause(session: WorkSession) {
    if (pending) return;
    setPending(true);
    const result = session.pausedAt ? await resumeWorkSession(session.id) : await pauseWorkSession(session.id);
    setPending(false);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    setSessions((current) => current.map((item) => (item.id === result.session.id ? result.session : item)));
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Šobrīd darbā</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Kurš darbinieks ir objektā, cikos sāka un cik ilgi jau strādā.</p>
        </div>
        <button type="button" onClick={() => setStarting(true)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34]">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Sākt darbu
        </button>
      </div>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {sessions.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Šobrīd neviens nestrādā.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#f7fbf8] text-xs uppercase tracking-wide text-[#5f756a]">
                <tr>
                  <th className="px-4 py-3 font-medium">Vārds</th>
                  <th className="px-4 py-3 font-medium">Laiks</th>
                  <th className="px-4 py-3 text-right font-medium">Darbības</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const paused = session.pausedAt != null;
                  return (
                    <tr key={session.id} className="border-t border-[#e4efe8]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{session.employeeName}</p>
                        <p className="mt-0.5 text-sm text-[#5f756a]">{session.placeAddress || session.placeName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${paused ? "text-[#8aa396]" : "text-[#143028]"}`}>
                          {formatDuration(workedSeconds(session, now))}
                        </p>
                        <p className="mt-0.5 text-sm text-[#5f756a]">{paused ? "Pauzē · " : ""}Sāka {startedLabel(session.startedAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void togglePause(session)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#1e3a2f] hover:bg-[#e7f3ec] disabled:text-[#8aa396]"
                          >
                            {paused ? <Play className="size-4 shrink-0" aria-hidden="true" /> : <Pause className="size-4 shrink-0" aria-hidden="true" />}
                            {paused ? "Turpināt" : "Pauze"}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setEnding(session)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#b42318] hover:bg-[#fdeceb] disabled:text-[#8aa396]"
                          >
                            <Square className="size-4 shrink-0" aria-hidden="true" />
                            Beigt
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {starting ? (
        <StartShiftDrawer
          employees={employees.filter((employee) => !sessions.some((session) => session.employeeId === employee.id))}
          sites={sites}
          pending={pending}
          onClose={() => {
            if (!pending) setStarting(false);
          }}
          onStart={async (input) => {
            setPending(true);
            const result = await startWorkSession(input);
            setPending(false);
            if (!result.ok) {
              notify(result.message, "error");
              return false;
            }
            setSessions((current) => [...current, result.session].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)));
            setStarting(false);
            notify("Darbs sākts.", "ok");
            return true;
          }}
        />
      ) : null}
      {ending ? (
        <ConfirmModal
          title="Beigt darbu?"
          text={`${ending.employeeName} darba laiks tiks noslēgts.`}
          confirmLabel="Beigt"
          pending={pending}
          onCancel={() => {
            if (!pending) setEnding(null);
          }}
          onConfirm={() => void stop(ending)}
        />
      ) : null}
    </div>
  );
}

function StartShiftDrawer({
  employees,
  sites,
  pending,
  onClose,
  onStart,
}: {
  employees: EmployeeOption[];
  sites: Site[];
  pending: boolean;
  onClose: () => void;
  onStart: (input: { employeeId: string; employeeName: string; siteId: string; placeName: string; placeAddress: string }) => Promise<boolean>;
}) {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [siteId, setSiteId] = useState("");
  const ready = employeeId !== "" && siteId !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending) return false;
    const employee = employees.find((item) => item.id === employeeId);
    const site = sites.find((item) => item.id === siteId);
    if (!employee || !site) return false;
    const ok = await onStart({
      employeeId: employee.id,
      employeeName: employee.name,
      siteId: site.id,
      placeName: site.customer,
      placeAddress: site.address,
    });
    if (!ok) return false;
  }

  const employeeHints = hintsFor(employeeQuery, employees.map((employee) => ({ id: employee.id, title: employee.name, detail: "" })));
  const placeHints = hintsFor(placeQuery, sites.map((site) => ({ id: site.id, title: site.customer, detail: site.address })));

  return (
    <RightDrawer
      title="Sākt darbu"
      hint=""
      onClose={onClose}
      onSubmit={submit}
      footer={(dismiss) => (
        <>
          <button type="button" onClick={dismiss} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f] disabled:text-[#5f756a]">
            <X className="size-4 shrink-0" aria-hidden="true" />
            Atcelt
          </button>
          <button type="submit" disabled={!ready || pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            Sākt
          </button>
        </>
      )}
    >
      <HintField
        label="Darbinieks"
        value={employeeQuery}
        placeholder="Vārds uzvārds"
        hints={employeeHints}
        empty={employees.length === 0 ? "Darbinieku vēl nav." : ""}
        onChange={(value) => {
          setEmployeeQuery(value);
          const exact = employees.find((employee) => employee.name.toLowerCase() === value.trim().toLowerCase());
          setEmployeeId(exact?.id ?? "");
        }}
        onPick={(hint) => {
          setEmployeeQuery(hint.title);
          setEmployeeId(hint.id);
        }}
      />
      <HintField
        label="Vieta"
        value={placeQuery}
        placeholder="Klients vai adrese"
        hints={placeHints}
        empty={sites.length === 0 ? "Klientu vēl nav." : ""}
        onChange={(value) => {
          setPlaceQuery(value);
          const exact = sites.find((site) => site.customer.toLowerCase() === value.trim().toLowerCase());
          setSiteId(exact?.id ?? "");
        }}
        onPick={(hint) => {
          setPlaceQuery(hint.title);
          setSiteId(hint.id);
        }}
      />
    </RightDrawer>
  );
}

function HintField({
  label,
  value,
  placeholder,
  hints,
  empty,
  onChange,
  onPick,
}: {
  label: string;
  value: string;
  placeholder: string;
  hints: Hint[];
  empty: string;
  onChange: (value: string) => void;
  onPick: (hint: Hint) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <label className="relative block text-sm font-medium">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className={fieldClass}
      />
      {empty ? <span className="mt-1 block text-xs font-normal text-[#5f756a]">{empty}</span> : null}
      {open && hints.length > 0 ? (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-[#d3e4da] bg-white py-1 shadow-lg">
          {hints.map((hint) => (
            <li key={hint.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(hint);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-[#f4faf6]"
              >
                <span className="block font-medium">{hint.title}</span>
                {hint.detail ? <span className="block text-sm font-normal text-[#5f756a]">{hint.detail}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

type Hint = { id: string; title: string; detail: string };

function hintsFor(query: string, options: Hint[]) {
  const needle = query.trim().toLocaleLowerCase("lv");
  if (!needle) return [];
  return options
    .filter((option) => `${option.title} ${option.detail}`.toLocaleLowerCase("lv").includes(needle))
    .sort((a, b) => a.title.localeCompare(b.title, "lv"))
    .slice(0, 8);
}

function startedLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  return sameDay ? formatClock(iso) : formatStamp(iso);
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
