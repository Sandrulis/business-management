"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { InvoiceTable } from "@/app/components/invoice-table";
import { useInvoices } from "@/app/components/invoice-state";
import { formatMoney, isOverdue } from "@/app/lib/invoices/model";
import { preparePaymentFile, type PaymentFile, type PaymentFormat } from "@/app/lib/payments/pain001";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function UnpaidView() {
  const { today, invoices, settings, sites, notify } = useInvoices();
  const [choosing, setChoosing] = useState(false);
  const [partial, setPartial] = useState<Extract<PaymentFile, { ok: true }> | null>(null);
  const unpaid = invoices.filter((invoice) => !invoice.paid).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const overdue = unpaid.filter((invoice) => isOverdue(invoice.dueOn, today, invoice.paid));
  const total = unpaid.reduce((sum, invoice) => sum + invoice.gross, 0);

  function exportPayments(format: PaymentFormat) {
    setChoosing(false);
    const result = preparePaymentFile({
      invoices: unpaid.map((invoice) => {
        const site = sites.find((entry) => entry.id === invoice.objectId);
        return { ...invoice, clientName: site?.customer ?? invoice.client, clientIban: site?.iban ?? "" };
      }),
      debtorName: settings.name,
      debtorIban: settings.iban,
      debtorLegalId: settings.registrationNumber,
      executionDate: today,
      format,
    });
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    if (result.skipped.length > 0) {
      setPartial(result);
      return;
    }
    downloadPaymentFile(result.filename, result.xml);
    notify("Maksājuma fails sagatavots.", "ok");
  }

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Neapmaksātie</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
            Visi apstrādātie rēķini, kas vēl nav apmaksāti, arī no citiem mēnešiem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setChoosing(true)}
          disabled={unpaid.length === 0}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
        >
          <Download className="size-4" aria-hidden="true" />
          Maksājuma importa fails
        </button>
      </div>
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Neapmaksāti" value={String(unpaid.length)} />
        <Stat label="Nokavēti" value={String(overdue.length)} />
        <Stat label="Kopā ar PVN" value={formatMoney(total)} />
      </section>
      <InvoiceTable invoices={unpaid} today={today} empty="Neapmaksātu rēķinu nav." />
      {choosing ? <FormatChoice onCancel={() => setChoosing(false)} onChoose={exportPayments} /> : null}
      {partial ? (
        <ConfirmModal
          title="Daļai rēķinu trūkst datu"
          text={`${partial.skipped.join("; ")}. Lejupielādēt failu ar pārējiem?`}
          confirmLabel="Lejupielādēt"
          tone="primary"
          onCancel={() => setPartial(null)}
          onConfirm={() => {
            downloadPaymentFile(partial.filename, partial.xml);
            setPartial(null);
            notify("Maksājuma fails sagatavots.", "ok");
          }}
        />
      ) : null}
    </div>
  );
}

function FormatChoice({
  onCancel,
  onChoose,
}: {
  onCancel: () => void;
  onChoose: (format: PaymentFormat) => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#12382c]/35 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="payment-format-title" className="w-full max-w-md rounded-3xl bg-white p-6 text-[#143028] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="payment-format-title" className="text-lg font-semibold">
            Maksājuma faila formāts
          </h2>
          <button type="button" onClick={onCancel} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#5f756a]" aria-label="Aizvērt">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => onChoose("fidavista")}
            className="rounded-2xl border border-[#d3e4da] px-4 py-3 text-left hover:bg-[#eef5f0]"
          >
            <span className="block text-sm font-semibold">FiDAViSta</span>
            <span className="mt-1 block text-sm font-normal text-[#5f756a]">Latvijas banku XML. EUR maksājumi uz Latviju, Lietuvu un Igauniju.</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose("pain001")}
            className="rounded-2xl border border-[#d3e4da] px-4 py-3 text-left hover:bg-[#eef5f0]"
          >
            <span className="block text-sm font-semibold">ISO pain.001.001.09</span>
            <span className="mt-1 block text-sm font-normal text-[#5f756a]">SEPA XML. Der arī maksājumiem ārpus Baltijas.</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function downloadPaymentFile(filename: string, xml: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl border border-[#d3e4da] bg-white p-5">
      <p className="text-sm text-[#5f756a]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </article>
  );
}
