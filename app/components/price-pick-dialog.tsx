"use client";

import { CenterDialog } from "@/app/components/stock-modals";
import { NewPricePositionDrawer } from "@/app/components/new-price-position-drawer";
import { Tooltip } from "@/app/components/tooltip";
import { unitsMatch, type OfferMaterial } from "@/app/lib/offers/model";
import {
  formatUnitPrice,
  kindLabel,
  latestEntry,
  parseDecimal,
  type PricePosition,
  type PriceRole,
} from "@/app/lib/prices/model";
import { Check, Plus, X } from "lucide-react";
import { useState } from "react";

export type MechanismBreakdown = {
  name: string;
  detail: string;
};

export function PricePickDialog({
  role,
  cards,
  breakdown,
  onApply,
  onClear,
  onCreated,
  onClose,
}: {
  role: PriceRole;
  cards: PricePosition[];
  breakdown: MechanismBreakdown | null;
  onApply: (card: PricePosition | null, unitPrice: number) => void;
  onClear: () => void;
  onCreated: () => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const words = query.trim().toLocaleLowerCase("lv").split(/\s+/).filter(Boolean);
  const visible = words.length === 0
    ? []
    : cards
        .filter((card) => words.every((word) => `${card.name} ${card.unit} ${kindLabel(card.kind)}`.toLocaleLowerCase("lv").includes(word)))
        .sort((a, b) => a.name.localeCompare(b.name, "lv"));

  function applyCard(card: PricePosition) {
    onApply(card, latestEntry(card)?.unitPrice ?? 0);
  }

  function applyManual() {
    const value = parseDecimal(manual);
    if (value == null || value < 0) {
      setError("Ievadi cenu.");
      return;
    }
    onApply(null, value);
  }

  return (
    <CenterDialog title="Mehānisms" onClose={onClose}>
      <div className="relative">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Sāc rakstīt nosaukumu"
        className={fieldClass}
      />
      {words.length > 0 ? (
      <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-[#d3e4da] bg-white p-1 shadow-lg">
        {visible.length === 0 ? <p className="px-1 py-3 text-sm text-[#5f756a]">Nekas neatbilst meklēšanai.</p> : null}
        {visible.map((card) => {
          const entry = latestEntry(card);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => applyCard(card)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#f4faf6]"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{card.name}</span>
                <span className="block text-xs text-[#5f756a]">
                  {kindLabel(card.kind)}
                  {card.unit ? ` · ${card.unit}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums">{entry ? formatUnitPrice(entry.unitPrice) : "—"}</span>
            </button>
          );
        })}
      </div>
      ) : null}
      </div>
      {breakdown ? (
        <div className="mt-3 rounded-xl bg-[#f4faf6] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{breakdown.name}</p>
              <p className="text-sm tabular-nums text-[#5f756a]">{breakdown.detail}</p>
            </div>
            <RemoveButton onClick={onClear} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#5f756a]">Vēl nav izvēlēta mehānisma.</p>
      )}
      <div className="mt-4 flex items-end gap-2">
        <label className="block min-w-0 flex-1 text-sm font-medium">
          Cena bez kartītes
          <input
            value={manual}
            inputMode="decimal"
            onChange={(event) => setManual(event.target.value.replace(/[^\d,.\s-]/g, ""))}
            className={fieldClass}
            placeholder="0,00"
          />
        </label>
        <button type="button" onClick={applyManual} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#1a6b4a]">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Lietot
        </button>
      </div>
      <button type="button" onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1a6b4a]">
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        Jauna kartīte
      </button>
      {creating ? (
        <NewPricePositionDrawer
          initialRole={role}
          onClose={() => setCreating(false)}
          onSaved={async (card) => {
            await onCreated();
            if (card.role === role) applyCard(card);
          }}
        />
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
      <p className="mt-3 text-xs text-[#5f756a]">Likme reizinās ar rindas laika normu. Vēlāka rēķina cena šo likmi nemaina.</p>
    </CenterDialog>
  );
}

export function MaterialLinesDialog({
  positionUnit,
  lines,
  cards,
  onChange,
  onCreated,
  onClose,
}: {
  positionUnit: string;
  lines: OfferMaterial[];
  cards: PricePosition[];
  onChange: (lines: OfferMaterial[]) => void;
  onCreated: () => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const words = query.trim().toLocaleLowerCase("lv").split(/\s+/).filter(Boolean);
  const chosen = new Set(lines.map((line) => line.catalogId));
  const hints = words.length === 0
    ? []
    : cards
        .filter((card) => !chosen.has(card.id))
        .filter((card) => words.every((word) => `${card.name} ${card.unit}`.toLocaleLowerCase("lv").includes(word)))
        .sort((a, b) => a.name.localeCompare(b.name, "lv"));
  const sum = lines.reduce((total, line) => total + lineAmount(line), 0);

  function addCard(card: PricePosition, price: number) {
    onChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        catalogId: card.id,
        name: card.name,
        unit: card.unit,
        unitPrice: formatUnitPrice(price),
        consumption: unitsMatch(card.unit, positionUnit) ? "1" : "",
        acknowledgedPriceId: latestEntry(card)?.id ?? "",
      },
    ]);
    setQuery("");
    setError("");
  }

  function pick(card: PricePosition) {
    addCard(card, latestEntry(card)?.unitPrice ?? 0);
  }

  return (
    <CenterDialog title="Materiāli" wide onClose={onClose}>
      <div className="relative">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Sāc rakstīt materiālu"
        className={fieldClass}
      />
      {words.length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[#d3e4da] bg-white p-1 shadow-lg">
          {hints.length === 0 ? <p className="px-1 py-2 text-sm text-[#5f756a]">Nekas neatbilst meklēšanai.</p> : null}
          {hints.map((card) => {
            const entry = latestEntry(card);
            return (
              <button key={card.id} type="button" onClick={() => pick(card)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#f4faf6]">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{card.name}</span>
                  <span className="block text-xs text-[#5f756a]">{card.unit || "—"}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">{entry ? formatUnitPrice(entry.unitPrice) : "—"}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      </div>
      {lines.length === 0 ? <p className="mt-3 text-sm text-[#5f756a]">Vēl nav izvēlētu materiālu.</p> : null}
      <ul className="mt-3 space-y-2">
        {lines.map((line) => {
          const differs = !unitsMatch(line.unit, positionUnit);
          return (
            <li key={line.id} className="rounded-xl bg-[#f4faf6] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-xs text-[#5f756a]">
                    {line.unit || "—"} · {line.unitPrice}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`consumption-${line.id}`}>
                  Patēriņš
                </label>
                <span className={consumptionRow}>
                  <input
                    id={`consumption-${line.id}`}
                    value={line.consumption}
                    inputMode="decimal"
                    aria-label="Patēriņš"
                    onChange={(event) =>
                      onChange(lines.map((item) => (item.id === line.id ? { ...item, consumption: event.target.value.replace(/[^\d,.\s-]/g, "") } : item)))
                    }
                    className={suffixInput}
                    placeholder={differs ? "Obligāti" : "1"}
                  />
                  <span className={suffixLabel}>{consumptionUnits(line.unit, positionUnit)}</span>
                </span>
                <RemoveButton onClick={() => onChange(lines.filter((item) => item.id !== line.id))} />
              </div>
              {differs && line.consumption.trim() === "" ? (
                <p className="mt-1 text-xs text-[#b42318]">Mērvienības nesakrīt. Norādi patēriņu.</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {lines.length > 0 ? <p className="mt-3 text-sm font-semibold">Kopā {formatUnitPrice(sum)}</p> : null}
      <button type="button" onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1a6b4a]">
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        Jauna kartīte
      </button>
      {creating ? (
        <NewPricePositionDrawer
          initialRole="material"
          onClose={() => setCreating(false)}
          onSaved={async (card) => {
            await onCreated();
            if (card.role === "material") addCard(card, 0);
          }}
        />
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
      <p className="mt-3 text-xs text-[#5f756a]">Vairāku materiālu cenas summējas. Patēriņu var norādīt arī tad, ja mērvienības sakrīt.</p>
    </CenterDialog>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip text="Noņemt">
      <button type="button" aria-label="Noņemt" onClick={onClick} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#b42318] hover:bg-[#fdeceb]">
        <X className="size-4" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function lineAmount(line: OfferMaterial) {
  if (line.consumption.trim() === "") return 0;
  const consumption = Number(line.consumption.replace(/\s/g, "").replace(",", "."));
  const price = Number(line.unitPrice.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(consumption) || !Number.isFinite(price)) return 0;
  return Math.round((consumption * price + Number.EPSILON) * 100) / 100;
}

function consumptionUnits(materialUnit: string, positionUnit: string) {
  const material = materialUnit.trim();
  const position = positionUnit.trim();
  if (material && position) return `${material}/${position}`;
  return material || position || "—";
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";

const consumptionRow =
  "flex h-9 w-36 shrink-0 overflow-hidden rounded-lg border border-[#c5d9cd] bg-white focus-within:border-[#1a6b4a] focus-within:ring-4 focus-within:ring-[#1a6b4a]/15";

const suffixInput = "min-w-0 flex-1 bg-transparent px-3 font-normal outline-none";

const suffixLabel = "grid shrink-0 place-items-center whitespace-nowrap bg-[#f4faf6] px-3 text-sm font-normal text-[#5f756a]";
