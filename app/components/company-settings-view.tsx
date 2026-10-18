"use client";

import { useInvoices } from "@/app/components/invoice-state";
import type { CompanySettings } from "@/app/lib/company-settings";
import { bankFromIban, isValidIban, normalizeIban } from "@/app/lib/payments/iban";
import { Check } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

const sections: { title: string; text: string; fields: FieldConfig[] }[] = [
  {
    title: "Uzņēmums",
    text: "Ievadi reģistrācijas numuru. Nosaukums, adrese un PVN numurs ielasās no reģistra. Banku nolasa no IBAN.",
    fields: [
      { key: "registrationNumber", label: "Reģistrācijas numurs", placeholder: "40000000000" },
      { key: "name", label: "Nosaukums", placeholder: "SIA Nosaukums" },
      { key: "address", label: "Juridiskā adrese", placeholder: "Iela, pilsēta" },
      { key: "vatNumber", label: "PVN numurs", placeholder: "LV40000000000" },
      { key: "iban", label: "IBAN", placeholder: "LV00BANK0000000000000" },
      { key: "email", label: "E-pasts", placeholder: "rekini@uznemums.lv", type: "email" },
      { key: "phone", label: "Tālrunis", placeholder: "+371 20000000" },
    ],
  },
  {
    title: "Rēķini",
    text: "Noklusējumi jauniem ienākošajiem rēķiniem.",
    fields: [
      { key: "vatRate", label: "PVN likme, %", type: "number" },
      { key: "paymentDays", label: "Apmaksas termiņš, dienas", type: "number" },
      { key: "currency", label: "Valūta", options: ["EUR"] },
    ],
  },
];

type FieldConfig = {
  key: keyof CompanySettings;
  label: string;
  placeholder?: string;
  type?: string;
  options?: string[];
};

