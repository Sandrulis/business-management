"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { useInvoices } from "@/app/components/invoice-state";
import type { Site } from "@/app/lib/invoices/model";
import { bankFromIban, isValidIban, normalizeIban } from "@/app/lib/payments/iban";
import { FormEvent, useState } from "react";

const emptySite = (): Site => ({ id: "", address: "", customer: "", iban: "", bankName: "" });

export function SitesView() {
  const { sites, saveSite, removeSite, notify } = useInvoices();
  const [draft, setDraft] = useState<Site>(emptySite);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmSite, setConfirmSite] = useState<Site | null>(null);

  const editing = sites.find((site) => site.id === editingId) ?? null;
  const ibanValue = normalizeIban(draft.iban);
  const complete = draft.customer.trim() !== "" && draft.address.trim() !== "" && isValidIban(ibanValue);
  const editDirty = editing
    ? draft.customer.trim() !== editing.customer ||
      draft.address.trim() !== editing.address ||
      ibanValue !== normalizeIban(editing.iban)
    : false;

  function beginEdit(site: Site) {
    setEditingId(site.id);
    setDraft(site);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptySite());
  }

  function applyIban(raw: string) {
    const iban = normalizeIban(raw);
    setDraft((current) => ({ ...current, iban, bankName: bankFromIban(iban)?.name ?? "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing ? !editDirty || !complete : !complete) return;
    setPendingId(editing?.id ?? "new");
    const result = await saveSite({ ...draft, iban: ibanValue });
    setPendingId(null);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    notify(editing ? "Klients saglabāts." : "Klients pievienots.", "ok");
    cancelEdit();
  }

  async function remove(id: string) {
    setPendingId(id);
    const result = await removeSite(id);
    setPendingId(null);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    notify("Klients dzēsts.", "ok");
    setConfirmSite(null);
    if (editingId === id) cancelEdit();
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Klienti</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
        Nosaukums, adrese un IBAN vajag maksājuma failam. Banku nolasa no IBAN.
      </p>

      <form onSubmit={submit} className="mt-8 rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">{editing ? "Labot klientu" : "Jauns klients"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Nosaukums
            <input
              value={draft.customer}
              onChange={(event) => setDraft((current) => ({ ...current, customer: event.target.value }))}
              className={fieldClass}
              placeholder="Uzņēmums vai persona"
            />
          </label>
          <label className="block text-sm font-medium">
            Adrese
            <input
              value={draft.address}
              onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
              className={fieldClass}
              placeholder="Iela, pilsēta"
            />
          </label>
          <label className="block text-sm font-medium">
            IBAN
            <input
              value={draft.iban}
              onChange={(event) => {
                const iban = event.target.value.toUpperCase();
                setDraft((current) => ({ ...current, iban, bankName: bankFromIban(normalizeIban(iban))?.name ?? "" }));
              }}
              onBlur={(event) => applyIban(event.target.value)}
              spellCheck={false}
              className={fieldClass}
              placeholder="LV00BANK0000000000000"
            />
            {ibanHint(draft.iban)}
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {editing ? (
            <button type="button" onClick={cancelEdit} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
              Atcelt
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pendingId !== null || !complete || (editing ? !editDirty : false)}
            className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            {editing ? "Saglabāt" : "Pievienot"}
          </button>
        </div>
      </form>

      <section className="mt-4 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {sites.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Klientu vēl nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {sites.map((site) => (
              <li key={site.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{site.customer}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">{site.address}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">{site.iban || "Nav IBAN"}</p>
                  {bankFromIban(site.iban)?.name ? <p className="text-sm text-[#5f756a]">{bankFromIban(site.iban)?.name}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => beginEdit(site)} className="h-10 rounded-xl px-3 text-sm font-semibold text-[#1a6b4a]">
                    Labot
                  </button>
                  <button type="button" onClick={() => setConfirmSite(site)} className="h-10 rounded-xl px-3 text-sm font-semibold text-[#b42318]">
                    Dzēst
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirmSite ? (
        <ConfirmModal
          title="Dzēst klientu?"
          text={`${confirmSite.customer} tiks dzēsts.`}
          pending={pendingId === confirmSite.id}
          onCancel={() => {
            if (pendingId !== confirmSite.id) setConfirmSite(null);
          }}
          onConfirm={() => void remove(confirmSite.id)}
        />
      ) : null}
    </div>
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
