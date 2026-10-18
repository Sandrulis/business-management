"use client";

import { MonthSwitcher } from "@/app/components/month-switcher";
import { useInvoices } from "@/app/components/invoice-state";
import { useMonthPayroll } from "@/app/components/use-month-payroll";
import { formatMoney, inMonth } from "@/app/lib/invoices/model";

export function TaxesView() {
  const { invoices, month } = useInvoices();
  const { rate, totals } = useMonthPayroll();
  const incoming = invoices.filter((invoice) => inMonth(invoice.issuedOn, month));
  const net = incoming.reduce((sum, invoice) => sum + invoice.net, 0);
  const gross = incoming.reduce((sum, invoice) => sum + invoice.gross, 0);
  const vat = gross - net;
  const payrollTax = totals.incomeTax + totals.employeeSocial + totals.employerSocial;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#d3e4da] bg-white p-4 shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Nodokļi</h2>
            <p className="mt-1 max-w-xl text-sm text-[#5f756a]">
              Priekšnodoklis no ienākošajiem rēķiniem un algu nodokļi no tā paša mēneša stundām. Izmaksājamais PVN parādīsies, kad būs izejošie rēķini.
            </p>
          </div>
          <MonthSwitcher />
        </div>
      </section>

      <section className="rounded-3xl border border-[#d3e4da] bg-white p-4 shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        <h3 className="text-sm font-semibold">PVN</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label="Ienākošie bez PVN" value={formatMoney(net)} />
          <Stat label="Priekšnodoklis" value={formatMoney(vat)} />
          <Stat label="Ienākošie ar PVN" value={formatMoney(gross)} />
        </div>
      </section>

      <section className="rounded-3xl border border-[#d3e4da] bg-white p-4 shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        <h3 className="text-sm font-semibold">Algu nodokļi</h3>
        <p className="mt-1 text-sm text-[#5f756a]">IIN 25,5%, neapliekamais minimums 550 €, VSAOI 10,50% un 23,59%.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="IIN" value={rate == null ? "—" : formatMoney(totals.incomeTax)} />
          <Stat label="VSAOI, darbinieks" value={rate == null ? "—" : formatMoney(totals.employeeSocial)} />
          <Stat label="VSAOI, darba devējs" value={rate == null ? "—" : formatMoney(totals.employerSocial)} />
          <Stat label="Kopā iemaksās" value={rate == null ? "—" : formatMoney(payrollTax)} tone={rate != null && payrollTax > 0 ? "alert" : "plain"} />
        </div>
        {rate == null ? <p className="mt-3 text-sm text-[#5f756a]">Algu nodokļiem vajag stundas likmi piedāvājumu iestatījumos.</p> : null}
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
