"use client";

import { useInvoices } from "@/app/components/invoice-state";
import type { CompanySettings, Mailbox } from "@/app/lib/company-settings";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

export function IncomingSettingsView() {
  const { settings, saveSettings, notify } = useInvoices();
  const [draft, setDraft] = useState<CompanySettings>(settings);
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const gmail = draft.mailboxes.some((mailbox) => /@(gmail|googlemail)\.com$/i.test(mailbox.email.trim()));

  function update<Key extends keyof CompanySettings>(key: Key, value: CompanySettings[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function readMailboxes(form: HTMLFormElement, current: Mailbox[]) {
    const data = new FormData(form);
    return current.map((mailbox) => ({
      ...mailbox,
      email: String(data.get(`mailbox-email-${mailbox.id}`) ?? mailbox.email),
      password: String(data.get(`mailbox-password-${mailbox.id}`) ?? mailbox.password),
    }));
  }

  function syncMailboxes(form: HTMLFormElement) {
    setDraft((current) => {
      const mailboxes = readMailboxes(form, current.mailboxes);
      if (JSON.stringify(mailboxes) === JSON.stringify(current.mailboxes)) return current;
      return { ...current, mailboxes };
    });
  }

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const timer = window.setInterval(() => syncMailboxes(form), 500);
    return () => window.clearInterval(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: CompanySettings = {
      ...draft,
      vatRate: String(data.get("vatRate") ?? draft.vatRate),
      paymentDays: String(data.get("paymentDays") ?? draft.paymentDays),
      currency: String(data.get("currency") ?? draft.currency),
      mailboxes: readMailboxes(event.currentTarget, draft.mailboxes),
      overdueReminders: data.get("overdueReminders") === "on",
    };
    if (JSON.stringify(next) === JSON.stringify(settings)) return;
    const result = await saveSettings(next);
    if (result.ok) {
      setDraft(result.settings);
      notify("Uzstādījumi saglabāti.", "ok");
      return;
    }
    notify(result.message, "error");
  }

  return (
    <form ref={formRef} onSubmit={submit} onInput={(event) => syncMailboxes(event.currentTarget)} className="animate-slide-up">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Uzstādījumi</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
            Ienākošo rēķinu noklusējumi un pastkastes, no kurām Apstrādei lapā var ielādēt neizlasītos e-pastus.
          </p>
        </div>
        <button
          type="submit"
          disabled={!dirty}
          className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
        >
          Saglabāt
        </button>
      </div>
      <section className="mt-8 rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Rēķini</h2>
        <p className="mt-1 text-sm text-[#5f756a]">Noklusējumi, kad rēķins tiek pievienots sarakstam.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            PVN likme, %
            <input
              name="vatRate"
              type="number"
              min="0"
              value={draft.vatRate}
              onChange={(event) => update("vatRate", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Apmaksas termiņš, dienas
            <input
              name="paymentDays"
              type="number"
              min="0"
              value={draft.paymentDays}
              onChange={(event) => update("paymentDays", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Valūta
            <select
              name="currency"
              value={draft.currency}
              onChange={(event) => update("currency", event.target.value)}
              className={fieldClass}
            >
              <option>EUR</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Rēķinu pastkastes</h2>
            <p className="mt-1 text-sm text-[#5f756a]">
              Ielādēt epastus nolasa neizlasītās vēstules no visām saglabātajām pastkastēm.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                mailboxes: [...current.mailboxes, { id: crypto.randomUUID(), email: "", password: "" }],
              }))
            }
            className="h-11 shrink-0 rounded-xl px-4 text-sm font-semibold text-[#1a6b4a]"
          >
            Pievienot e-pastu
          </button>
        </div>
        {gmail ? (
          <p className="mt-3 text-sm text-[#5f756a]">
            Gmail nepieņem parasto konta paroli.{" "}
            <a className="font-semibold text-[#1a6b4a] underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              Izveido lietotnes paroli
            </a>{" "}
            un ieliec to paroles laukā. Gmail iestatījumos jābūt ieslēgtam IMAP.
          </p>
        ) : null}
        <div className="mt-5 space-y-4">
          {draft.mailboxes.length === 0 ? (
            <p className="text-sm text-[#5f756a]">Nav pievienota neviena pastkaste.</p>
          ) : null}
          {draft.mailboxes.map((mailbox, index) => (
            <div key={mailbox.id} className="grid gap-4 rounded-2xl bg-[#eef5f0] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <label className="block text-sm font-medium">
                {index === 0 ? "Rēķinu e-pasts" : `E-pasts ${index + 1}`}
                <input
                  name={`mailbox-email-${mailbox.id}`}
                  type="email"
                  value={mailbox.email}
                  placeholder="rekini@uznemums.lv"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      mailboxes: current.mailboxes.map((entry) =>
                        entry.id === mailbox.id ? { ...entry, email: event.target.value } : entry,
                      ),
                    }))
                  }
                  className={fieldClass}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm font-medium">
                Parole
                <div className="relative mt-2">
                  <input
                    name={`mailbox-password-${mailbox.id}`}
                    type={visiblePasswordId === mailbox.id ? "text" : "password"}
                    value={mailbox.password}
                    placeholder="Pastkastes parole"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        mailboxes: current.mailboxes.map((entry) =>
                          entry.id === mailbox.id ? { ...entry, password: event.target.value } : entry,
                        ),
                      }))
                    }
                    className={fieldClass.replace("mt-2", "pr-11")}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#5f756a]"
                    onClick={() => setVisiblePasswordId((current) => (current === mailbox.id ? null : mailbox.id))}
                    aria-label={visiblePasswordId === mailbox.id ? "Slēpt paroli" : "Rādīt paroli"}
                  >
                    {visiblePasswordId === mailbox.id ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    mailboxes: current.mailboxes.filter((entry) => entry.id !== mailbox.id),
                  }))
                }
                className="h-11 rounded-xl px-3 text-sm font-semibold text-[#b42318]"
              >
                Noņemt
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Paziņojumi</h2>
        <p className="mt-1 text-sm text-[#5f756a]">Kad rēķins tuvojas termiņam vai jau ir nokavēts.</p>
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-[#eef5f0] px-4 py-3 text-sm font-medium">
          Atgādināt par nokavētiem rēķiniem
          <input
            name="overdueReminders"
            type="checkbox"
            checked={draft.overdueReminders}
            onChange={(event) => update("overdueReminders", event.target.checked)}
            className="size-4 accent-[#1a6b4a]"
          />
        </label>
      </section>
    </form>
  );
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
