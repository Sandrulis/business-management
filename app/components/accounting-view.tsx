"use client";

import { MonthSwitcher } from "@/app/components/month-switcher";
import { useInvoices } from "@/app/components/invoice-state";
import { formatDate, formatMoney, inMonth, isOverdue, monthOf, type Invoice } from "@/app/lib/invoices/model";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jūn", "Jūl", "Aug", "Sep", "Okt", "Nov", "Dec"];

export function AccountingView() {
  const { invoices, month, setMonth, today } = useInvoices();
  const rows = invoices
    .filter((invoice) => inMonth(invoice.issuedOn, month))
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || a.number.localeCompare(b.number, "lv"));
  const totals = sum(rows);
  const year = invoices.filter((invoice) => monthOf(invoice.issuedOn).year === month.year);
  const months = MONTHS.map((label, index) => {
    const key = { year: month.year, month: index + 1 };
    return { label, key, gross: sum(year.filter((invoice) => inMonth(invoice.issuedOn, key))).gross };
  });
  const peak = Math.max(...months.map((item) => item.gross), 1);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#d3e4da] bg-white p-4 shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Rēķinu kopsavilkums</h2>
            <p className="mt-1 text-sm text-[#5f756a]">Ienākošo rēķinu izdevumi un priekšnodoklis.</p>
          </div>
          <MonthSwitcher />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Izdevumi" value={formatMoney(totals.gross)} />
          <Stat label="Neto" value={formatMoney(totals.net)} />
          <Stat label="PVN" value={formatMoney(totals.vat)} />
          <Stat label="Neapmaksāts" value={formatMoney(totals.unpaid)} tone={totals.unpaid > 0 ? "alert" : "plain"} />
        </div>
      </section>

      <section className="rounded-3xl border border-[#d3e4da] bg-white p-4 shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        <h3 className="text-sm font-semibold">{month.year}. gada izdevumi</h3>
        <div className="mt-4 grid grid-cols-12 items-end gap-2">
          {months.map((item) => {
            const active = item.key.month === month.month;
            const height = item.gross <= 0 ? 4 : Math.max(8, Math.round((item.gross / peak) * 112));
            return (
              <button key={item.label} type="button" onClick={() => setMonth(item.key)} className="flex flex-col items-center gap-2" aria-label={`${item.label} ${formatMoney(item.gross)}`}>
                <span className={`w-full rounded-t-lg ${active ? "bg-[#1a6b4a]" : "bg-[#c5e0d2] hover:bg-[#8fbfa6]"}`} style={{ height }} />
                <span className={`text-[11px] ${active ? "font-semibold text-[#143028]" : "text-[#5f756a]"}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#d3e4da] bg-white shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#5f756a]">Šajā mēnesī rēķinu nav.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#f7fbf8] text-xs uppercase tracking-wide text-[#5f756a]">
                <tr>
                  <th className="px-3 py-2 font-medium">Datums</th>
                  <th className="px-3 py-2 font-medium">Piegādātājs</th>
                  <th className="px-3 py-2 font-medium">Numurs</th>
                  <th className="px-3 py-2 font-medium">Objekts</th>
                  <th className="px-3 py-2 text-right font-medium">Neto</th>
                  <th className="px-3 py-2 text-right font-medium">PVN</th>
                  <th className="px-3 py-2 text-right font-medium">Kopā</th>
                  <th className="px-3 py-2 font-medium">Statuss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => {
                  const overdue = isOverdue(invoice.dueOn, today, invoice.paid);
                  return (
                    <tr key={invoice.id} className="border-t border-[#e4efe8]">
                      <td className="px-3 py-2 tabular-nums">{formatDate(invoice.issuedOn)}</td>
                      <td className="px-3 py-2 font-medium">{invoice.supplier}</td>
                      <td className="px-3 py-2">{invoice.number}</td>
                      <td className="px-3 py-2 text-[#5f756a]">{invoice.objectName || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(invoice.net)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(invoice.gross - invoice.net)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(invoice.gross)}</td>
                      <td className={`px-3 py-2 ${overdue ? "font-medium text-[#7f1d1d]" : invoice.paid ? "text-[#1a6b4a]" : ""}`}>
                        {invoice.paid ? "Apmaksāts" : overdue ? "Nokavēts" : "Neapmaksāts"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "alert" }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone === "alert" ? "border-[#f3c7c3] bg-[#fde8e6]" : "border-[#d3e4da] bg-[#f7fbf8]"}`}>
      <p className="text-xs uppercase tracking-wide text-[#5f756a]">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === "alert" ? "text-[#7f1d1d]" : "text-[#143028]"}`}>{value}</p>
    </div>
  );
}

function sum(rows: Invoice[]) {
  return rows.reduce(
    (total, invoice) => ({
      net: total.net + invoice.net,
      gross: total.gross + invoice.gross,
      vat: total.vat + (invoice.gross - invoice.net),
      unpaid: total.unpaid + (invoice.paid ? 0 : invoice.gross),
    }),
    { net: 0, gross: 0, vat: 0, unpaid: 0 },
  );
}
