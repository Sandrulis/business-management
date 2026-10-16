"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { useEmployeeNames } from "@/app/components/employees-view";
import { useInvoices } from "@/app/components/invoice-state";
import { RightDrawer } from "@/app/components/right-drawer";
import {
  CenterDialog,
  StockAddModal,
  StockBreakdownModal,
  addStockLine,
  stockTotal,
  takeStock,
} from "@/app/components/stock-modals";
import { Tooltip } from "@/app/components/tooltip";
import { createLiveList } from "@/app/lib/catalog/live-list";
import { deleteClothingAssignments, deleteClothingRecord, recordClothingAssignments, replaceClothingStocks, saveClothingRecord } from "@/app/lib/catalog/repository";
import type { ClothingAssignment, ClothingItem, EmployeeOption } from "@/app/lib/catalog/types";
import { formatDate, formatMoney, todayIso } from "@/app/lib/invoices/model";
import { History, Info, Pencil, Trash2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type AssignRow = { key: string; employeeId: string; name: string; size: string };
type AssignResult = "ok" | "stock" | "save";

const clothingLive = createLiveList<ClothingItem>();

const emptyClothing = () => ({
  name: "",
  value: "",
  months: "",
});

export function ClothingView({
  initialItems,
  employees,
  available,
}: {
  initialItems: ClothingItem[];
  employees: EmployeeOption[];
  available: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = useInvoices();
  const creating = pathname === "/clothing/new";
  const [rows, publish] = clothingLive.useLiveList(initialItems, available);
  const employeeOptions = useEmployeeNames(employees);
  const [draft, setDraft] = useState(emptyClothing);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClothingItem | null>(null);
  const [assigning, setAssigning] = useState<ClothingItem | null>(null);
  const [history, setHistory] = useState<ClothingItem | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const editing = rows.find((row) => row.id === editingId) ?? null;
  const adding = rows.find((row) => row.id === addingId) ?? null;
  const breakdown = rows.find((row) => row.id === breakdownId) ?? null;
  const drawerOpen = creating || editing !== null;
  const complete = isComplete(draft);

  useEffect(() => {
    if (!available) notify("Datubāze nav pieejama.", "error");
  }, [available, notify]);

  function close() {
    const wasEditing = editingId !== null;
    setEditingId(null);
    setDraft(emptyClothing());
    if (!wasEditing) router.push("/clothing");
  }

  function beginEdit(item: ClothingItem) {
    setEditingId(item.id);
    setDraft({ name: item.name, value: amountInput(item.value), months: String(item.months) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const saved = await saveClothingRecord(
      { name: draft.name, value: parseAmount(draft.value), months: Number(draft.months) },
      editing?.id,
    );
    savingRef.current = false;
    setSaving(false);
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    const nextItem: ClothingItem = editing ? { ...saved.item, stocks: editing.stocks, assignments: editing.assignments } : saved.item;
    publish(editing ? rows.map((row) => (row.id === editing.id ? nextItem : row)) : [nextItem, ...rows]);
    notify(editing ? "Apģērbs saglabāts." : "Apģērbs pievienots.", "ok");
    if (!editing) setDraft(emptyClothing());
  }

  async function remove(item: ClothingItem) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const removed = await deleteClothingRecord(item.id);
    savingRef.current = false;
    setSaving(false);
    if (!removed.ok) {
      notify(removed.message, "error");
      return;
    }
    publish(rows.filter((row) => row.id !== item.id));
    setDeleting(null);
    notify("Apģērbs dzēsts.", "ok");
  }

  async function addStock(lines: { size: string; quantity: number }[]) {
    if (!adding) return false;
    const stocks = lines.reduce((current, line) => addStockLine(current, line.size, line.quantity), adding.stocks);
    const saved = await replaceClothingStocks(adding.id, stocks);
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    publish(rows.map((row) => (row.id === adding.id ? { ...row, stocks } : row)));
    notify("Atlikums pievienots.", "ok");
  }

  async function assign(item: ClothingItem, chosen: { employeeId: string; size: string }[]): Promise<AssignResult> {
    const counts = new Map<string, number>();
    for (const row of chosen) counts.set(row.size, (counts.get(row.size) ?? 0) + 1);
    const stocks = takeStock(
      item.stocks,
      [...counts].map(([size, count]) => ({ size, count })),
    );
    if (!stocks) return "stock";
    const recorded = await recordClothingAssignments(
      item.id,
      chosen.map((row) => ({
        employeeId: row.employeeId,
        employeeName: employeeOptions.find((employee) => employee.id === row.employeeId)?.name ?? "",
        size: row.size,
      })),
      todayIso(new Date()),
    );
    if (!recorded.ok) {
      notify(recorded.message, "error");
      return "save";
    }
    const saved = await replaceClothingStocks(item.id, stocks);
    if (!saved.ok) {
      await deleteClothingAssignments(recorded.assignments.map((assignment) => assignment.id));
      notify(saved.message, "error");
      return "save";
    }
    const nextItem = { ...item, stocks, assignments: [...recorded.assignments, ...(item.assignments ?? [])] };
    publish(rows.map((row) => (row.id === item.id ? nextItem : row)));
    setHistory((current) => (current?.id === item.id ? nextItem : current));
    setAssigning(nextItem);
    notify("Piesaistīts.", "ok");
    return "ok";
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Apģērbs</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Darba apģērba nosaukums, vērtība, termiņš un atlikums.</p>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Apģērba vēl nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{row.name}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">
                    <span className="tabular-nums">{formatMoney(row.value)}</span>, {monthLabel(row.months)}
                  </p>
                  {(row.assignments ?? []).map((assignment) => (
                    <p key={assignment.id} className="mt-1 text-sm text-[#5f756a]">
                      Piesaistīts {assignment.employeeName}, {assignment.size}, {formatDate(assignment.assignedOn)}
                    </p>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAddingId(row.id)}
                    className="min-w-9 rounded-lg px-2 py-1 text-base font-semibold tabular-nums text-[#1a6b4a] hover:bg-[#e7f6ec]"
                    aria-label="Pievienot atlikumu"
                  >
                    {stockTotal(row.stocks)}
                  </button>
                  <Tooltip text="Vēsture">
                    <button type="button" onClick={() => setHistory(row)} className={iconButton} aria-label="Vēsture">
                      <History className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip text="Atlikums">
                    <button type="button" onClick={() => setBreakdownId(row.id)} className={iconButton} aria-label="Atlikums">
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {drawerOpen ? (
        <RightDrawer
          title={editing ? "Labot apģērbu" : "Pievienot apģērbu"}
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
          <label className="block text-sm font-medium">
            Nosaukums
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className={fieldClass} placeholder="Piemēram, jaka" />
          </label>
          <label className="block text-sm font-medium">
            Vērtība
            <input
              value={draft.value}
              inputMode="decimal"
              onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
              className={fieldClass}
              placeholder="0,00"
            />
          </label>
          <label className="block text-sm font-medium">
            Termiņš
            <input
              value={draft.months}
              inputMode="numeric"
              onChange={(event) => setDraft((current) => ({ ...current, months: event.target.value.replace(/\D/g, "").slice(0, 3) }))}
              className={fieldClass}
              placeholder="12"
            />
            <span className="mt-1 block text-xs font-normal text-[#5f756a]">Mēnešos</span>
          </label>
        </RightDrawer>
      ) : null}
      {deleting ? (
        <ConfirmModal title="Dzēst apģērbu?" text={`Dzēst „${deleting.name}”?`} onCancel={() => setDeleting(null)} onConfirm={() => remove(deleting)} />
      ) : null}
      {history ? <HistoryModal item={history} onClose={() => setHistory(null)} /> : null}
      {assigning ? (
        <AssignModal item={assigning} employees={employeeOptions} onClose={() => setAssigning(null)} onAssign={(chosen) => assign(assigning, chosen)} />
      ) : null}
      {adding ? <StockAddModal onClose={() => setAddingId(null)} onAdd={addStock} warnDuplicateSizes /> : null}
      {breakdown ? <StockBreakdownModal lines={breakdown.stocks} onClose={() => setBreakdownId(null)} /> : null}
    </div>
  );
}

function AssignModal({
  item,
  employees,
  onClose,
  onAssign,
}: {
  item: ClothingItem;
  employees: EmployeeOption[];
  onClose: () => void;
  onAssign: (rows: { employeeId: string; size: string }[]) => Promise<AssignResult>;
}) {
  const sizes = item.stocks.filter((line) => line.quantity > 0);
  const [rows, setRows] = useState<AssignRow[]>([emptyAssignRow()]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const chosen = rows.filter((row) => row.employeeId && row.size);

  function update(key: string, patch: Partial<AssignRow>) {
    setError("");
    setRows((current) => {
      const next = current.map((row) => (row.key === key ? { ...row, ...patch } : row));
      const last = next[next.length - 1];
      if (last?.employeeId && last.size) return [...next, emptyAssignRow()];
      return next;
    });
  }

  function changeName(row: AssignRow, value: string) {
    const taken = new Set(rows.filter((other) => other.key !== row.key && other.employeeId).map((other) => other.employeeId));
    const exact = employees.find(
      (employee) => !taken.has(employee.id) && employee.name.toLowerCase() === value.trim().toLowerCase(),
    );
    update(row.key, { name: value, employeeId: exact?.id ?? "" });
    setOpenKey(value.trim() ? row.key : null);
  }

  function pick(row: AssignRow, employee: EmployeeOption) {
    update(row.key, { name: employee.name, employeeId: employee.id });
    setOpenKey(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) return;
    const result = await onAssign(chosen);
    if (result === "stock") {
      setError("Atlikumā nav tik daudz šī izmēra.");
      return;
    }
    if (result === "ok") onClose();
  }

  return (
    <CenterDialog title="Piesaistīt" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="text-sm text-[#5f756a]">Katrs darbinieks noņem 1 no atlikuma. Tukšā rinda netiek ņemta vērā.</p>
        {employees.length === 0 || sizes.length === 0 ? (
          <p className="mt-4 text-sm text-[#5f756a]">{employees.length === 0 ? "Darbinieku vēl nav." : "Atlikumā nav izmēru."}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => {
              const taken = new Set(rows.filter((other) => other.key !== row.key && other.employeeId).map((other) => other.employeeId));
              const hints = employees
                .filter((employee) => !taken.has(employee.id) && matchesEmployee(row.name, employee))
                .sort((a, b) => a.name.localeCompare(b.name, "lv"));
              return (
                <div key={row.key} className="grid items-start gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Darbinieks
                    <input
                      value={row.name}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Sāc rakstīt vārdu"
                      onChange={(event) => changeName(row, event.target.value)}
                      onFocus={() => setOpenKey(row.name.trim() ? row.key : null)}
                      className={fieldClass}
                    />
                    {openKey === row.key ? (
                      <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#d3e4da] bg-white py-1 shadow-lg">
                        {hints.length === 0 ? (
                          <li className="px-3 py-2 text-sm font-normal text-[#5f756a]">Nekas neatbilst meklēšanai.</li>
                        ) : (
                          hints.map((employee) => (
                            <li key={employee.id}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => pick(row, employee)}
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
                  <label className="block text-sm font-medium">
                    Izmērs
                    <select value={row.size} onChange={(event) => update(row.key, { size: event.target.value })} className={`${fieldClass} cursor-pointer`}>
                      <option value="">Izvēlēties</option>
                      {sizes.map((line) => (
                        <option key={line.size} value={line.size}>
                          {line.size} ({line.quantity})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
            Atcelt
          </button>
          <button
            type="submit"
            disabled={chosen.length === 0}
            className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            Piesaistīt
          </button>
        </div>
      </form>
    </CenterDialog>
  );
}

function HistoryModal({ item, onClose }: { item: ClothingItem; onClose: () => void }) {
  const now = Date.now();
  const groups = historyGroups(item.assignments ?? [], now);
  return (
    <CenterDialog title="Vēsture" onClose={onClose}>
      {groups.length === 0 ? (
        <p className="text-sm text-[#5f756a]">Šim apģērbam vēl nav darbību.</p>
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

function historyGroups(assignments: ClothingAssignment[], now: number) {
  const items = [...assignments]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((entry) => {
      const parsed = Date.parse(entry.createdAt);
      return {
        id: entry.id,
        at: Number.isNaN(parsed) ? Date.parse(`${entry.assignedOn}T12:00:00`) : parsed,
        label: "Piešķirts",
        color: "#1a6b4a",
        detail: [entry.employeeName, entry.size].filter(Boolean).join(", "),
      };
    })
    .reverse();
  const groups: { label: string; items: typeof items }[] = [];
  for (const entry of items) {
    const label = dayLabel(entry.at, now);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [entry] });
    else last.items.push(entry);
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

function emptyAssignRow(): AssignRow {
  return { key: crypto.randomUUID(), employeeId: "", name: "", size: "" };
}

function matchesEmployee(query: string, employee: EmployeeOption) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${employee.name} ${employee.email}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function parseAmount(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function amountInput(value: number) {
  return formatMoney(value).replace(" €", "");
}

function isComplete(draft: ReturnType<typeof emptyClothing>) {
  const value = parseAmount(draft.value);
  const months = Number(draft.months);
  return draft.name.trim() !== "" && draft.value.trim() !== "" && Number.isFinite(value) && value >= 0 && Number.isInteger(months) && months >= 1;
}

function monthLabel(months: number) {
  return months % 10 === 1 && months % 100 !== 11 ? `${months} mēnesis` : `${months} mēneši`;
}

const iconButton = "grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
