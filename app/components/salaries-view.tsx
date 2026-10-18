"use client";

import { MonthSwitcher } from "@/app/components/month-switcher";
import { useMonthPayroll } from "@/app/components/use-month-payroll";
import { formatHours } from "@/app/lib/accounting/payroll";
import { formatMoney } from "@/app/lib/invoices/model";

export function SalariesView() {
  const { rate, rows, totals } = useMonthPayroll();

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-[#d3e4da] bg-white p-4 shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Algas</h2>
            <p className="mt-1 max-w-xl text-sm text-[#5f756a]">
              {rate == null
                ? "Nostrādātās stundas no darba laika uzskaites. Stundas likme vēl nav norādīta piedāvājumu iestatījumos, tāpēc summas nav aprēķinātas."
                : `Bruto no nostrādātajām stundām un stundas likmes ${formatMoney(rate)}. IIN 25,5% pēc 550 € neapliekamā minimuma, VSAOI 10,50% no darbinieka un 23,59% no darba devēja.`}
            </p>
          </div>
          <MonthSwitcher />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#d3e4da] bg-white shadow-[0_12px_40px_rgba(18,56,44,0.05)]">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#5f756a]">Šajā mēnesī nostrādātu stundu nav.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#f7fbf8] text-xs uppercase tracking-wide text-[#5f756a]">
                <tr>
                  <th className="px-3 py-2 font-medium">Darbinieks</th>
                  <th className="px-3 py-2 text-right font-medium">Stundas</th>
                  <th className="px-3 py-2 text-right font-medium">Bruto</th>
                  <th className="px-3 py-2 text-right font-medium">VSAOI 10,50%</th>
                  <th className="px-3 py-2 text-right font-medium">IIN</th>
                  <th className="px-3 py-2 text-right font-medium">Izmaksai</th>
                  <th className="px-3 py-2 text-right font-medium">VSAOI 23,59%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#e4efe8]">
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatHours(row.seconds)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(row.gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(row.employeeSocial)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(row.incomeTax)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{rate == null ? "—" : formatMoney(row.net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(row.employerSocial)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-[#d3e4da] bg-[#f7fbf8] font-semibold">
                <tr>
                  <td className="px-3 py-2">Kopā</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatHours(totals.seconds)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(totals.gross)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(totals.employeeSocial)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(totals.incomeTax)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(totals.net)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate == null ? "—" : formatMoney(totals.employerSocial)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
