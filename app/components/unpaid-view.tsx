"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { InvoiceTable } from "@/app/components/invoice-table";
import { useInvoices } from "@/app/components/invoice-state";
import { formatMoney, isOverdue } from "@/app/lib/invoices/model";
import { preparePaymentFile, type PaymentFile, type PaymentFormat } from "@/app/lib/payments/pain001";
import { Download, FileCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function UnpaidView() {
  const { today, invoices, settings, sites, notify } = useInvoices();
  const [choosing, setChoosing] = useState(false);
  const [partial, setPartial] = useState<Extract<PaymentFile, { ok: true }> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const unpaid = invoices.filter((invoice) => !invoice.paid).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const overdue = unpaid.filter((invoice) => isOverdue(invoice.dueOn, today, invoice.paid));
  const total = unpaid.reduce((sum, invoice) => sum + invoice.gross, 0);

  useEffect(() => {
    if (!choosing) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setChoosing(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setChoosing(false);
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [choosing]);

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
        <div ref={menuRef} className="relative z-20 shrink-0 self-start">
          <button
            type="button"
            aria-expanded={choosing}
            aria-haspopup="menu"
            onClick={() => setChoosing((open) => !open)}
            disabled={unpaid.length === 0}
            style={{
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              borderBottomLeftRadius: choosing ? 0 : 6,
              borderBottomRightRadius: choosing ? 0 : 6,
            }}
            className="relative z-10 inline-flex h-11 items-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white transition-[border-radius] duration-200 ease-out hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            <Download className="size-4" aria-hidden="true" />
            Maksājuma importa fails
          </button>
          <div
            className={`absolute top-full right-0 -mt-px grid w-full transition-[grid-template-rows] duration-200 ease-out ${
              choosing ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div role="menu" aria-hidden={!choosing} className="overflow-hidden rounded-b-[6px] border border-t-0 border-[#d3e4da] bg-white shadow-lg">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={choosing ? 0 : -1}
                  onClick={() => exportPayments("fidavista")}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[#143028] hover:bg-[#eef5f0]"
                >
                  <FileCode className="size-4 shrink-0 text-[#1a6b4a]" aria-hidden="true" />
                  FiDAViSta
                </button>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={choosing ? 0 : -1}
                  onClick={() => exportPayments("pain001")}
                  className="flex w-full items-center gap-2 border-t border-[#e4efe8] px-3 py-2.5 text-left text-sm font-semibold text-[#143028] hover:bg-[#eef5f0]"
                >
                  <FileCode className="size-4 shrink-0 text-[#1a6b4a]" aria-hidden="true" />
                  ISO pain.001.001.09
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Neapmaksāti" value={String(unpaid.length)} />
        <Stat label="Nokavēti" value={String(overdue.length)} />
        <Stat label="Kopā ar PVN" value={formatMoney(total)} />
      </section>
      <InvoiceTable invoices={unpaid} today={today} empty="Neapmaksātu rēķinu nav." />
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
