"use client";

import { RightDrawer } from "@/app/components/right-drawer";
import { StockAddModal, StockBreakdownModal, addStockLine, stockTotal, type StockLine } from "@/app/components/stock-modals";
import { Tooltip } from "@/app/components/tooltip";
import { Info, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type WarehouseItem = {
  id: string;
  name: string;
  unit: string;
  stocks: StockLine[];
};

const savedItems: WarehouseItem[] = [];

export function WarehouseView() {
  const pathname = usePathname();
  const router = useRouter();
  const open = pathname === "/warehouse/new";
  const [rows, setRows] = useState<WarehouseItem[]>(() => savedItems);
  const [draft, setDraft] = useState({ name: "", unit: "" });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);
  const complete = draft.name.trim() !== "" && draft.unit.trim() !== "";
  const adding = rows.find((row) => row.id === addingId) ?? null;
  const breakdown = rows.find((row) => row.id === breakdownId) ?? null;

  function close() {
    router.push("/warehouse");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete) return false;
    const next: WarehouseItem = { id: crypto.randomUUID(), name: draft.name.trim(), unit: draft.unit.trim(), stocks: [] };
    savedItems.unshift(next);
    setRows([...savedItems]);
    setDraft({ name: "", unit: "" });
  }

  function addStock(lines: { size: string; quantity: number }[]) {
    if (!adding) return;
    const stocks = lines.reduce((current, line) => addStockLine(current, line.size, line.quantity), adding.stocks);
    const next = savedItems.map((row) => (row.id === adding.id ? { ...row, stocks } : row));
    savedItems.splice(0, savedItems.length, ...next);
    setRows([...savedItems]);
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Noliktava</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Noliktavas preces, mērvienības un atlikums pa izmēriem.</p>
        </div>
        <button type="button" onClick={() => router.push("/warehouse/new")} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34]">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Pievienot
        </button>
      </div>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Noliktavā vēl nekā nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{row.name}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">{row.unit}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAddingId(row.id)}
                    className="min-w-9 rounded-lg px-2 py-1 text-base font-semibold tabular-nums text-[#1a6b4a] hover:bg-[#e7f6ec]"
                    aria-label="Pievienot atlikumu"
                  >
                    {stockTotal(row.stocks)}
                  </button>
                  <Tooltip text="Atlikums">
                    <button
                      type="button"
                      onClick={() => setBreakdownId(row.id)}
                      className="grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]"
                      aria-label="Atlikums"
                    >
                      <Info className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {open ? (
        <RightDrawer
          title="Pievienot preci"
          hint="Priekšskats. Saglabāšana vēl nav pieslēgta."
          onClose={close}
          onSubmit={submit}
          footer={(dismiss) => (
            <>
              <button type="button" onClick={dismiss} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
                <X className="size-4 shrink-0" aria-hidden="true" />
                Atcelt
              </button>
              <button
                type="submit"
                disabled={!complete}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                Pievienot
              </button>
            </>
          )}
        >
          <label className="block text-sm font-medium">
            Nosaukums
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className={fieldClass}
              placeholder="Piemēram, skrūves"
            />
          </label>
          <label className="block text-sm font-medium">
            Mērvienība
            <input
              value={draft.unit}
              onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
              className={fieldClass}
              placeholder="gab."
            />
          </label>
        </RightDrawer>
      ) : null}
      {adding ? <StockAddModal onClose={() => setAddingId(null)} onAdd={addStock} /> : null}
      {breakdown ? <StockBreakdownModal lines={breakdown.stocks} unit={breakdown.unit} onClose={() => setBreakdownId(null)} /> : null}
    </div>
  );
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