export function CompanySettingsView() {
  const { settings, saveSettings, notify } = useInvoices();
  const [draft, setDraft] = useState<CompanySettings>(settings);
  const [lookingUp, setLookingUp] = useState(false);
  const loadedRegistration = useRef("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  function update<Key extends keyof CompanySettings>(key: Key, value: CompanySettings[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyIban(raw: string) {
    const iban = normalizeIban(raw);
    setDraft((current) => ({ ...current, iban, bankName: bankFromIban(iban)?.name ?? "" }));
  }

  async function lookupRegistration(raw: string) {
    const registrationNumber = raw.replace(/\D/g, "");
    update("registrationNumber", registrationNumber);
    if (!/^\d{11}$/.test(registrationNumber) || registrationNumber === loadedRegistration.current) return;
    setLookingUp(true);
    try {
      const response = await fetch("/api/company/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registrationNumber }),
      });
      const result = (await response.json()) as {
        found?: boolean;
        name?: string;
        address?: string;
        vatNumber?: string | null;
        message?: string;
      };
      if (!response.ok) {
        notify(result.message || "Uzņēmuma datus neizdevās ielasīt.", "error");
        return;
      }
      if (!result.found) {
        notify("Uzņēmums ar šo reģistrācijas numuru nav atrasts.", "error");
        return;
      }
      loadedRegistration.current = registrationNumber;
      setDraft((current) => ({
        ...current,
        registrationNumber,
        name: result.name || current.name,
        address: result.address || current.address,
        vatNumber: result.vatNumber || current.vatNumber,
      }));
      notify("Uzņēmuma dati ielasīti.", "ok");
    } catch {
      notify("Uzņēmuma datus neizdevās ielasīt.", "error");
    } finally {
      setLookingUp(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    const iban = normalizeIban(String(draft.iban));
    const result = await saveSettings({ ...draft, iban, bankName: bankFromIban(iban)?.name ?? "" });
    if (result.ok) {
      notify("Uzstādījumi saglabāti.", "ok");
      return;
    }
    notify(result.message, "error");
  }

  return (
    <form onSubmit={submit} className="animate-slide-up">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Uzņēmuma uzstādījumi</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
            Uzņēmuma profils, rēķinu noklusējumi un bankas konts. Šeit varēs pievienot arī citas uzņēmuma iestatījumu grupas.
          </p>
        </div>
        <button
          type="submit"
          disabled={!dirty}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Saglabāt
        </button>
      </div>
      <div className="mt-8 space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
            <h2 className="font-semibold">{section.title}</h2>
            <p className="mt-1 text-sm text-[#5f756a]">{section.text}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <label key={field.key} className="block text-sm font-medium">
                  {field.label}
                  {field.options ? (
                    <select
                      value={String(draft[field.key])}
                      onChange={(event) => update(field.key, event.target.value)}
                      className={fieldClass}
                    >
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      value={String(draft[field.key])}
                      placeholder={field.placeholder}
                      spellCheck={field.key === "iban" ? false : undefined}
                      inputMode={field.key === "registrationNumber" ? "numeric" : undefined}
                      min={field.type === "number" ? "0" : undefined}
                      disabled={lookingUp && field.key === "registrationNumber"}
                      onChange={(event) => {
                        if (field.key !== "iban") {
                          update(field.key, event.target.value);
                          return;
                        }
                        const iban = event.target.value.toUpperCase();
                        setDraft((current) => ({ ...current, iban, bankName: bankFromIban(normalizeIban(iban))?.name ?? "" }));
                      }}
                      onBlur={
                        field.key === "iban"
                          ? (event) => applyIban(event.target.value)
                          : field.key === "registrationNumber"
                            ? (event) => void lookupRegistration(event.target.value)
                            : undefined
                      }
                      className={fieldClass}
                    />
                  )}
                  {field.key === "registrationNumber" && lookingUp ? (
                    <span className="mt-1 block text-xs font-normal text-[#5f756a]">Meklē uzņēmumu...</span>
                  ) : null}
                  {field.key === "iban" && ibanHint(String(draft.iban))}
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
          <h2 className="font-semibold">Piedāvājumi</h2>
          <p className="mt-1 text-sm text-[#5f756a]">Darba likme ieliekas jaunās tāmes rindās, un to var rindā nomainīt. Termiņš un komentārs rādās piedāvājumā.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Tāmes derīguma termiņš
              <span className={suffixRow}>
                <input
                  value={draft.offerValidDays}
                  inputMode="numeric"
                  onChange={(event) => update("offerValidDays", event.target.value.replace(/\D/g, ""))}
                  className={suffixInput}
                />
                <span className={suffixLabel}>dienas</span>
              </span>
            </label>
            <label className="block text-sm font-medium">
              Darbinieka standarta stundas likme
              <span className={suffixRow}>
                <input
                  value={draft.offerHourlyRate}
                  inputMode="decimal"
                  onChange={(event) => update("offerHourlyRate", event.target.value.replace(/[^\d,.\s]/g, ""))}
                  className={suffixInput}
                />
                <span className={suffixLabel}>EUR</span>
              </span>
            </label>
            <label className="block text-sm font-medium sm:col-span-2">
              Papildus informācija piedāvājumam
              <span className="mt-1 block text-xs font-normal text-[#5f756a]">Rādās piedāvājuma beigās.</span>
              <textarea
                value={draft.offerNote}
                onChange={(event) => update("offerNote", event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 py-2 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
          <h2 className="font-semibold">Paziņojumi</h2>
          <p className="mt-1 text-sm text-[#5f756a]">Kad rēķins tuvojas termiņam vai jau ir nokavēts.</p>
          <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-[#eef5f0] px-4 py-3 text-sm font-medium">
            Atgādināt par nokavētiem rēķiniem
            <input
              type="checkbox"
              checked={draft.overdueReminders}
              onChange={(event) => update("overdueReminders", event.target.checked)}
              className="size-4 accent-[#1a6b4a]"
            />
          </label>
        </section>
      </div>
    </form>
  );
}

function ibanHint(value: string) {
  const iban = normalizeIban(value);
  if (iban === "") return null;
  if (!isValidIban(iban)) return <span className="mt-1 block text-xs font-normal text-[#b42318]">IBAN nav derīgs.</span>;
  const bank = bankFromIban(iban);
  return bank ? <span className="mt-1 block text-xs font-normal text-[#5f756a]">{bank.name}</span> : null;
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";

const suffixRow =
  "mt-2 flex h-11 overflow-hidden rounded-xl border border-[#c5d9cd] focus-within:border-[#1a6b4a] focus-within:ring-4 focus-within:ring-[#1a6b4a]/15";

const suffixInput = "min-w-0 flex-1 bg-transparent px-3 outline-none";

const suffixLabel = "grid place-items-center bg-[#f4faf6] px-3 text-sm text-[#5f756a]";
