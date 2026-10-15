"use client";

import { MonthSwitcher } from "@/app/components/month-switcher";
import { useInvoices } from "@/app/components/invoice-state";
import {
  formatDate,
  formatMoney,
  inMonth,
  isOverdue,
  monthTitle,
  type Invoice,
} from "@/app/lib/invoices/model";

export function HomeView() {
  const { today, month, invoices } = useInvoices();
  const monthInvoices = invoices.filter((invoice) => inMonth(invoice.issuedOn, month));
  const net = sum(monthInvoices, "net");
  const gross = sum(monthInvoices, "gross");
  const unpaid = monthInvoices.filter((invoice) => !invoice.paid);
  const unpaidGross = sum(unpaid, "gross");
  const byType = groupByType(monthInvoices);
  const maxType = Math.max(...byType.map((item) => item.gross), 1);
  const deadlines = [...unpaid].sort((a, b) => a.dueOn.localeCompare(b.dueOn)).slice(0, 5);

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sākums</h1>
          <p className="mt-2 text-sm text-[#5f756a]">
            {monthTitle(month)} ienākošo rēķinu kopsavilkums.
          </p>
        </div>
        <MonthSwitcher />
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Rēķini" value={String(monthInvoices.length)} note="Saņemti šajā mēnesī" />
        <Stat label="Bez PVN" value={formatMoney(net)} note="Summa pirms nodokļa" />
        <Stat label="Ar PVN" value={formatMoney(gross)} note={`PVN ${formatMoney(gross - net)}`} />
        <Stat
          label="Neapmaksāts"
          value={formatMoney(unpaidGross)}
          note={unpaid.length === 1 ? "1 rēķins vēl jāapmaksā" : `${unpaid.length} rēķini vēl jāapmaksā`}
        />
      </section>

      {monthInvoices.length === 0 ? (
        <Empty title="Šajā mēnesī rēķinu nav" text="Pārslēdziet mēnesi vai apstrādājiet ienākošo pastu." />
      ) : (
        <section className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
            <h2 className="font-semibold">Darbi</h2>
            <p className="mt-1 text-sm text-[#5f756a]">Summas ar PVN šajā mēnesī.</p>
            <div className="mt-6 space-y-4">
              {byType.map((item) => (
                <div key={item.type}>
                  <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">{item.type}</span>
                    <span className="tabular-nums text-[#5f756a]">{formatMoney(item.gross)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#dff0e6]">
                    <div
                      className="h-full rounded-full bg-[#1a6b4a]"
                      style={{ width: `${(item.gross / maxType) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
            <h2 className="font-semibold">Tuvākie termiņi</h2>
            <p className="mt-1 text-sm text-[#5f756a]">Neapmaksātie šī mēneša rēķini.</p>
            <div className="mt-5 divide-y divide-[#e4efe8]">
              {deadlines.length === 0 ? (
                <p className="py-8 text-sm text-[#5f756a]">Visi šī mēneša rēķini ir apmaksāti.</p>
              ) : (
                deadlines.map((invoice) => (
                  <div key={invoice.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invoice.supplier}</p>
                      <p className="mt-1 truncate text-sm text-[#5f756a]">{invoice.objectName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatMoney(invoice.gross)}</p>
                      <p
                        className={`mt-1 text-xs ${
                          isOverdue(invoice.dueOn, today, invoice.paid) ? "font-semibold text-[#b42318]" : "text-[#5f756a]"
                        }`}
                      >
                        {formatDate(invoice.dueOn)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-3xl border border-[#d3e4da] bg-white p-5">
      <p className="text-sm text-[#5f756a]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-[#5f756a]">{note}</p>
    </article>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-3xl border border-dashed border-[#c5d8cc] bg-white px-6 py-16 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[#5f756a]">{text}</p>
    </div>
  );
}

function sum(invoices: Invoice[], key: "net" | "gross") {
  return invoices.reduce((total, invoice) => total + invoice[key], 0);
}

function groupByType(invoices: Invoice[]) {
  const totals = new Map<string, number>();
  for (const invoice of invoices) {
    const name = invoice.workName || "Bez darba";
    totals.set(name, (totals.get(name) ?? 0) + invoice.gross);
  }
  return [...totals.entries()]
    .map(([type, gross]) => ({ type, gross }))
    .sort((a, b) => b.gross - a.gross);
}
