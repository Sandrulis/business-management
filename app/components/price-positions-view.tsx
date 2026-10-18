"use client";

import { NewPricePositionDrawer } from "@/app/components/new-price-position-drawer";
import { ConfirmModal } from "@/app/components/confirm-modal";
import { emptyPrice, PriceEntryForm, type PriceDraft } from "@/app/components/price-entry-form";
import { InvoicePreviewModal } from "@/app/components/invoice-preview-modal";
import { RightDrawer } from "@/app/components/right-drawer";
import { useInvoices } from "@/app/components/invoice-state";
import { Tooltip } from "@/app/components/tooltip";
import { formatDate, todayIso, type Invoice } from "@/app/lib/invoices/model";
import { formatUnitPrice, latestEntry, parseDecimal, roleLabel, type PriceEntry, type PricePosition } from "@/app/lib/prices/model";
import { addPriceEntry, deletePricePosition, loadPriceCatalog } from "@/app/lib/prices/repository";
import { BadgeEuro, Check, FileText, Info, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

export function PricePositionsView({
  initial,
  loadError,
}: {
  initial: PricePosition[];
  loadError: string | null;
}) {
  const { notify, invoices } = useInvoices();
  const [positions, setPositions] = useState(initial);
  const [editing, setEditing] = useState<PricePosition | "new" | null>(null);
  const [removing, setRemoving] = useState<PricePosition | null>(null);
  const [pricing, setPricing] = useState<PricePosition | null>(null);
  const [priceDraft, setPriceDraft] = useState<PriceDraft>(emptyPrice());
  const [priceError, setPriceError] = useState("");
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const history = positions.find((position) => position.id === historyId) ?? null;

  async function refresh() {
    const loaded = await loadPriceCatalog();
    if (!loaded.ok) {
      notify(loaded.message, "error");
      return;
    }
    setPositions(loaded.positions);
  }

  function openPrice(position: PricePosition) {
    setPriceDraft(emptyPrice());
    setPriceError("");
    setPreview(null);
    setPricing(position);
  }

  async function submitPrice(): Promise<false | void> {
    if (!pricing) return false;
    const price = parseDecimal(priceDraft.price);
    if (price == null || price < 0) {
      setPriceError("Norādi cenu.");
      return false;
    }
    const added = await addPriceEntry({
      positionId: pricing.id,
      pricedOn: todayIso(new Date()),
      quantity: 0,
      unitPrice: price,
      supplier: priceDraft.client.trim(),
      invoiceId: priceDraft.invoiceId || null,
      document: priceDraft.number.trim(),
    });
    if (!added.ok) {
      setPriceError(added.message);
      return false;
    }
    await refresh();
    notify("Cena pievienota.", "ok");
    setPricing(null);
    return false;
  }

  async function remove() {
    if (!removing) return;
    const result = await deletePricePosition(removing.id);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    setRemoving(null);
    if (historyId === removing.id) setHistoryId(null);
    if (editing && editing !== "new" && editing.id === removing.id) setEditing(null);
    await refresh();
    notify("Pozīcija dzēsta.", "ok");
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pozīciju cenas</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
            Pozīcija ir materiāls vai mehānisms ar nosaukumu un mērvienību.
          </p>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34]">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Pievienot
        </button>
      </div>
      {loadError ? <p className="mt-4 text-sm text-[#b42318]">{loadError}</p> : null}
      <section className="mt-8 overflow-x-auto rounded-3xl border border-[#d3e4da] bg-white">
        {positions.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Vēl nav pozīciju cenu.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#f4faf6] text-left text-xs text-[#5f756a]">
              <tr>
                <th className="px-5 py-3 font-medium">Nosaukums</th>
                <th className="px-3 py-3 font-medium">Loma</th>
                <th className="px-3 py-3 text-right font-medium">Pēdējā cena</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const latest = latestEntry(position);
                const company = latest?.supplier.trim() ?? "";
                return (
                  <tr key={position.id} className="border-t border-[#e4efe8]">
                    <td className="px-5 py-3">
                      <p className="font-medium">{position.name}</p>
                      <p className="mt-0.5 text-xs text-[#5f756a]">{position.unit || "—"}</p>
                    </td>
                    <td className="px-3 py-3">{roleLabel(position.role)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <p>{latest ? formatUnitPrice(latest.unitPrice) : "—"}</p>
                      {company ? <p className="mt-0.5 text-xs font-normal text-[#5f756a]">{company}</p> : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Tooltip text="Pievienot cenu">
                          <button type="button" aria-label="Pievienot cenu" onClick={() => openPrice(position)} className={iconButton}>
                            <BadgeEuro className="size-4" aria-hidden="true" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Vēsture">
                          <button type="button" aria-label="Vēsture" onClick={() => setHistoryId(position.id)} className={iconButton}>
                            <Info className="size-4" aria-hidden="true" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Labot">
                          <button type="button" aria-label="Labot" onClick={() => setEditing(position)} className={iconButton}>
                            <Pencil className="size-4" aria-hidden="true" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Dzēst">
                          <button type="button" aria-label="Dzēst" onClick={() => setRemoving(position)} className={`${iconButton} text-[#b42318] hover:bg-[#fdeceb]`}>
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {editing ? (
        <NewPricePositionDrawer
          position={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            notify("Pozīcija saglabāta.", "ok");
          }}
        />
      ) : null}
      {pricing ? (
        <RightDrawer
          title="Pievienot cenu"
          hint={pricing.name}
          onClose={() => {
            setPreview(null);
            setPricing(null);
          }}
          beforeClose={() => {
            if (!preview) return true;
            setPreview(null);
            return false;
          }}
          onSubmit={submitPrice}
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
          <PriceEntryForm
            draft={priceDraft}
            invoices={invoices}
            preview={preview}
            previewBeside={440}
            autoFocus
            onChange={setPriceDraft}
            onPreview={setPreview}
          />
          {priceError ? <p className="text-sm text-[#b42318]">{priceError}</p> : null}
        </RightDrawer>
      ) : null}
      {history ? <PriceHistoryModal position={history} onClose={() => setHistoryId(null)} /> : null}
      {removing ? (
        <ConfirmModal
          title="Dzēst pozīciju?"
          text={removing.name.trim() ? `Dzēst „${removing.name.trim()}” un tās cenas?` : "Dzēst šo pozīciju un tās cenas?"}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </div>
  );
}

function PriceHistoryModal({ position, onClose }: { position: PricePosition; onClose: () => void }) {
  const { invoices } = useInvoices();
  const [preview, setPreview] = useState<Invoice | null>(null);
  const now = Date.now();
  const groups = priceHistoryGroups(position.entries, invoices, now);
  return (
    <>
    <RightDrawer
      title="Vēsture"
      hint={position.name}
      onClose={onClose}
      footer={(close) => (
        <button type="button" onClick={close} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
          <X className="size-4 shrink-0" aria-hidden="true" />
          Aizvērt
        </button>
      )}
    >
      {groups.length === 0 ? (
        <p className="text-sm text-[#5f756a]">Šai pozīcijai vēl nav cenu.</p>
      ) : (
        <div>
          {groups.map((group) => (
            <section key={group.label} className="mb-5 last:mb-0">
              <h3 className="mb-3 text-[11px] font-semibold tracking-wide text-[#5f756a] uppercase">{group.label}</h3>
              <ol>
                {group.items.map((entry) => {
                  const hasFile = Boolean(entry.invoice?.storagePath && entry.invoice.fileName);
                  return (
                    <li key={entry.id} className="group relative pb-5 pl-5 last:pb-0">
                      <span className="absolute top-3 bottom-0 left-[4px] w-px bg-[#d3e4da] group-last:hidden" aria-hidden="true" />
                      <span className="absolute top-1 left-0 size-2.5 rounded-full bg-[#1a6b4a] ring-4 ring-white" aria-hidden="true" />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-[#1a6b4a] tabular-nums">{entry.price}</p>
                          {entry.detail ? <p className="text-sm text-[#5f756a]">{entry.detail}</p> : null}
                          <p className="mt-0.5 font-mono text-[11px] text-[#5f756a]">
                            {formatClock(entry.at)} · {formatRelative(entry.at, now)}
                          </p>
                        </div>
                        {entry.invoice ? (
                          <Tooltip text={hasFile ? "Apskatīt" : "Fails nav saglabāts"}>
                            <button
                              type="button"
                              aria-label={hasFile ? "Apskatīt" : "Fails nav saglabāts"}
                              disabled={!hasFile}
                              onClick={() => setPreview(entry.invoice)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-[#1a6b4a] hover:bg-[#e7f6ec] disabled:text-[#c5d8cc]"
                            >
                              <FileText className="size-4" aria-hidden="true" />
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
      {preview?.storagePath && preview.fileName ? (
        <InvoicePreviewModal
          front
          src={`/api/invoices/${preview.id}/file`}
          name={preview.fileName}
          mime={preview.fileMime}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </RightDrawer>
    </>
  );
}

function priceHistoryGroups(entries: PriceEntry[], invoices: Invoice[], now: number) {
  const items = [...entries]
    .map((entry) => {
      const parsed = Date.parse(entry.createdAt);
      const at = Number.isNaN(parsed) ? Date.parse(`${entry.pricedOn}T12:00:00`) : parsed;
      const invoice = entry.invoiceId ? invoices.find((item) => item.id === entry.invoiceId) ?? null : null;
      const reference = entry.document || entry.invoiceNumber || invoice?.number || "";
      return {
        id: entry.id,
        at,
        price: formatUnitPrice(entry.unitPrice),
        detail: [entry.supplier.trim(), reference.trim()].filter(Boolean).join(" · "),
        invoice,
      };
    })
    .filter((entry) => !Number.isNaN(entry.at))
    .sort((a, b) => b.at - a.at);
  const groups: { label: string; items: typeof items }[] = [];
  for (const item of items) {
    const label = dayLabel(item.at, now);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [item] });
    else last.items.push(item);
  }
  return groups;
}

function dayLabel(timestamp: number, now: number) {
  const date = new Date(timestamp);
  const current = new Date(now);
  if (sameDay(date, current)) return "Šodien";
  const yesterday = new Date(current);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(date, yesterday)) return "Vakar";
  return formatDate(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
}

function formatClock(timestamp: number) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelative(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return "tikko";
  if (minutes < 60) return `pirms ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `pirms ${hours} st.`;
  const days = Math.round(hours / 24);
  if (days === 1) return "vakar";
  return `pirms ${days} d.`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

const iconButton = "grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]";
