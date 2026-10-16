"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { useInvoices } from "@/app/components/invoice-state";
import { PassportPhoto } from "@/app/components/passport-photo";
import { RightDrawer } from "@/app/components/right-drawer";
import { Tooltip } from "@/app/components/tooltip";
import { createLiveList } from "@/app/lib/catalog/live-list";
import { deleteEmployeeRecord, loadEmployeeGear, saveEmployeeRecord } from "@/app/lib/catalog/repository";
import type { Employee, EmployeeOption, HeldClothing, HeldInstrument } from "@/app/lib/catalog/types";
import { formatDate } from "@/app/lib/invoices/model";
import { Pencil, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Children, FormEvent, useEffect, useRef, useState, type ReactNode } from "react";

const employeesLive = createLiveList<Employee>();

export function useEmployeeNames(initial: EmployeeOption[]) {
  const [names, setNames] = useState(initial);
  useEffect(() => {
    const sync = () => {
      if (!employeesLive.isReady()) return;
      setNames(
        employeesLive.snapshot().map((employee) => ({
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          email: employee.email,
        })),
      );
    };
    const unsubscribe = employeesLive.subscribe(sync);
    sync();
    return unsubscribe;
  }, []);
  return names;
}

const emptyEmployee = (): Omit<Employee, "id"> => ({
  firstName: "",
  lastName: "",
  personalCode: "",
  email: "",
  phone: "",
  contractNumber: "",
  contractDate: "",
  role: "",
  photo: "",
});

