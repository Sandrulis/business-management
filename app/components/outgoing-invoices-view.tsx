"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { useInvoices } from "@/app/components/invoice-state";
import { useOfferCategories } from "@/app/components/use-offer-categories";
import { RightDrawer } from "@/app/components/right-drawer";
import { setOutgoingUnpaid } from "@/app/components/use-outgoing-unpaid";
import { createLiveList } from "@/app/lib/catalog/live-list";
import { addDays, formatDate, formatMoney, monthOf, shiftMonth, type MonthKey } from "@/app/lib/invoices/model";
import { insertOutgoingInvoice, markOutgoingInvoicePaid, type OutgoingInvoice } from "@/app/lib/outgoing/repository";
import { ChevronLeft, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const outgoingLive = createLiveList<OutgoingInvoice>();
let pendingNotice: string | null = null;

function queueCreatedNotice() {
  pendingNotice = "Rēķins izveidots.";
}

export function OutgoingInvoicesView({
  initialInvoices,
  available,
}: {
  initialInvoices: OutgoingInvoice[];
  available: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { sites, settings, notify, today } = useInvoices();
  const creating = pathname === "/outgoing_invoices/new";
  const clients = [...sites].sort((a, b) => a.customer.localeCompare(b.customer, "lv"));
  const [invoices, publish] = outgoingLive.useLiveList(initialInvoices, available);
  const initial = monthRange(monthOf(today));
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [clientId, setClientId] = useState("");
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState(today);
  const [dueOn, setDueOn] = useState(addDays(today, paymentDayCount(settings.paymentDays)));
  const [dueManual, setDueManual] = useState(false);
  const [net, setNet] = useState("");
  const [gross, setGross] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState<OutgoingInvoice | null>(null);
  const [payingPending, setPayingPending] = useState(false);
  const categories = useOfferCategories(clientId);
  const visible = invoices.filter((invoice) => inRange(invoice.issuedOn, from, to));

  useEffect(() => {
    if (!available) notify("Datubāze nav pieejama.", "error");
  }, [available, notify]);

  useEffect(() => {
    if (!available) return;
    const rows = outgoingLive.isReady() ? outgoingLive.snapshot() : initialInvoices;
    setOutgoingUnpaid(rows.filter((invoice) => !invoice.paid).length);
  }, [available, initialInvoices]);

  useEffect(() => {
    if (!pendingNotice) return;
    const timer = window.setTimeout(() => {
      if (!pendingNotice) return;
      const text = pendingNotice;
      pendingNotice = null;
      notify(text, "ok");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [notify]);

  const parsedNet = parseAmount(net);
  const parsedGross = parseAmount(gross);
  const complete = clientId !== "" && number.trim() !== "" && issuedOn !== "" && dueOn !== "" && parsedNet !== null && parsedGross !== null;

  function close() {
    router.push("/outgoing_invoices");
  }

  function showPreviousMonth() {
    const range = monthRange(shiftMonth(monthOf(from || today), -1));
    setFrom(range.from);
    setTo(range.to);
  }

  function changeIssued(next: string) {
    setIssuedOn(next);
    if (dueManual || !next) return;
    setDueOn(addDays(next, paymentDayCount(settings.paymentDays)));
  }

  function changeDue(next: string) {
    setDueOn(next);
    setDueManual(true);
  }

  function showInvoices(next: OutgoingInvoice[]) {
    publish(next);
    setOutgoingUnpaid(next.filter((invoice) => !invoice.paid).length);
  }

  async function confirmPaid() {
    if (!paying) return;
    setPayingPending(true);
    const saved = await markOutgoingInvoicePaid(paying.id);
    setPayingPending(false);
    if (!saved.ok) {
      notify(saved.message, "error");
      return;
    }
    const current = outgoingLive.isReady() ? outgoingLive.snapshot() : invoices;
    showInvoices(current.map((invoice) => (invoice.id === paying.id ? { ...invoice, paid: true } : invoice)));
    setPaying(null);
    notify("Rēķins atzīmēts kā samaksāts.", "ok");
  }

  function applyNet(raw: string) {
    setNet(raw);
    const value = parseAmount(raw);
    const rate = Number(settings.vatRate);
    if (value === null || !Number.isFinite(rate)) return;
    setGross(amountText(Math.round(value * (1 + rate / 100) * 100) / 100));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !complete || parsedNet === null || parsedGross === null) return false;
    const client = clients.find((site) => site.id === clientId);
    const category = categories.find((item) => item.id === categoryId);
    setSaving(true);
    const saved = await insertOutgoingInvoice({
      clientId,
      clientName: client?.customer ?? "",
      number: number.trim(),
      issuedOn,
      dueOn,
      net: parsedNet,
      gross: parsedGross,
      categoryId,
      categoryName: category?.name ?? "",
    });
    setSaving(false);
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    const current = outgoingLive.isReady() ? outgoingLive.snapshot() : invoices;
    showInvoices([saved.invoice, ...current.filter((invoice) => invoice.id !== saved.invoice.id)]);
    queueCreatedNotice();
  }

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Izejošie rēķini</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Rēķini izvēlētajā periodā.</p>
        </div>
        <div className="flex flex-wrap items-end gap-4 sm:justify-end">
          <button type="button" onClick={showPreviousMonth} className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#1a6b4a]">
            <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
            Iepriekšējais mēnesis
          </button>
          <label className="text-sm font-medium">
            No
            <DateField value={from} onChange={setFrom} className={rangeFieldClass} />
          </label>
          <label className="text-sm font-medium">
            Līdz
            <DateField value={to} onChange={setTo} className={rangeFieldClass} />
          </label>
          <button type="button" onClick={() => router.push("/outgoing_invoices/new")} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34]">
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Pievienot
          </button>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {visible.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Šajā periodā rēķinu nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {visible.map((invoice) => (
              <li key={invoice.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{invoice.number}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">{invoice.clientName}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">
                    {formatDate(invoice.issuedOn)} līdz {formatDate(invoice.dueOn)}
                    {invoice.categoryName ? `, ${invoice.categoryName}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium tabular-nums">{formatMoney(invoice.gross)}</p>
                  <p className="mt-1 text-sm text-[#5f756a] tabular-nums">{formatMoney(invoice.net)} bez PVN</p>
                  {invoice.paid ? (
                    <span className="mt-1 inline-flex rounded-full bg-[#e5f6ea] px-2 py-0.5 text-[11px] font-medium text-[#0f4a34]">Samaksāts</span>
                  ) : (
                    <button type="button" onClick={() => setPaying(invoice)} className="mt-1 inline-flex rounded-full bg-[#fde8e6] px-2 py-0.5 text-[11px] font-medium text-[#b42318]">
                      Neapmaksāts
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {paying ? (
        <ConfirmModal
          title="Vai rēķins ir apmaksāts?"
          text={`Rēķins ${paying.number} tiks atzīmēts kā samaksāts.`}
          confirmLabel="Samaksāts"
          tone="primary"
          pending={payingPending}
          onCancel={() => {
            if (!payingPending) setPaying(null);
          }}
          onConfirm={() => void confirmPaid()}
        />
      ) : null}

      {creating ? (
        <RightDrawer
          title="Jauns rēķins"
          hint="Rēķins paliek sarakstā."
          onClose={close}
          onSubmit={submit}
          footer={(dismiss) => (
            <>
              <button type="button" onClick={dismiss} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f] disabled:text-[#8aa396]">
                <X className="size-4 shrink-0" aria-hidden="true" />
                Atcelt
              </button>
              <button
                type="submit"
                disabled={!complete || saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                Izveidot
              </button>
            </>
          )}
        >
          <label className="block text-sm font-medium">
            Klients
            <select
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setCategoryId("");
              }}
              className={fieldClass}
            >
              <option value="">Izvēlies klientu</option>
              {clients.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.customer}
                  {site.address ? `, ${site.address}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Numurs
            <input value={number} onChange={(event) => setNumber(event.target.value)} className={fieldClass} placeholder="2026-001" />
          </label>
          <label className="block text-sm font-medium">
            Datums
            <DateField value={issuedOn} onChange={changeIssued} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            Apmaksas termiņš
            <DateField value={dueOn} onChange={changeDue} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium">
            Bez PVN
            <input value={net} onChange={(event) => applyNet(event.target.value)} inputMode="decimal" className={fieldClass} placeholder="0,00" />
          </label>
          <label className="block text-sm font-medium">
            Ar PVN
            <input value={gross} onChange={(event) => setGross(event.target.value)} inputMode="decimal" className={fieldClass} placeholder="0,00" />
          </label>
          <label className="block text-sm font-medium">
            Pozīcija
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!clientId} className={fieldClass}>
              <option value="">{clientId ? "Izvēlies pozīciju" : "Vispirms izvēlies klientu"}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </RightDrawer>
      ) : null}
    </div>
  );
}

function paymentDayCount(raw: string) {
  if (!/^\d+$/.test(raw.trim())) return 14;
  return Number(raw);
}

function parseAmount(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100) / 100;
  return value > 0 ? value : null;
}

function amountText(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function monthRange(key: MonthKey) {
  const last = new Date(key.year, key.month, 0).getDate();
  const month = String(key.month).padStart(2, "0");
  return {
    from: `${key.year}-${month}-01`,
    to: `${key.year}-${month}-${String(last).padStart(2, "0")}`,
  };
}

function inRange(isoDate: string, from: string, to: string) {
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";

const rangeFieldClass =
  "mt-1 h-11 w-44 rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
