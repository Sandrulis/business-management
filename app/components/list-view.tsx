"use client";

import { DateField } from "@/app/components/date-field";
import { InvoiceTable } from "@/app/components/invoice-table";
import { useInvoices } from "@/app/components/invoice-state";
import { duePhrase, formatDate, formatMoney, isOverdue, monthOf, shiftMonth, type Invoice, type MonthKey } from "@/app/lib/invoices/model";
import { Search } from "lucide-react";
import { useState } from "react";

export function ListView() {
  const { today, invoices } = useInvoices();
  const initial = monthRange(monthOf(today));
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [query, setQuery] = useState("");
  const needle = fold(query.trim());
  const searching = needle.length > 0;
  const current = invoices
    .filter((invoice) => searching || inRange(invoice.issuedOn, from, to))
    .filter((invoice) => !searching || fold(invoiceSearchText(invoice, today)).includes(needle))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  function showPreviousMonth() {
    const range = monthRange(shiftMonth(monthOf(from || today), -1));
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Saraksts</h1>
          <p className="mt-2 text-sm text-[#5f756a]">Rēķini izvēlētajā periodā.</p>
        </div>
        <div className={`flex flex-wrap items-end gap-4 sm:justify-end ${searching ? "text-[#8aa396]" : ""}`}>
          <button
            type="button"
            onClick={showPreviousMonth}
            disabled={searching}
            className="mb-2 text-sm font-semibold text-[#1a6b4a] disabled:text-[#8aa396]"
          >
            Iepriekšējais mēnesis
          </button>
          <label className="text-sm font-medium">
            No
            <DateField value={from} onChange={setFrom} disabled={searching} className={rangeFieldClass} />
          </label>
          <label className="text-sm font-medium">
            Līdz
            <DateField value={to} onChange={setTo} disabled={searching} className={rangeFieldClass} />
          </label>
        </div>
      </div>
      <label className="mt-6 block">
        <span className="sr-only">Meklēt rēķinu</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#5f756a]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Meklēt rēķinu"
            className="h-11 w-full rounded-xl border border-[#c5d9cd] bg-white pr-3 pl-10 outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15"
          />
        </span>
      </label>
      <InvoiceTable
        invoices={current}
        today={today}
        empty={searching ? "Pēc meklēšanas nekas nav atrasts." : "Šajā periodā rēķinu nav."}
      />
    </div>
  );
}

function invoiceSearchText(invoice: Invoice, today: string) {
  const status = invoice.paid ? "Apmaksāts" : isOverdue(invoice.dueOn, today, invoice.paid) ? "Nokavēts" : "Neapmaksāts";
  const phrase = invoice.paid ? "" : duePhrase(invoice.dueOn, today).text;
  return [
    invoice.number,
    invoice.client,
    invoice.supplier,
    invoice.objectName,
    invoice.workName,
    invoice.fileName,
    invoice.subject,
    invoice.fromEmail,
    invoice.bodyText.replace(/<[^>]+>/g, " "),
    formatDate(invoice.issuedOn),
    formatDate(invoice.dueOn),
    formatMoney(invoice.net),
    formatMoney(invoice.gross),
    String(invoice.net),
    String(invoice.gross),
    phrase,
    status,
  ].join(" ");
}

function fold(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
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

const rangeFieldClass =
  "mt-1 h-11 w-44 rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
