"use client";

import { RightDrawer } from "@/app/components/right-drawer";
import { Plus, X } from "lucide-react";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type StockLine = { size: string; quantity: number };

export function stockTotal(lines: StockLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function addStockLine(lines: StockLine[], size: string, quantity: number) {
  const name = size.trim();
  const index = lines.findIndex((line) => line.size.toLowerCase() === name.toLowerCase());
  if (index < 0) return [...lines, { size: name, quantity }];
  return lines.map((line, lineIndex) => (lineIndex === index ? { ...line, quantity: line.quantity + quantity } : line));
}

export function takeStock(lines: StockLine[], requests: { size: string; count: number }[]) {
  const next = lines.map((line) => ({ ...line }));
  for (const request of requests) {
    const line = next.find((item) => item.size === request.size);
    if (!line || line.quantity < request.count) return null;
    line.quantity -= request.count;
  }
  return next;
}

type StockDraft = { key: string; size: string; quantity: string };

export function StockAddModal({
  onClose,
  onAdd,
  warnDuplicateSizes = false,
  side = false,
}: {
  onClose: () => void;
  onAdd: (lines: { size: string; quantity: number }[]) => void | false | Promise<void | false>;
  warnDuplicateSizes?: boolean;
  side?: boolean;
}) {
  const [rows, setRows] = useState<StockDraft[]>(() => [emptyStockDraft()]);
  const duplicates = warnDuplicateSizes ? duplicateSizeKeys(rows) : new Set<string>();
  const chosen = rows.filter((row) => isCompleteStockDraft(row) && !duplicates.has(row.key));

  function update(key: string, patch: Partial<StockDraft>) {
    setRows((current) => {
      const next = current.map((row) => (row.key === key ? { ...row, ...patch } : row));
      const last = next[next.length - 1];
      if (last && isCompleteStockDraft(last)) return [...next, emptyStockDraft()];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) return false;
    const result = await onAdd(chosen.map((row) => ({ size: row.size.trim(), quantity: Number(row.quantity) })));
    if (result === false) return false;
    if (!side) onClose();
  }

  const fields = (
    <div className="space-y-3">
      {rows.map((row) => {
        const duplicate = duplicates.has(row.key);
        return (
          <div key={row.key} className="grid grid-cols-2 items-start gap-3">
            <label className="block text-sm font-medium">
              Izmērs
              <input
                value={row.size}
                onChange={(event) => update(row.key, { size: event.target.value })}
                className={duplicate ? fieldErrorClass : fieldClass}
                placeholder="Piemēram, M"
                aria-invalid={duplicate}
              />
              {duplicate ? <span className="mt-1 block text-xs font-normal text-[#b42318]">Šāds izmērs jau ir iepriekš norādīts.</span> : null}
            </label>
            <label className="block text-sm font-medium">
              Skaits
              <input
                value={row.quantity}
                inputMode="numeric"
                onChange={(event) => update(row.key, { quantity: event.target.value.replace(/\D/g, "").slice(0, 6) })}
                className={fieldClass}
                placeholder="1"
              />
            </label>
          </div>
        );
      })}
    </div>
  );

  const actions = (close: () => void) => (
    <>
      <button type="button" onClick={close} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
        <X className="size-4 shrink-0" aria-hidden="true" />
        Atcelt
      </button>
      <button
        type="submit"
        disabled={chosen.length === 0}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
      >
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        Pievienot
      </button>
    </>
  );

  if (side) {
    return (
      <RightDrawer title="Pievienot atlikumu" hint="" onClose={onClose} onSubmit={submit} footer={actions}>
        {fields}
      </RightDrawer>
    );
  }

  return (
    <CenterDialog title="Pievienot atlikumu" onClose={onClose}>
      <form onSubmit={submit}>
        {fields}
        <div className="mt-6 flex justify-end gap-2">{actions(onClose)}</div>
      </form>
    </CenterDialog>
  );
}

function emptyStockDraft(): StockDraft {
  return { key: crypto.randomUUID(), size: "", quantity: "" };
}

function isCompleteStockDraft(row: StockDraft) {
  const amount = Number(row.quantity);
  return row.size.trim() !== "" && Number.isInteger(amount) && amount >= 1;
}

function duplicateSizeKeys(rows: StockDraft[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const name = row.size.trim().toLowerCase();
    if (!name) continue;
    if (seen.has(name)) duplicates.add(row.key);
    else seen.add(name);
  }
  return duplicates;
}

export function StockBreakdownModal({
  lines,
  unit,
  onClose,
  side = false,
}: {
  lines: StockLine[];
  unit?: string;
  onClose: () => void;
  side?: boolean;
}) {
  const body = (
    <>
      {lines.length === 0 ? (
        <p className="text-sm text-[#5f756a]">Atlikuma vēl nav.</p>
      ) : (
        <ul className="divide-y divide-[#e4efe8] rounded-2xl border border-[#d3e4da]">
          {lines.map((line) => (
            <li key={line.size} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">{line.size}</span>
              <span className="tabular-nums text-[#5f756a]">
                {line.quantity}
                {unit ? ` ${unit}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  const closeButton = (close: () => void) => (
    <button type="button" onClick={close} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
      <X className="size-4 shrink-0" aria-hidden="true" />
      Aizvērt
    </button>
  );
  if (side) {
    return (
      <RightDrawer title="Atlikums" hint="" onClose={onClose} footer={closeButton}>
        {body}
      </RightDrawer>
    );
  }
  return (
    <CenterDialog title="Atlikums" onClose={onClose}>
      {body}
      <div className="mt-6 flex justify-end">{closeButton(onClose)}</div>
    </CenterDialog>
  );
}

export function CenterDialog({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.querySelector("[data-drawer-front]")) return;
        event.stopImmediatePropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#12382c]/35 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[min(640px,calc(100%-2rem))] w-full overflow-y-auto rounded-3xl bg-white p-6 text-[#143028] shadow-2xl ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#5f756a]" aria-label="Aizvērt">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";

const fieldErrorClass =
  "mt-2 h-11 w-full rounded-xl border border-[#b42318] bg-white px-3 font-normal text-[#b42318] outline-none focus:border-[#b42318] focus:ring-4 focus:ring-[#b42318]/15";
