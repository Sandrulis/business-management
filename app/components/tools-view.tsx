"use client";

import { CenterDialog } from "@/app/components/stock-modals";
import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { useEmployeeNames } from "@/app/components/employees-view";
import { useInvoices } from "@/app/components/invoice-state";
import { RightDrawer } from "@/app/components/right-drawer";
import { Tooltip } from "@/app/components/tooltip";
import { createLiveList } from "@/app/lib/catalog/live-list";
import { assignInstrument, deleteInstrumentRecord, returnInstrument, saveInstrumentRecord } from "@/app/lib/catalog/repository";
import type { EmployeeOption, Instrument } from "@/app/lib/catalog/types";
import { formatDate, formatMoney, todayIso } from "@/app/lib/invoices/model";
import { Info, Pencil, Trash2, Undo2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

const instrumentsLive = createLiveList<Instrument>();

const emptyTool = () => ({
  number: "",
  brand: "",
  model: "",
  serialNumber: "",
  purchasedOn: "",
  price: "",
  note: "",
});

export function ToolsView({
  initialItems,
  employees,
  available,
}: {
  initialItems: Instrument[];
  employees: EmployeeOption[];
  available: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = useInvoices();
  const creating = pathname === "/tools/new";
  const [rows, publish] = instrumentsLive.useLiveList(initialItems, available);
  const employeeOptions = useEmployeeNames(employees);
  const [draft, setDraft] = useState(emptyTool);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Instrument | null>(null);
  const [assigning, setAssigning] = useState<Instrument | null>(null);
  const [history, setHistory] = useState<Instrument | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const editing = rows.find((row) => row.id === editingId) ?? null;
  const complete = isComplete(draft);

  useEffect(() => {
    if (!available) notify("Datubāze nav pieejama.", "error");
  }, [available, notify]);

  function close() {
    const wasEditing = editingId !== null;
    setEditingId(null);
    setDraft(emptyTool());
    if (!wasEditing) router.push("/tools");
  }

  function beginEdit(tool: Instrument) {
    setEditingId(tool.id);
    setDraft({
      number: tool.number,
      brand: tool.brand,
      model: tool.model,
      serialNumber: tool.serialNumber,
      purchasedOn: tool.purchasedOn,
      price: amountInput(tool.price),
      note: tool.note,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const saved = await saveInstrumentRecord(
      {
        number: draft.number,
        brand: draft.brand,
        model: draft.model,
        serialNumber: draft.serialNumber,
        purchasedOn: draft.purchasedOn,
        price: draft.price.trim() ? parseAmount(draft.price) : null,
        note: draft.note,
      },
      editing?.id,
    );
    savingRef.current = false;
    setSaving(false);
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    const nextItem: Instrument = editing ? { ...saved.item, assignments: editing.assignments } : saved.item;
    publish(editing ? rows.map((row) => (row.id === editing.id ? nextItem : row)) : [nextItem, ...rows]);
    notify(editing ? "Instruments saglabāts." : "Instruments pievienots.", "ok");
    if (!editing) setDraft(emptyTool());
  }

  async function remove(tool: Instrument) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const removed = await deleteInstrumentRecord(tool.id);
    savingRef.current = false;
    setSaving(false);
    if (!removed.ok) {
      notify(removed.message, "error");
      return;
    }
    publish(rows.filter((row) => row.id !== tool.id));
    setDeleting(null);
    notify("Instruments dzēsts.", "ok");
  }

  async function assign(tool: Instrument, employeeId: string) {
    const employee = employeeOptions.find((item) => item.id === employeeId);
    if (!employee) return false;
    if (currentHolder(tool)?.employeeId === employee.id) return "same" as const;
    const saved = await assignInstrument(tool.id, employee, todayIso(new Date()));
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    const nextItem = { ...tool, assignments: [saved.assignment, ...tool.assignments] };
    publish(rows.map((row) => (row.id === tool.id ? nextItem : row)));
    setAssigning(nextItem);
    setHistory((current) => (current?.id === tool.id ? nextItem : current));
    notify("Instruments piesaistīts.", "ok");
    return true;
  }

  async function handBack(tool: Instrument) {
    const holder = currentHolder(tool);
    if (!holder || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const saved = await returnInstrument(tool.id, holder, todayIso(new Date()));
    savingRef.current = false;
    setSaving(false);
    if (!saved.ok) {
      notify(saved.message, "error");
      return;
    }
    const nextItem = { ...tool, assignments: [saved.assignment, ...tool.assignments] };
    publish(rows.map((row) => (row.id === tool.id ? nextItem : row)));
    setHistory((current) => (current?.id === tool.id ? nextItem : current));
    notify("Instruments nodots noliktavā.", "ok");
  }

  function setField<K extends keyof ReturnType<typeof emptyTool>>(key: K, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Instrumenti</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Instrumentu numurs, marka, modelis un iegāde.</p>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Instrumentu vēl nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {rows.map((row) => {
              const holder = currentHolder(row);
              const inWarehouse = row.assignments[0]?.kind === "returned";
              const title = instrumentTitle(row);
              const identity = [row.number, row.serialNumber].filter(Boolean).join(", ");
              const purchase = [row.purchasedOn ? formatDate(row.purchasedOn) : "", row.price == null ? "" : formatMoney(row.price)].filter(Boolean).join(", ");
              return (
                <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{title}</p>
                    {identity ? <p className="mt-1 text-sm text-[#5f756a]">{identity}</p> : null}
                    {purchase ? (
                      <p className="mt-1 text-sm text-[#5f756a]">
                        {row.purchasedOn ? formatDate(row.purchasedOn) : null}
                        {row.purchasedOn && row.price != null ? ", " : null}
                        {row.price == null ? null : <span className="tabular-nums">{formatMoney(row.price)}</span>}
                      </p>
                    ) : null}
                    {row.note ? <p className="mt-1 text-sm text-[#5f756a]">{row.note}</p> : null}
                    {holder ? (
                      <p className="mt-1 text-sm text-[#5f756a]">
                        Piesaistīts {holder.employeeName}, {formatDate(holder.assignedOn)}
                      </p>
                    ) : inWarehouse ? (
                      <p className="mt-1 text-sm text-[#5f756a]">Noliktavā</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip text="Vēsture">
                      <button type="button" onClick={() => setHistory(row)} className={iconButton} aria-label="Vēsture">
                        <Info className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Labot">
                      <button type="button" onClick={() => beginEdit(row)} className={iconButton} aria-label="Labot">
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Dzēst">
                      <button type="button" onClick={() => setDeleting(row)} className={`${iconButton} text-[#b42318] hover:bg-[#fdeceb]`} aria-label="Dzēst">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Piesaistīt">
                      <button type="button" onClick={() => setAssigning(row)} className={iconButton} aria-label="Piesaistīt">
                        <UserPlus className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    {holder ? (
                      <Tooltip text="Nodots">
                        <button type="button" onClick={() => void handBack(row)} className={iconButton} aria-label="Nodots">
                          <Undo2 className="size-4" aria-hidden="true" />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {creating || editing ? (
        <RightDrawer
          title={editing ? "Labot instrumentu" : "Pievienot instrumentu"}
          hint=""
          onClose={close}
          onSubmit={submit}
          footer={(dismiss) => (
            <>
              <button type="button" onClick={dismiss} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
                Atcelt
              </button>
              <button
                type="submit"
                disabled={!complete || saving}
                className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
              >
                {editing ? "Saglabāt" : "Pievienot"}
              </button>
            </>
          )}
        >
          <Field label="Numurs" value={draft.number} placeholder="INV-001" onChange={(value) => setField("number", value)} />
          <Field label="Marka" value={draft.brand} placeholder="Piemēram, Bosch" onChange={(value) => setField("brand", value)} />
          <Field label="Modelis" value={draft.model} placeholder="Piemēram, GSB 18V" onChange={(value) => setField("model", value)} />
          <Field label="Serijas numurs" value={draft.serialNumber} placeholder="SN-000000" onChange={(value) => setField("serialNumber", value)} />
          <label className="block text-sm font-medium">
            Iegādes datums
            <DateField value={draft.purchasedOn} onChange={(value) => setField("purchasedOn", value)} />
          </label>
          <Field label="Iegādes summa" value={draft.price} placeholder="0,00" inputMode="decimal" onChange={(value) => setField("price", value)} />
          <label className="block text-sm font-medium">
            Piezīme
            <textarea
              value={draft.note}
              onChange={(event) => setField("note", event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 py-2 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15"
              placeholder="Īsa piezīme"
            />
          </label>
        </RightDrawer>
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Dzēst instrumentu?"
          text={`Dzēst „${instrumentTitle(deleting)}”?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      ) : null}
      {history ? <HistoryModal tool={history} onClose={() => setHistory(null)} /> : null}
      {assigning ? (
        <AssignModal
          tool={assigning}
          employees={employeeOptions}
          onClose={() => setAssigning(null)}
          onAssign={(employeeId) => assign(assigning, employeeId)}
        />
      ) : null}
    </div>
  );
}

function HistoryModal({ tool, onClose }: { tool: Instrument; onClose: () => void }) {
  const now = Date.now();
  const groups = historyGroups(tool.assignments, now);
  return (
    <CenterDialog title="Vēsture" onClose={onClose}>
      {groups.length === 0 ? (
        <p className="text-sm text-[#5f756a]">Šim instrumentam vēl nav darbību.</p>
      ) : (
        <div>
          {groups.map((group) => (
            <section key={group.label} className="mb-5 last:mb-0">
              <h3 className="mb-3 text-[11px] font-semibold tracking-wide text-[#5f756a] uppercase">{group.label}</h3>
              <ol>
                {group.items.map((entry) => (
                  <li key={entry.id} className="group relative pb-5 pl-5 last:pb-0">
                    <span className="absolute top-3 bottom-0 left-[4px] w-px bg-[#d3e4da] group-last:hidden" aria-hidden="true" />
                    <span className="absolute top-1 left-0 size-2.5 rounded-full ring-4 ring-white" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    <p className="text-[11px] font-semibold" style={{ color: entry.color }}>
                      {entry.label}
                    </p>
                    <p className="text-sm text-[#5f756a]">{entry.detail}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[#5f756a]">
                      {formatClock(entry.at)} · {formatRelative(entry.at, now)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
          Aizvērt
        </button>
      </div>
    </CenterDialog>
  );
}

function AssignModal({
  tool,
  employees,
  onClose,
  onAssign,
}: {
  tool: Instrument;
  employees: EmployeeOption[];
  onClose: () => void;
  onAssign: (employeeId: string) => Promise<boolean | "same">;
}) {
  const [query, setQuery] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const holder = currentHolder(tool);
  const hints = query.trim()
    ? employees.filter((employee) => matchesEmployee(query, employee)).sort((a, b) => a.name.localeCompare(b.name, "lv"))
    : [];

  function changeQuery(value: string) {
    setQuery(value);
    setError("");
    const exact = employees.find((employee) => employee.name.toLowerCase() === value.trim().toLowerCase());
    setEmployeeId(exact?.id ?? "");
    setOpen(value.trim() !== "");
  }

  function pick(employee: EmployeeOption) {
    setQuery(employee.name);
    setEmployeeId(employee.id);
    setError("");
    setOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!employeeId) return;
    const result = await onAssign(employeeId);
    if (result === "same") {
      setError("Instruments jau ir piesaistīts šim darbiniekam.");
      return;
    }
    if (result) onClose();
  }

  return (
    <CenterDialog title="Piesaistīt" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="text-sm text-[#5f756a]">
          {holder ? `Šobrīd piesaistīts ${holder.employeeName}.` : "Instruments ir noliktavā."}
        </p>
        {employees.length === 0 ? (
          <p className="mt-4 text-sm text-[#5f756a]">Darbinieku vēl nav.</p>
        ) : (
          <label className="mt-4 block text-sm font-medium">
            Darbinieks
            <input
              value={query}
              autoComplete="off"
              spellCheck={false}
              placeholder="Sāc rakstīt vārdu"
              onChange={(event) => changeQuery(event.target.value)}
              onFocus={() => setOpen(query.trim() !== "")}
              className={fieldClass}
            />
            {open ? (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#d3e4da] bg-white py-1 shadow-lg">
                {hints.length === 0 ? (
                  <li className="px-3 py-2 text-sm font-normal text-[#5f756a]">Nekas neatbilst meklēšanai.</li>
                ) : (
                  hints.map((employee) => (
                    <li key={employee.id}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(employee)}
                        className="block w-full px-3 py-2 text-left hover:bg-[#e7f6ec]"
                      >
                        <span className="block text-sm font-semibold">{employee.name}</span>
                        {employee.email ? <span className="block truncate text-xs font-normal text-[#5f756a]">{employee.email}</span> : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </label>
        )}
        {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
            Atcelt
          </button>
          <button
            type="submit"
            disabled={!employeeId}
            className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            Piesaistīt
          </button>
        </div>
      </form>
    </CenterDialog>
  );
}

function historyGroups(assignments: Instrument["assignments"], now: number) {
  const chronological = [...assignments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const items = chronological
    .map((entry, index) => {
      const previous = chronological[index - 1];
      const moved = entry.kind === "assigned" && previous?.kind === "assigned" && previous.employeeName !== entry.employeeName;
      const parsed = Date.parse(entry.createdAt);
      const returned = entry.kind === "returned";
      return {
        id: entry.id,
        at: Number.isNaN(parsed) ? Date.parse(`${entry.assignedOn}T12:00:00`) : parsed,
        label: returned ? "Nodots" : moved ? "Pārcelts" : "Piešķirts",
        color: returned ? "#6f6a62" : moved ? "#1e4d7b" : "#1a6b4a",
        detail: returned ? entry.employeeName : moved ? `${previous?.employeeName} → ${entry.employeeName}` : entry.employeeName,
      };
    })
    .reverse();
  const groups: { label: string; items: typeof items }[] = [];
  for (const item of items) {
    const label = dayLabel(item.at, now);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [item] });
    else last.items.push(item);
  }
  return groups;
}

function dayLabel(timestamp: number, now: number) {
  const date = new Date(timestamp);
  const current = new Date(now);
  if (sameDay(date, current)) return "Šodien";
  const yesterday = new Date(current);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(date, yesterday)) return "Vakar";
  return formatDate(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
}

function formatClock(timestamp: number) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelative(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return "tikko";
  if (minutes < 60) return `pirms ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `pirms ${hours} st.`;
  const days = Math.round(hours / 24);
  if (days === 1) return "vakar";
  return `pirms ${days} d.`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function currentHolder(tool: Instrument) {
  const latest = tool.assignments[0];
  if (!latest || latest.kind !== "assigned") return null;
  return latest;
}

function matchesEmployee(query: string, employee: EmployeeOption) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${employee.name} ${employee.email}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  inputMode?: "decimal";
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className={fieldClass} placeholder={placeholder} />
    </label>
  );
}

function parseAmount(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function amountInput(value: number | null) {
  if (value == null) return "";
  return formatMoney(value).replace(" €", "");
}

function instrumentTitle(tool: Pick<Instrument, "brand" | "model" | "number" | "serialNumber">) {
  return [tool.brand, tool.model].filter(Boolean).join(" ") || tool.number || tool.serialNumber || "Instruments";
}

function isComplete(draft: ReturnType<typeof emptyTool>) {
  const filled = [draft.number, draft.brand, draft.model, draft.serialNumber, draft.purchasedOn, draft.price, draft.note].some((value) => value.trim() !== "");
  if (!filled) return false;
  if (!draft.price.trim()) return true;
  const price = parseAmount(draft.price);
  return Number.isFinite(price) && price >= 0;
}

const iconButton = "grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
