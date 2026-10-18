"use client";

import { emptyPrice, PriceEntryForm, type PriceDraft } from "@/app/components/price-entry-form";
import { RightDrawer } from "@/app/components/right-drawer";
import { useInvoices } from "@/app/components/invoice-state";
import { todayIso, type Invoice } from "@/app/lib/invoices/model";
import { parseDecimal, PRICE_ROLES, type PriceEntry, type PricePosition, type PriceRole } from "@/app/lib/prices/model";
import { addPriceEntry, savePricePosition } from "@/app/lib/prices/repository";
import { Check, Cog, Package, Plus, X } from "lucide-react";
import { FormEvent, useState } from "react";

export function NewPricePositionDrawer({
  initialRole = "material",
  position,
  onClose,
  onSaved,
}: {
  initialRole?: PriceRole;
  position?: PricePosition;
  onClose: () => void;
  onSaved: (card: PricePosition) => void | Promise<void>;
}) {
  const { invoices } = useInvoices();
  const [role, setRole] = useState<PriceRole>(position?.role ?? initialRole);
  const [name, setName] = useState(position?.name ?? "");
  const [unit, setUnit] = useState(position?.unit ?? "");
  const [withPrice, setWithPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState<PriceDraft>(emptyPrice());
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [savedId, setSavedId] = useState<string | null>(position?.id ?? null);
  const [error, setError] = useState("");
  const creating = !position;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !unit.trim()) {
      setError("Norādi nosaukumu un mērvienību.");
      return false;
    }
    const price = parseDecimal(priceDraft.price);
    if (creating && withPrice && (price == null || price < 0)) {
      setError("Norādi cenu.");
      return false;
    }
    const saved = await savePricePosition({
      id: savedId ?? undefined,
      name,
      unit,
      kind: position?.kind ?? "shop",
      role,
    });
    if (!saved.ok) {
      setError(saved.message);
      return false;
    }
    setSavedId(saved.id);
    let entries: PriceEntry[] = position?.entries ?? [];
    if (creating && withPrice && price != null) {
      const added = await addPriceEntry({
        positionId: saved.id,
        pricedOn: todayIso(new Date()),
        quantity: 0,
        unitPrice: price,
        supplier: priceDraft.client.trim(),
        invoiceId: priceDraft.invoiceId || null,
        document: priceDraft.number.trim(),
      });
      if (!added.ok) {
        setError(added.message);
        return false;
      }
      entries = [priceEntry(price, priceDraft)];
    }
    await onSaved({
      id: saved.id,
      name: name.trim(),
      unit: unit.trim(),
      kind: position?.kind ?? "shop",
      role,
      entries,
    });
  }

  return (
    <RightDrawer
      front
      title={position ? "Labot pozīciju" : "Jauna pozīcija"}
      hint=""
      onClose={onClose}
      beforeClose={() => {
        if (!preview) return true;
        setPreview(null);
        return false;
      }}
      onSubmit={submit}
      footer={(dismiss) => (
        <>
          <button type="button" onClick={dismiss} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
            <X className="size-4 shrink-0" aria-hidden="true" />
            Aizvērt
          </button>
          <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34]">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            Saglabāt
          </button>
        </>
      )}
    >
      <div className="flex rounded-2xl bg-[#e7f2eb] p-1" role="radiogroup" aria-label="Loma">
        {PRICE_ROLES.map((item) => {
          const selected = role === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setRole(item.id)}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${selected ? "bg-white text-[#143028] shadow-sm" : "text-[#5f756a]"}`}
            >
              {item.id === "material" ? <Package className="size-4 shrink-0" aria-hidden="true" /> : <Cog className="size-4 shrink-0" aria-hidden="true" />}
              {item.label}
            </button>
          );
        })}
      </div>
      <label className="block text-sm font-medium">
        Nosaukums
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Smilts" />
      </label>
      <label className="block text-sm font-medium">
        Mērvienība
        <input value={unit} onChange={(event) => setUnit(event.target.value)} className={fieldClass} placeholder="m³" />
      </label>
      {creating && !withPrice ? (
        <button type="button" onClick={() => setWithPrice(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a6b4a]">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Pievienot cenu
        </button>
      ) : null}
      {creating && withPrice ? (
        <div className="space-y-4 border-t border-[#d3e4da] pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Pievienot cenu</p>
            <button
              type="button"
              onClick={() => {
                setWithPrice(false);
                setPriceDraft(emptyPrice());
                setPreview(null);
                setError("");
              }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f756a]"
            >
              <X className="size-4 shrink-0" aria-hidden="true" />
              Atcelt
            </button>
          </div>
          <PriceEntryForm
            draft={priceDraft}
            invoices={invoices}
            preview={preview}
            previewFront
            onChange={setPriceDraft}
            onPreview={setPreview}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
    </RightDrawer>
  );
}

function priceEntry(price: number, draft: PriceDraft): PriceEntry {
  return {
    id: "",
    pricedOn: todayIso(new Date()),
    quantity: 0,
    unitPrice: price,
    supplier: draft.client.trim(),
    invoiceId: draft.invoiceId || null,
    invoiceNumber: "",
    document: draft.number.trim(),
    createdAt: new Date().toISOString(),
  };
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
