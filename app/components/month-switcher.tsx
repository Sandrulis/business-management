"use client";

import { useInvoices } from "@/app/components/invoice-state";
import { monthOf, monthTitle, sameMonth, shiftMonth } from "@/app/lib/invoices/model";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

export function MonthSwitcher() {
  const { today, month, setMonth } = useInvoices();
  const current = monthOf(today);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="grid size-10 place-items-center rounded-xl border border-[#d3e4da] bg-white hover:bg-[#e7f3ec]"
        onClick={() => setMonth(shiftMonth(month, -1))}
        aria-label="Iepriekšējais mēnesis"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-40 text-center">
        <p className="text-sm font-semibold">{monthTitle(month)}</p>
      </div>
      <button
        type="button"
        className="grid size-10 place-items-center rounded-xl border border-[#d3e4da] bg-white hover:bg-[#e7f3ec]"
        onClick={() => setMonth(shiftMonth(month, 1))}
        aria-label="Nākamais mēnesis"
      >
        <ChevronRight size={18} />
      </button>
      {sameMonth(month, current) ? null : (
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#143028] hover:bg-white"
          onClick={() => setMonth(current)}
        >
          <Calendar className="size-4 shrink-0" aria-hidden="true" />
          Šis mēnesis
        </button>
      )}
    </div>
  );
}