export function EmployeesView({ initialEmployees, available }: { initialEmployees: Employee[]; available: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = useInvoices();
  const creating = pathname === "/employees/new";
  const [rows, publish] = employeesLive.useLiveList(initialEmployees, available);
  const [draft, setDraft] = useState(emptyEmployee);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
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
    setDraft(emptyEmployee());
    if (!wasEditing) router.push("/employees");
  }

  function beginEdit(employee: Employee) {
    setViewing(null);
    setEditingId(employee.id);
    setDraft({
      firstName: employee.firstName,
      lastName: employee.lastName,
      personalCode: employee.personalCode,
      email: employee.email,
      phone: employee.phone,
      contractNumber: employee.contractNumber,
      contractDate: employee.contractDate,
      role: employee.role,
      photo: employee.photo,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const saved = await saveEmployeeRecord(
      {
        firstName: draft.firstName,
        lastName: draft.lastName,
        personalCode: draft.personalCode,
        email: draft.email,
        phone: draft.phone,
        contractNumber: draft.contractNumber,
        contractDate: draft.contractDate,
        role: draft.role,
        photo: draft.photo,
      },
      editing?.id,
    );
    savingRef.current = false;
    setSaving(false);
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    const next = editing ? rows.map((row) => (row.id === editing.id ? saved.employee : row)) : [saved.employee, ...rows];
    publish(next);
    notify(editing ? "Darbinieks saglabāts." : "Darbinieks pievienots.", "ok");
    if (!editing) setDraft(emptyEmployee());
  }

  async function remove(employee: Employee) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const removed = await deleteEmployeeRecord(employee.id);
    savingRef.current = false;
    setSaving(false);
    if (!removed.ok) {
      notify(removed.message, "error");
      return;
    }
    publish(rows.filter((row) => row.id !== employee.id));
    setDeleting(null);
    notify("Darbinieks dzēsts.", "ok");
  }

  function setField<K extends keyof Omit<Employee, "id">>(key: K, value: Employee[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Darbinieki</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Uzņēmuma darbinieki, līgums un foto.</p>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Darbinieku vēl nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setViewing(row)} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl text-left">
                  {row.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.photo} alt="" className="aspect-[35/45] w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="aspect-[35/45] w-12 shrink-0 rounded-lg bg-[#eef5f0]" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="mt-1 text-sm text-[#5f756a]">
                      {row.role}, {row.personalCode}
                    </p>
                    <p className="mt-1 text-sm text-[#5f756a]">
                      {row.email}, {row.phone}
                    </p>
                    <p className="mt-1 text-sm text-[#5f756a]">
                      Līgums {row.contractNumber}, {formatDate(row.contractDate)}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {viewing ? <EmployeeProfile employee={viewing} onClose={() => setViewing(null)} /> : null}
      {creating || editing ? (
        <RightDrawer
          title={editing ? "Labot darbinieku" : "Pievienot darbinieku"}
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
          <PassportPhoto value={draft.photo} onChange={(photo) => setField("photo", photo)} />
          <Field label="Vārds" value={draft.firstName} placeholder="Vārds" onChange={(value) => setField("firstName", value)} />
          <Field label="Uzvārds" value={draft.lastName} placeholder="Uzvārds" onChange={(value) => setField("lastName", value)} />
          <Field
            label="Personas kods"
            value={draft.personalCode}
            placeholder="000000-00000"
            inputMode="numeric"
            onChange={(value) => setField("personalCode", formatPersonalCode(value))}
            hint="Formāts 000000-00000"
          />
          <Field label="E-pasts" value={draft.email} placeholder="vards@uznemums.lv" type="email" onChange={(value) => setField("email", value)} />
          <Field label="Tālrunis" value={draft.phone} placeholder="+371 20000000" type="tel" onChange={(value) => setField("phone", value)} />
          <Field label="Līguma numurs" value={draft.contractNumber} placeholder="DL-001" onChange={(value) => setField("contractNumber", value)} />
          <label className="block text-sm font-medium">
            Līguma datums
            <DateField value={draft.contractDate} onChange={(value) => setField("contractDate", value)} />
          </label>
          <Field label="Amats" value={draft.role} placeholder="Piemēram, meistars" onChange={(value) => setField("role", value)} />
        </RightDrawer>
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Dzēst darbinieku?"
          text={`Dzēst „${deleting.firstName} ${deleting.lastName}”?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  inputMode,
  hint,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric";
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
        placeholder={placeholder}
        spellCheck={type === "email" ? false : undefined}
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-[#5f756a]">{hint}</span> : null}
    </label>
  );
}

function EmployeeProfile({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [tab, setTab] = useState<"instruments" | "clothing">("instruments");
  const [gear, setGear] = useState<{ instruments: HeldInstrument[]; clothing: HeldClothing[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const name = `${employee.firstName} ${employee.lastName}`.trim();

  useEffect(() => {
    let active = true;
    loadEmployeeGear(employee.id).then((result) => {
      if (!active) return;
      setFailed(!result.ok);
      setGear(result);
    });
    return () => {
      active = false;
    };
  }, [employee.id]);

  return (
    <RightDrawer title={name} hint={employee.role} onClose={onClose}>
      <div className="flex gap-4">
        {employee.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={employee.photo} alt="" className="aspect-[35/45] w-24 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="aspect-[35/45] w-24 shrink-0 rounded-xl bg-[#eef5f0]" />
        )}
        <dl className="min-w-0 space-y-2 text-sm">
          <Fact label="Personas kods" value={employee.personalCode} />
          <Fact label="E-pasts" value={employee.email} />
          <Fact label="Tālrunis" value={employee.phone} />
          <Fact label="Līgums" value={employee.contractNumber ? `${employee.contractNumber}, ${formatDate(employee.contractDate)}` : ""} />
        </dl>
      </div>
      <div className="grid grid-cols-2 rounded-xl bg-[#eef5f0] p-1" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "instruments"} onClick={() => setTab("instruments")} className={tabClass(tab === "instruments")}>
          Instrumenti
        </button>
        <button type="button" role="tab" aria-selected={tab === "clothing"} onClick={() => setTab("clothing")} className={tabClass(tab === "clothing")}>
          Apģērbi
        </button>
      </div>
      {failed ? (
        <p className="text-sm text-[#b42318]">Neizdevās ielādēt piesaistes.</p>
      ) : !gear ? (
        <p className="text-sm text-[#5f756a]">Ielādē...</p>
      ) : tab === "instruments" ? (
        <GearList empty="Nav piesaistītu instrumentu.">
          {gear.instruments.map((item) => {
            const detail = [instrumentDetail(item), item.assignedOn ? formatDate(item.assignedOn) : ""].filter(Boolean).join(", ");
            return (
              <li key={item.id} className="px-4 py-3">
                <p className="font-medium">{instrumentTitle(item)}</p>
                {detail ? <p className="mt-1 text-sm text-[#5f756a]">{detail}</p> : null}
              </li>
            );
          })}
        </GearList>
      ) : (
        <GearList empty="Nav piesaistītu apģērbu.">
          {gear.clothing.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <p className="font-medium">{item.name}</p>
              <p className="mt-1 text-sm text-[#5f756a]">
                {item.size}, {formatDate(item.assignedOn)}
              </p>
            </li>
          ))}
        </GearList>
      )}
    </RightDrawer>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <dt className="text-xs text-[#5f756a]">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function GearList({ empty, children }: { empty: string; children: ReactNode }) {
  if (Children.count(children) === 0) return <p className="text-sm text-[#5f756a]">{empty}</p>;
  return <ul className="divide-y divide-[#e4efe8] overflow-hidden rounded-2xl border border-[#d3e4da]">{children}</ul>;
}

function instrumentTitle(item: HeldInstrument) {
  return [item.brand, item.model].filter(Boolean).join(" ") || item.number || item.serialNumber || "Instruments";
}

function instrumentDetail(item: HeldInstrument) {
  const title = instrumentTitle(item);
  return [item.number, item.serialNumber].filter((part) => part && part !== title).join(", ");
}

function tabClass(active: boolean) {
  return `h-9 rounded-lg text-sm font-semibold ${active ? "bg-white text-[#1a6b4a] shadow-sm" : "text-[#5f756a]"}`;
}

function formatPersonalCode(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function isComplete(draft: Omit<Employee, "id">) {
  return (
    draft.firstName.trim() !== "" &&
    draft.lastName.trim() !== "" &&
    /^\d{6}-\d{5}$/.test(draft.personalCode) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) &&
    draft.phone.trim() !== "" &&
    draft.contractNumber.trim() !== "" &&
    draft.contractDate !== "" &&
    draft.role.trim() !== ""
  );
}

const iconButton = "grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
