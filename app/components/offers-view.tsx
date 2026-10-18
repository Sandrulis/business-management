"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { useInvoices } from "@/app/components/invoice-state";
import { addDays, formatDate, formatMoney } from "@/app/lib/invoices/model";
import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

const STATUSES = ["Melnraksts", "Nosūtīts", "Apstiprināts"] as const;

type OfferStatus = (typeof STATUSES)[number];

type Offer = {
  id: string;
  clientId: string;
  name: string;
  issuedOn: string;
  validUntil: string;
  amount: number;
  status: OfferStatus;
  note: string;
};

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function parseAmount(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100) / 100;
  return value > 0 ? value : null;
}

export function OffersView() {
  const { sites } = useInvoices();
  const clients = [...sites].sort((a, b) => a.customer.localeCompare(b.customer, "lv"));
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayIso);
  const [validUntil, setValidUntil] = useState(addDays(todayIso(), 14));
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<OfferStatus>("Melnraksts");
  const [note, setNote] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [confirmOffer, setConfirmOffer] = useState<Offer | null>(null);

  const parsedAmount = parseAmount(amount);
  const complete = clientId !== "" && name.trim() !== "" && issuedOn !== "" && validUntil !== "" && parsedAmount !== null;
  const visible = offers.filter((offer) => offer.clientId === clientId);
  const clientName = clients.find((site) => site.id === clientId)?.customer ?? "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || parsedAmount === null) return;
    setOffers((current) => [
      {
        id: crypto.randomUUID(),
        clientId,
        name: name.trim(),
        issuedOn,
        validUntil,
        amount: parsedAmount,
        status,
        note: note.trim(),
      },
      ...current,
    ]);
    setName("");
    setAmount("");
    setNote("");
    setStatus("Melnraksts");
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Piedāvājumi</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
        Piedāvājums konkrētam klientam. Priekšskats paliek tikai šajā lapā un vēl netiek saglabāts.
      </p>

      <form onSubmit={submit} className="mt-8 rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Jauns piedāvājums</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium sm:col-span-2">
            Klients
            <select value={clientId} onChange={(event) => setClientId(event.target.value)} className={fieldClass}>
              <option value="">Izvēlies klientu</option>
              {clients.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.customer}
                  {site.address ? `, ${site.address}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Nosaukums
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
              placeholder="Piemēram, fasādes remonts"
            />
          </label>
          <label className="block text-sm font-medium">
            Datums
            <DateField value={issuedOn} onChange={setIssuedOn} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            Derīgs līdz
            <DateField value={validUntil} onChange={setValidUntil} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            Summa ar PVN
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className={fieldClass}
              placeholder="0,00"
            />
          </label>
          <label className="block text-sm font-medium">
            Statuss
            <select value={status} onChange={(event) => setStatus(event.target.value as OfferStatus)} className={fieldClass}>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Piezīme
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 py-2 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15"
              placeholder="Īss apraksts"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={!complete}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Pievienot
          </button>
        </div>
      </form>

      <section className="mt-4 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {clientId === "" ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Izvēlies klientu, lai redzētu viņa piedāvājumus.</p>
        ) : visible.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Klientam {clientName} piedāvājumu vēl nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {visible.map((offer) => (
              <li key={offer.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{offer.name}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">
                    {formatDate(offer.issuedOn)} līdz {formatDate(offer.validUntil)}
                  </p>
                  {offer.note ? <p className="mt-1 text-sm text-[#5f756a]">{offer.note}</p> : null}
                  <p className="mt-2 text-sm font-medium">{formatMoney(offer.amount)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(offer.status)}`}>{offer.status}</span>
                  <button type="button" onClick={() => setConfirmOffer(offer)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#b42318]">
                    <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                    Dzēst
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirmOffer ? (
        <ConfirmModal
          title="Dzēst piedāvājumu?"
          text={`${confirmOffer.name} tiks noņemts no priekšskata.`}
          onCancel={() => setConfirmOffer(null)}
          onConfirm={() => {
            setOffers((current) => current.filter((offer) => offer.id !== confirmOffer.id));
            setConfirmOffer(null);
          }}
        />
      ) : null}
    </div>
  );
}

function statusClass(status: OfferStatus) {
  if (status === "Apstiprināts") return "bg-[#e5f6ea] text-[#0f4a34]";
  if (status === "Nosūtīts") return "bg-[#e7f0fb] text-[#1d4e89]";
  return "bg-[#f3f0e6] text-[#6b5a24]";
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
