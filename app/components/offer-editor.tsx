"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { useInvoices } from "@/app/components/invoice-state";
import { MaterialLinesDialog, PricePickDialog, type MechanismBreakdown } from "@/app/components/price-pick-dialog";
import { RightDrawer } from "@/app/components/right-drawer";
import { Tooltip } from "@/app/components/tooltip";
import { formatMoney } from "@/app/lib/invoices/model";
import {
  copyOfferExtra,
  emptyGroup,
  emptyOfferDocument,
  emptyOfferExtra,
  emptyPosition,
  hasAmount,
  moveOfferNode,
  offerPriceUpdates,
  parseAmount,
  type OfferExtra,
  type OfferPriceUpdate,
  positionPrices,
  profitFactor,
  sumPrices,
  type OfferDocument,
  type OfferGroup,
  type OfferNode,
  type OfferPosition,
  type OfferPrices,
} from "@/app/lib/offers/model";
import { loadOffer, loadOfferDocuments, saveOffer } from "@/app/lib/offers/repository";
import { formatUnitPrice, latestEntry, type InvoiceOption, type PricePosition, type PriceRole } from "@/app/lib/prices/model";
import { loadPriceCatalog } from "@/app/lib/prices/repository";
import type { Site } from "@/app/lib/invoices/model";
import { Check, ChevronDown, ChevronRight, Copy, Eye, EyeOff, FolderPlus, GripVertical, Lock, Plus, Trash2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PriceCatalogContext = createContext<{ cards: PricePosition[]; invoices: InvoiceOption[]; reload: () => Promise<void> } | null>(null);
const OfferCalcContext = createContext({ factor: 1, hourlyRate: "" });
const OfferLockContext = createContext(false);

function useOfferLocked() {
  return useContext(OfferLockContext);
}

export function OfferEditor({ site, onClose, onReady }: { site: Site; onClose: () => void; onReady: () => void }) {
  const { settings, sites } = useInvoices();
  const [offer, setOffer] = useState<OfferDocument | null>(null);
  const [status, setStatus] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [removing, setRemoving] = useState<{ extraId: string | null; group: OfferGroup } | null>(null);
  const [fixing, setFixing] = useState<{ extraId: string | null } | null>(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [preview, setPreview] = useState<{ customer: string; number: number; extra: OfferExtra } | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [columnWidths, setColumnWidths] = useState<OfferColumnWidths>(OFFER_COLUMN_DEFAULTS);
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;
  const [cards, setCards] = useState<PricePosition[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const reloadPrices = useCallback(async () => {
    const loaded = await loadPriceCatalog();
    if (!loaded.ok) return;
    setCards(loaded.positions);
    setInvoices(loaded.invoices);
  }, []);
  const savedRef = useRef("");
  const offerRef = useRef<OfferDocument | null>(null);
  const timerRef = useRef<number | null>(null);
  const onReadyRef = useRef(onReady);
  const savingRef = useRef(false);
  const pendingRef = useRef<OfferDocument | null>(null);
  onReadyRef.current = onReady;
  offerRef.current = offer;
  const locked = Boolean(offer?.fixedAt);
  const extraDraftOpen = offer?.extras.some((extra) => !extra.fixedAt) ?? false;

  useLayoutEffect(() => {
    setColumnWidths(readColumnWidths());
  }, []);

  function resizeColumn(column: OfferColumn, width: number, persist: boolean) {
    const next = { ...columnWidthsRef.current, [column]: width };
    columnWidthsRef.current = next;
    setColumnWidths(next);
    if (persist) writeColumnWidths(next);
  }

  useEffect(() => {
    let active = true;
    loadOffer(site.id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setStatus("error");
        setOffer(emptyOfferDocument());
        return;
      }
      savedRef.current = JSON.stringify(result.document);
      setCollapsedIds(readCollapsedIds(site.id));
      setOffer(result.document);
      setStatus("saved");
    });
    return () => {
      active = false;
    };
  }, [site.id]);

  useLayoutEffect(() => {
    setCollapsedIds(readCollapsedIds(site.id));
  }, [site.id]);

  useEffect(() => {
    void reloadPrices();
  }, [reloadPrices]);

  function toggleCollapsed(id: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeCollapsedIds(site.id, next);
      return next;
    });
  }

  const liveRef = useRef(true);
  const scheduleSaveRef = useRef<() => void>(() => {});
  scheduleSaveRef.current = () => {
    if (!liveRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (!liveRef.current) return;
      const latest = offerRef.current;
      if (!latest || JSON.stringify(latest) === savedRef.current) {
        if (!savingRef.current) setStatus("saved");
        return;
      }
      setStatus("saving");
      void flush(site.id, latest, savedRef, pendingRef, savingRef, setStatus, () => onReadyRef.current()).finally(() => {
        const now = offerRef.current;
        if (!liveRef.current || !now || JSON.stringify(now) === savedRef.current) return;
        setStatus("saving");
        scheduleSaveRef.current();
      });
    }, 400);
  };

  useEffect(() => {
    if (!offer) return;
    if (JSON.stringify(offer) === savedRef.current) return;
    setStatus("saving");
    scheduleSaveRef.current();
  }, [offer, site.id]);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [site.id]);

  function close() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    void persistThenClose();
  }

  async function persistThenClose() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      while (savingRef.current) await new Promise((resolve) => window.setTimeout(resolve, 40));
      const current = offerRef.current;
      if (!current || JSON.stringify(current) === savedRef.current) break;
      await flush(site.id, current, savedRef, pendingRef, savingRef, setStatus, () => onReadyRef.current());
    }
    onClose();
  }

  function updateBody(extraId: string | null, next: OfferBody) {
    setOffer((current) => {
      if (!current) return current;
      if (extraId === null) return { ...current, ...next };
      return { ...current, extras: current.extras.map((extra) => (extra.id === extraId ? { ...extra, ...next } : extra)) };
    });
  }

  return (
    <RightDrawer
      title={locked ? "Tāme" : "Piedāvājums"}
      hint={site.customer}
      panelClassName="w-full max-w-none"
      onClose={close}
    >
      <PriceCatalogContext.Provider value={{ cards, invoices, reload: reloadPrices }}>
        {offer ? (
          <OfferSheet
            body={offer}
            hourlyRate={settings.offerHourlyRate}
            cards={cards}
            columnWidths={columnWidths}
            onResize={resizeColumn}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
            onChange={(next) => updateBody(null, next)}
            onFix={() => setFixing({ extraId: null })}
            onRemoveGroup={(group) => setRemoving({ extraId: null, group })}
            fixDisabled={status === "loading"}
          />
        ) : null}
        {offer?.extras.map((extra, index) => (
          <section key={extra.id} className="mt-8 space-y-4 border-t border-[#d3e4da] pt-6">
            <h3 className="text-base font-semibold">Papildu darbu tāme {index + 1}</h3>
            <OfferSheet
              body={extra}
              hourlyRate={settings.offerHourlyRate}
              cards={cards}
              columnWidths={columnWidths}
              onResize={resizeColumn}
              collapsedIds={collapsedIds}
              onToggleCollapsed={toggleCollapsed}
              onChange={(next) => updateBody(extra.id, next)}
              onFix={() => setFixing({ extraId: extra.id })}
              onRemoveGroup={(group) => setRemoving({ extraId: extra.id, group })}
              onDiscard={extra.fixedAt ? undefined : () => setDiscardId(extra.id)}
              fixDisabled={status === "loading"}
              showProfit={false}
            />
          </section>
        ))}
        {offer && !extraDraftOpen ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOffer((current) => (current ? { ...current, extras: [...current.extras, emptyOfferExtra(current)] } : current))}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34]"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              Izveidot papildu darbu tāmi
            </button>
            <button
              type="button"
              onClick={() => setCopyOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#c5d9cd] bg-white px-4 text-sm font-semibold text-[#1e3a2f] hover:bg-[#f4faf6]"
            >
              <Copy className="size-4 shrink-0" aria-hidden="true" />
              Kopēt papildu darbu tāmi
            </button>
          </div>
        ) : null}
        <p className="text-right text-sm text-[#5f756a]">{statusText(status)}</p>
        {removing ? (
          <ConfirmModal
            title={removing.group.kind === "category" ? "Dzēst kategoriju?" : "Dzēst subkategoriju?"}
            text={removing.group.name.trim() ? `Dzēst „${removing.group.name.trim()}” un tās saturu?` : "Dzēst šo grupu un tās saturu?"}
            onCancel={() => setRemoving(null)}
            onConfirm={() => {
              const target = removing;
              setOffer((current) => {
                if (!current) return current;
                if (target.extraId === null) return { ...current, groups: removeNode(current.groups, target.group.id) as OfferGroup[] };
                return {
                  ...current,
                  extras: current.extras.map((extra) =>
                    extra.id === target.extraId ? { ...extra, groups: removeNode(extra.groups, target.group.id) as OfferGroup[] } : extra,
                  ),
                };
              });
              setRemoving(null);
            }}
          />
        ) : null}
        {fixing ? (
          <ConfirmModal
            title={fixing.extraId === null ? "Nofiksēt piedāvājumu?" : "Nofiksēt papildu darbu tāmi?"}
            text={
              fixing.extraId === null
                ? "Pēc nofiksēšanas piedāvājums kļūst par tāmi. Cenu izmaiņas vairs nerādīsies, un saturu nevarēs labot."
                : "Pēc nofiksēšanas šo papildu darbu tāmi vairs nevarēs labot, un cenu izmaiņas vairs nerādīsies."
            }
            confirmLabel="Nofiksēt"
            tone="primary"
            onCancel={() => setFixing(null)}
            onConfirm={() => {
              const target = fixing;
              const stamp = new Date().toISOString();
              setOffer((current) => {
                if (!current) return current;
                if (target.extraId === null) return { ...current, fixedAt: stamp };
                return { ...current, extras: current.extras.map((extra) => (extra.id === target.extraId ? { ...extra, fixedAt: stamp } : extra)) };
              });
              setFixing(null);
            }}
          />
        ) : null}
        {discardId ? (
          <ConfirmModal
            title="Noņemt papildu darbu tāmi?"
            text="Šī papildu darbu tāme vēl nav nofiksēta un tiks noņemta."
            confirmLabel="Noņemt"
            onCancel={() => setDiscardId(null)}
            onConfirm={() => {
              const id = discardId;
              setOffer((current) => (current ? { ...current, extras: current.extras.filter((extra) => extra.id !== id) } : current));
              setDiscardId(null);
            }}
          />
        ) : null}
        {copyOpen ? (
          <CopyExtraModal
            sites={sites}
            preview={preview}
            onPreview={setPreview}
            onClose={() => {
              setPreview(null);
              setCopyOpen(false);
            }}
            onCopy={(extra) => {
              setOffer((current) => (current && !current.extras.some((item) => !item.fixedAt) ? { ...current, extras: [...current.extras, copyOfferExtra(extra)] } : current));
              setPreview(null);
              setCopyOpen(false);
            }}
          />
        ) : null}
      </PriceCatalogContext.Provider>
    </RightDrawer>
  );
}

type OfferBody = {
  profitPercent: string;
  profitHidden: boolean;
  fixedAt: string;
  groups: OfferGroup[];
};

function OfferSheet({
  body,
  hourlyRate,
  cards,
  columnWidths,
  onResize,
  collapsedIds,
  onToggleCollapsed,
  onChange,
  onFix,
  onRemoveGroup,
  onDiscard,
  fixDisabled,
  readOnly = false,
  showLock = true,
  showProfit = true,
}: {
  body: OfferBody;
  hourlyRate: string;
  cards: PricePosition[];
  columnWidths: OfferColumnWidths;
  onResize: (column: OfferColumn, width: number, persist: boolean) => void;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapsed: (id: string) => void;
  onChange: (next: OfferBody) => void;
  onFix: () => void;
  onRemoveGroup: (group: OfferGroup) => void;
  onDiscard?: () => void;
  fixDisabled: boolean;
  readOnly?: boolean;
  showLock?: boolean;
  showProfit?: boolean;
}) {
  const locked = readOnly || Boolean(body.fixedAt);
  const factor = profitFactor(body.profitPercent, body.profitHidden);
  const nodes = body.groups;
  const totals = sumPrices(nodes, factor);
  const tableDrag = useRef<TableDragHandlers>({ over: () => {}, drop: () => {} });
  return (
    <OfferLockContext.Provider value={locked}>
      {showProfit || !locked ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showProfit ? (
            <label className="flex items-center gap-2 text-sm font-medium">
              Vēlamā peļņa
              <span className={`flex h-9 w-28 overflow-hidden rounded-xl border border-[#c5d9cd] focus-within:border-[#1a6b4a] focus-within:ring-4 focus-within:ring-[#1a6b4a]/15 ${body.profitHidden ? "bg-[#f4faf6]" : "bg-white"}`}>
                <input
                  value={body.profitPercent}
                  inputMode="decimal"
                  disabled={locked || body.profitHidden}
                  aria-label="Vēlamā peļņa"
                  onChange={(event) => onChange({ ...body, profitPercent: event.target.value.replace(/[^\d,.\s]/g, "") })}
                  className="min-w-0 flex-1 bg-transparent px-3 text-right outline-none disabled:cursor-not-allowed disabled:text-[#8aa396]"
                />
                <span className="grid place-items-center bg-[#f4faf6] px-2.5 text-sm font-normal text-[#5f756a]">%</span>
              </span>
              <Tooltip text={body.profitHidden ? "Rādīt peļņu" : "Paslēpt peļņu"}>
                <button
                  type="button"
                  aria-pressed={body.profitHidden}
                  aria-label={body.profitHidden ? "Rādīt peļņu" : "Paslēpt peļņu"}
                  disabled={locked}
                  onClick={() => onChange({ ...body, profitHidden: !body.profitHidden })}
                  className="grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]"
                >
                  {body.profitHidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </Tooltip>
            </label>
          ) : null}
          {locked ? null : (
            <button
              type="button"
              onClick={() => onChange({ ...body, groups: [...body.groups, emptyGroup("category")] })}
              className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-3 text-sm font-semibold text-white hover:bg-[#0f4a34]"
            >
              <FolderPlus className="size-4 shrink-0" aria-hidden="true" />
              Kategorija
            </button>
          )}
        </div>
      ) : null}
      {nodes.length === 0 ? (
        <p className="text-sm text-[#5f756a]">Sāc ar kategoriju. Tajā vari pievienot subkategoriju vai uzreiz pozīciju.</p>
      ) : (
        <OfferCalcContext.Provider value={{ factor, hourlyRate }}>
          {!locked && offerPriceUpdates(nodes, cards).length > 0 ? (
            <p className="mb-3 rounded-xl border border-[#f3c1bc] bg-[#fdeceb] px-3 py-2 text-sm text-[#8a1c14]">Pozīcijās ir cenu izmaiņas, kas jāpārskata.</p>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-[#d3e4da]">
            <table className="w-full table-fixed border-collapse text-sm [&_td]:border [&_td]:border-[#d3e4da] [&_th]:border [&_th]:border-[#d3e4da]">
              <colgroup>
                {OFFER_COLUMNS.map((column) => (
                  <col key={column.key} style={{ width: columnShare(columnWidths, columnWidths[column.key]) }} />
                ))}
                <col style={{ width: columnShare(columnWidths, OFFER_ACTION_WIDTH) }} />
              </colgroup>
              <thead className="bg-[#f4faf6] text-xs text-[#5f756a]">
                <tr>
                  <ResizableHead column="name" width={columnWidths.name} onResize={onResize} rowSpan={2} className="px-2 py-2 text-left align-bottom font-medium">
                    Nosaukums
                  </ResizableHead>
                  <ResizableHead column="unit" width={columnWidths.unit} onResize={onResize} rowSpan={2} className={`${headFit} align-bottom`}>
                    Mērv.
                  </ResizableHead>
                  <ResizableHead column="quantity" width={columnWidths.quantity} onResize={onResize} rowSpan={2} className={`${headFit} align-bottom`}>
                    Daudzums
                  </ResizableHead>
                  <th colSpan={6} className={groupHead}>
                    Vienības cena
                  </th>
                  <th colSpan={4} className={groupHead}>
                    Apjoma cena
                  </th>
                  <th rowSpan={2} />
                </tr>
                <tr>
                  <ResizableHead column="time" width={columnWidths.time} onResize={onResize} className={headWrap}>
                    Laika norma (c/h)
                  </ResizableHead>
                  <ResizableHead column="rate" width={columnWidths.rate} onResize={onResize} className={headWrap}>
                    Likme EUR/h
                  </ResizableHead>
                  <ResizableHead column="laborUnit" width={columnWidths.laborUnit} onResize={onResize} className={headFit}>Darbs</ResizableHead>
                  <ResizableHead column="materialUnit" width={columnWidths.materialUnit} onResize={onResize} className={headFit}>Materiāli</ResizableHead>
                  <ResizableHead column="mechanismUnit" width={columnWidths.mechanismUnit} onResize={onResize} className={headFit}>Mehānismi</ResizableHead>
                  <ResizableHead column="unitTotal" width={columnWidths.unitTotal} onResize={onResize} className={headFit}>Kopā</ResizableHead>
                  <ResizableHead column="laborVolume" width={columnWidths.laborVolume} onResize={onResize} className={headFit}>Darbs</ResizableHead>
                  <ResizableHead column="materialVolume" width={columnWidths.materialVolume} onResize={onResize} className={headFit}>Materiāli</ResizableHead>
                  <ResizableHead column="mechanismVolume" width={columnWidths.mechanismVolume} onResize={onResize} className={headFit}>Mehānismi</ResizableHead>
                  <ResizableHead column="volumeTotal" width={columnWidths.volumeTotal} onResize={onResize} className={headFit}>Kopā</ResizableHead>
                </tr>
              </thead>
              <tbody
                onDragOver={(event) => tableDrag.current.over(event)}
                onDrop={(event) => tableDrag.current.drop(event)}
              >
                <OfferDragRoot groups={nodes} tableDrag={tableDrag} onMove={(groups) => onChange({ ...body, groups })}>
                  {nodes.map((group, index) => (
                    <GroupRows
                      key={group.id}
                      group={group}
                      depth={0}
                      parentId={null}
                      index={index}
                      collapsedIds={collapsedIds}
                      onToggleCollapsed={onToggleCollapsed}
                      onChange={(next) => onChange({ ...body, groups: replaceNode(body.groups, group.id, next) as OfferGroup[] })}
                      onRemoveGroup={onRemoveGroup}
                    />
                  ))}
                  <DropLine parentId={null} index={nodes.length} />
                </OfferDragRoot>
                <tr className="bg-[#f4faf6] font-semibold">
                  <td className="px-2 py-2" colSpan={9}>
                    Kopā
                  </td>
                  <MoneyCells prices={totals} volumeOnly />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </OfferCalcContext.Provider>
      )}
      {showLock ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {onDiscard && !locked ? (
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#b42318] hover:bg-[#fdeceb]"
            >
              <Trash2 className="size-4 shrink-0" aria-hidden="true" />
              Noņemt
            </button>
          ) : null}
          <button
            type="button"
            onClick={onFix}
            disabled={locked || fixDisabled}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            Nofiksēt
          </button>
        </div>
      ) : null}
      {body.fixedAt ? <p className="mt-2 text-sm text-[#5f756a]">Nofiksēts {formatFixedStamp(body.fixedAt)}</p> : null}
    </OfferLockContext.Provider>
  );
}

type ExtraCopyGroup = {
  siteId: string;
  customer: string;
  address: string;
  extras: { extra: OfferExtra; number: number }[];
};

function CopyExtraModal({
  sites,
  preview,
  onPreview,
  onClose,
  onCopy,
}: {
  sites: Site[];
  preview: { customer: string; number: number; extra: OfferExtra } | null;
  onPreview: (preview: { customer: string; number: number; extra: OfferExtra } | null) => void;
  onClose: () => void;
  onCopy: (extra: OfferExtra) => void;
}) {
  const [groups, setGroups] = useState<ExtraCopyGroup[] | null>(null);
  const catalog = useContext(PriceCatalogContext);

  useEffect(() => {
    let active = true;
    loadOfferDocuments().then((documents) => {
      if (!active) return;
      const next = documents
        .flatMap((row) => {
          const client = sites.find((item) => item.id === row.siteId);
          if (!client || row.document.extras.length === 0) return [];
          return [{
            siteId: row.siteId,
            customer: client.customer,
            address: client.address,
            extras: row.document.extras.map((extra, index) => ({ extra, number: index + 1 })),
          }];
        })
        .sort((left, right) => left.customer.localeCompare(right.customer, "lv"));
      setGroups(next);
    });
    return () => {
      active = false;
    };
  }, [sites]);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (preview) {
        onPreview(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPreview, preview]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] grid place-items-center bg-[#12382c]/35 p-4 backdrop-blur-md"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !preview) onClose();
        }}
      >
        <div role="dialog" aria-modal="true" aria-labelledby="copy-extra-title" className="flex max-h-[min(36rem,calc(100vh-2rem))] w-full max-w-lg flex-col rounded-3xl bg-white p-6 text-[#143028] shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <h2 id="copy-extra-title" className="text-lg font-semibold">Kopēt papildu darbu tāmi</h2>
            <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#5f756a]" aria-label="Aizvērt">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-sm text-[#5f756a]">Izvēlies klienta papildu darbu tāmi. Pirms kopēšanas to var apskatīt.</p>
          {groups === null ? (
            <p className="mt-5 text-sm text-[#5f756a]">Ielādē...</p>
          ) : groups.length === 0 ? (
            <p className="mt-5 text-sm text-[#5f756a]">Nevienam klientam vēl nav papildu darbu tāmes.</p>
          ) : (
            <ul className="mt-5 min-h-0 flex-1 divide-y divide-[#e4efe8] overflow-y-auto rounded-2xl border border-[#d3e4da]">
              {groups.map((group) => (
                <li key={group.siteId} className="px-4 py-3">
                  <p className="truncate font-medium">{group.customer}</p>
                  {group.address ? <p className="mt-0.5 truncate text-sm text-[#5f756a]">{group.address}</p> : null}
                  <ul className="mt-2 space-y-1">
                    {group.extras.map((item) => (
                      <li key={item.extra.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onCopy(item.extra)}
                          className="min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left hover:bg-[#f4faf6]"
                        >
                          <span className="block text-sm font-medium">Papildu darbu tāme {item.number}</span>
                          <span className="block text-xs text-[#5f756a]">
                            {item.extra.fixedAt ? `Nofiksēts ${formatFixedStamp(item.extra.fixedAt)}` : "Vēl nav nofiksēta"}
                          </span>
                        </button>
                        <Tooltip text="Apskatīt">
                          <button
                            type="button"
                            aria-label="Apskatīt papildu darbu tāmi"
                            onClick={() => onPreview({ customer: group.customer, number: item.number, extra: item.extra })}
                            className="grid size-9 shrink-0 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]"
                          >
                            <Eye className="size-4" aria-hidden="true" />
                          </button>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {preview ? (
        <ExtraPreview
          customer={preview.customer}
          number={preview.number}
          extra={preview.extra}
          cards={catalog?.cards ?? []}
          onClose={() => onPreview(null)}
        />
      ) : null}
    </>,
    document.body,
  );
}

function ExtraPreview({
  customer,
  number,
  extra,
  cards,
  onClose,
}: {
  customer: string;
  number: number;
  extra: OfferExtra;
  cards: PricePosition[];
  onClose: () => void;
}) {
  const [columnWidths, setColumnWidths] = useState<OfferColumnWidths>(OFFER_COLUMN_DEFAULTS);
  const widthsRef = useRef(columnWidths);
  widthsRef.current = columnWidths;
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());

  useLayoutEffect(() => {
    setColumnWidths(readColumnWidths());
  }, []);

  function resizeColumn(column: OfferColumn, width: number, persist: boolean) {
    const next = { ...widthsRef.current, [column]: width };
    widthsRef.current = next;
    setColumnWidths(next);
    if (persist) writeColumnWidths(next);
  }

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[#12382c]/45 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="extra-preview-title" className="flex max-h-[calc(100vh-2rem)] w-full max-w-[min(1520px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl bg-white text-[#143028] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#d3e4da] px-6 py-4">
          <div className="min-w-0">
            <h2 id="extra-preview-title" className="text-lg font-semibold">Papildu darbu tāme {number}</h2>
            <p className="mt-1 truncate text-sm text-[#5f756a]">{customer}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#5f756a]" aria-label="Aizvērt">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          <OfferSheet
            body={extra}
            hourlyRate=""
            cards={cards}
            columnWidths={columnWidths}
            onResize={resizeColumn}
            collapsedIds={collapsedIds}
            onToggleCollapsed={(id) => setCollapsedIds((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })}
            onChange={() => {}}
            onFix={() => {}}
            onRemoveGroup={() => {}}
            fixDisabled
            readOnly
            showLock={false}
            showProfit={false}
          />
        </div>
      </div>
    </div>
  );
}

type DragKind = "category" | "subcategory" | "position";

type DragItem = { id: string; kind: DragKind; parentId: string | null; index: number };

type DropSlot = { parentId: string | null; index: number };

type RowHit = { id: string; kind: DragKind; parentId: string | null; index: number; childCount: number; collapsed: boolean };

type TableDragHandlers = {
  over: (event: DragEvent<HTMLTableSectionElement>) => void;
  drop: (event: DragEvent<HTMLTableSectionElement>) => void;
};

type OfferDragApi = {
  drag: DragItem | null;
  drop: DropSlot | null;
  start: (item: DragItem, event: DragEvent<HTMLElement>, row: HTMLElement | null) => void;
  overRow: (event: DragEvent<HTMLTableRowElement>, row: RowHit) => void;
  dropOn: (event: DragEvent<HTMLTableRowElement>) => void;
  end: () => void;
};

const OfferDragContext = createContext<OfferDragApi | null>(null);

function useOfferDrag() {
  const value = useContext(OfferDragContext);
  if (!value) throw new Error("OfferDragContext");
  return value;
}

function OfferDragRoot({
  groups,
  onMove,
  tableDrag,
  children,
}: {
  groups: OfferGroup[];
  onMove: (groups: OfferGroup[]) => void;
  tableDrag: { current: TableDragHandlers };
  children: ReactNode;
}) {
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [drop, setDrop] = useState<DropSlot | null>(null);
  const dragRef = useRef<DragItem | null>(null);
  const dropRef = useRef<DropSlot | null>(null);
  const groupsRef = useRef(groups);
  const onMoveRef = useRef(onMove);
  groupsRef.current = groups;
  onMoveRef.current = onMove;

  const commitRef = useRef(() => {});
  commitRef.current = () => {
    const current = dragRef.current;
    const slot = dropRef.current;
    dragRef.current = null;
    dropRef.current = null;
    setDrag(null);
    setDrop(null);
    if (!current || !slot || samePlace(current, slot)) return;
    onMoveRef.current(moveOfferNode(groupsRef.current, current.id, slot.parentId, slot.index));
  };

  tableDrag.current = {
    over(event) {
      if (!dragRef.current || !dropRef.current) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    drop(event) {
      event.preventDefault();
      commitRef.current();
    },
  };

  const api = useMemo<OfferDragApi>(() => {
    return {
      get drag() {
        return drag;
      },
      get drop() {
        return drop;
      },
      start(item, event, row) {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
        if (row) event.dataTransfer.setDragImage(row, 28, 18);
        dragRef.current = item;
        setDrag(item);
      },
      overRow(event, row) {
        const current = dragRef.current;
        if (!current || current.id === row.id) return;
        const slot = slotFor(current, row, event);
        if (!slot || samePlace(current, slot)) {
          if (dropRef.current) {
            dropRef.current = null;
            setDrop(null);
          }
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dropRef.current?.parentId === slot.parentId && dropRef.current.index === slot.index) return;
        dropRef.current = slot;
        setDrop(slot);
      },
      dropOn(event) {
        event.preventDefault();
        event.stopPropagation();
        commitRef.current();
      },
      end() {
        window.setTimeout(() => {
          if (!dragRef.current) return;
          dragRef.current = null;
          dropRef.current = null;
          setDrag(null);
          setDrop(null);
        }, 0);
      },
    };
  }, [drag, drop]);

  return <OfferDragContext.Provider value={api}>{children}</OfferDragContext.Provider>;
}

function slotFor(drag: DragItem, row: RowHit, event: DragEvent<HTMLTableRowElement>): DropSlot | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = rect.height === 0 ? 0.5 : (event.clientY - rect.top) / rect.height;

  if (drag.kind === "category") {
    if (row.kind !== "category") return null;
    return { parentId: null, index: ratio > 0.5 ? row.index + 1 : row.index };
  }

  if (drag.kind === "subcategory") {
    if (!drag.parentId) return null;
    if (row.id === drag.parentId) return { parentId: drag.parentId, index: 0 };
    if (row.parentId !== drag.parentId || row.kind === "category") return null;
    return { parentId: drag.parentId, index: ratio > 0.5 ? row.index + 1 : row.index };
  }

  if (row.kind === "position") {
    if (!row.parentId) return null;
    return { parentId: row.parentId, index: ratio > 0.5 ? row.index + 1 : row.index };
  }

  if (ratio < 0.3 && row.parentId) return { parentId: row.parentId, index: row.index };
  if (row.collapsed || ratio > 0.7) return { parentId: row.id, index: row.childCount };
  return { parentId: row.id, index: 0 };
}

function samePlace(drag: DragItem, slot: DropSlot) {
  return drag.parentId === slot.parentId && (slot.index === drag.index || slot.index === drag.index + 1);
}

function DropLine({ parentId, index }: { parentId: string | null; index: number }) {
  const drag = useOfferDrag();
  const active = drag.drop?.parentId === parentId && drag.drop.index === index;
  if (!active) return null;
  return (
    <tr aria-hidden="true" className="pointer-events-none">
      <td colSpan={14} className="pointer-events-none !border-0 p-0">
        <div key={`${parentId ?? "root"}-${index}`} className="offer-drop-line mx-3 my-0.5 h-1 rounded-full bg-[#1a6b4a] shadow-[0_0_0_3px_rgba(26,107,74,0.18)]" />
      </td>
    </tr>
  );
}

function DragGrip({
  label,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const locked = useOfferLocked();
  if (locked) return null;
  return (
    <Tooltip text={label}>
      <button
        type="button"
        draggable
        aria-label={label}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`${iconButton} cursor-grab active:cursor-grabbing`}
        style={{ cursor: "grab" }}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function GroupRows({
  group,
  depth,
  parentId,
  index,
  collapsedIds,
  onToggleCollapsed,
  onChange,
  onRemoveGroup,
}: {
  group: OfferGroup;
  depth: number;
  parentId: string | null;
  index: number;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapsed: (id: string) => void;
  onChange: (group: OfferGroup) => void;
  onRemoveGroup: (group: OfferGroup) => void;
}) {
  const { factor, hourlyRate } = useContext(OfferCalcContext);
  const locked = useOfferLocked();
  const drag = useOfferDrag();
  const prices = sumPrices(group.children, factor);
  const collapsed = collapsedIds.has(group.id);
  const isCategory = group.kind === "category";
  const rowRef = useRef<HTMLTableRowElement>(null);
  const landingInside = drag.drop?.parentId === group.id && drag.drag?.kind === "position";
  return (
    <>
      <DropLine parentId={parentId} index={index} />
      <tr
        ref={rowRef}
        className={`${isCategory ? "bg-[#eef6f1]" : "bg-white"} ${drag.drag?.id === group.id ? "opacity-45" : ""} ${landingInside ? "bg-[#e3f5ea]" : ""} transition-colors`}
        onDragOver={(event) => drag.overRow(event, { id: group.id, kind: group.kind, parentId, index, childCount: group.children.length, collapsed })}
        onDrop={drag.dropOn}
      >
        <td className="px-2 py-1.5" colSpan={9} style={{ paddingLeft: 8 + depth * 16 }}>
          <div className="flex items-center gap-1">
            <DragGrip
              label={isCategory ? "Pārvietot kategoriju" : "Pārvietot subkategoriju"}
              onDragStart={(event) => drag.start({ id: group.id, kind: group.kind, parentId, index }, event, rowRef.current)}
              onDragEnd={drag.end}
            />
            <Tooltip text={collapsed ? "Izvērst" : "Sakļaut"}>
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-label={collapseLabel(isCategory, collapsed)}
                onClick={() => onToggleCollapsed(group.id)}
                className={iconButton}
              >
                {collapsed ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
              </button>
            </Tooltip>
            <input
              value={group.name}
              data-offer-cell="name"
              disabled={locked}
              onKeyDown={onOfferCellKey}
              onChange={(event) => onChange({ ...group, name: event.target.value })}
              placeholder={group.kind === "category" ? "Kategorija" : "Subkategorija"}
              aria-label={group.kind === "category" ? "Kategorija" : "Subkategorija"}
              className={`${cellInput} font-semibold`}
            />
            {locked ? null : (
              <Tooltip text="Subkategorija">
                <button
                  type="button"
                  aria-label="Subkategorija"
                  className={iconButton}
                  onClick={() => onChange({ ...group, children: [...group.children, emptyGroup("subcategory")] })}
                >
                  <FolderPlus className="size-4" aria-hidden="true" />
                </button>
              </Tooltip>
            )}
            {locked ? null : (
              <Tooltip text="Pozīcija">
                <button
                  type="button"
                  aria-label="Pozīcija"
                  className={iconButton}
                  onClick={() => onChange({ ...group, children: [...group.children, emptyPosition(hourlyRate)] })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          </div>
        </td>
        <MoneyCells prices={prices} volumeOnly />
        <td className="px-1 py-1.5">
          {locked ? null : (
            <Tooltip text="Dzēst">
              <button type="button" aria-label="Dzēst" onClick={() => onRemoveGroup(group)} className={`${iconButton} text-[#b42318] hover:bg-[#fdeceb]`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </td>
      </tr>
      {collapsed && drag.drop?.parentId === group.id ? <DropLine parentId={group.id} index={drag.drop.index} /> : null}
      {collapsed
        ? null
        : group.children.map((child, childIndex) =>
            child.kind === "position" ? (
              <PositionRow
                key={child.id}
                position={child}
                depth={depth + 1}
                parentId={group.id}
                index={childIndex}
                onChange={(next) => onChange({ ...group, children: replaceNode(group.children, child.id, next) })}
                onRemove={() => onChange({ ...group, children: removeNode(group.children, child.id) })}
              />
            ) : (
              <GroupRows
                key={child.id}
                group={child}
                depth={depth + 1}
                parentId={group.id}
                index={childIndex}
                collapsedIds={collapsedIds}
                onToggleCollapsed={onToggleCollapsed}
                onChange={(next) => onChange({ ...group, children: replaceNode(group.children, child.id, next) })}
                onRemoveGroup={onRemoveGroup}
              />
            ),
          )}
      {collapsed ? null : <DropLine parentId={group.id} index={group.children.length} />}
    </>
  );
}

function PositionRow({
  position,
  depth,
  parentId,
  index,
  onChange,
  onRemove,
}: {
  position: OfferPosition;
  depth: number;
  parentId: string;
  index: number;
  onChange: (position: OfferPosition) => void;
  onRemove: () => void;
}) {
  const { factor } = useContext(OfferCalcContext);
  const locked = useOfferLocked();
  const drag = useOfferDrag();
  const rowRef = useRef<HTMLTableRowElement>(null);
  const prices = positionPrices(position, factor);
  const laborVisible = hasAmount(position.timeNorm) || hasAmount(position.rate);
  const materialVisible = position.materials.length > 0 || hasAmount(position.materialPrice);
  const mechanismVisible = hasAmount(position.mechanismRate) || hasAmount(position.mechanismPrice);
  const unitVisible = laborVisible || materialVisible || mechanismVisible;
  const volumeVisible = hasAmount(position.quantity);
  return (
    <>
      <DropLine parentId={parentId} index={index} />
      <tr
        ref={rowRef}
        className={`${drag.drag?.id === position.id ? "opacity-45" : ""} transition-opacity`}
        onDragOver={(event) => drag.overRow(event, { id: position.id, kind: "position", parentId, index, childCount: 0, collapsed: false })}
        onDrop={drag.dropOn}
      >
      <td className="px-2 py-1" style={{ paddingLeft: 8 + depth * 16 }}>
        <div className="flex min-w-0 items-center gap-1">
          <DragGrip
            label="Pārvietot pozīciju"
            onDragStart={(event) => drag.start({ id: position.id, kind: "position", parentId, index }, event, rowRef.current)}
            onDragEnd={drag.end}
          />
          <input
            value={position.name}
            data-offer-cell="name"
            disabled={locked}
            onKeyDown={onOfferCellKey}
            onChange={(event) => onChange({ ...position, name: event.target.value })}
            placeholder="Nosaukums"
            aria-label="Nosaukums"
            className={`${cellInput} min-w-0 flex-1`}
          />
        </div>
      </td>
      <td className="px-1.5 py-1 text-center">
        <input
          value={position.unit}
          data-offer-cell="unit"
          disabled={locked}
          onKeyDown={onOfferCellKey}
          onChange={(event) => onChange({ ...position, unit: event.target.value })}
          placeholder="m²"
          aria-label="Mērvienība"
          className={`${cellInput} min-w-0 text-center`}
        />
      </td>
      <td className={fitCell}>
        <NumberCell column="quantity" value={position.quantity} label="Daudzums" onChange={(quantity) => onChange({ ...position, quantity })} />
      </td>
      <td className={fitCell}>
        <NumberCell column="time" value={position.timeNorm} label="Laika norma" onChange={(timeNorm) => onChange({ ...position, timeNorm })} />
      </td>
      <td className={fitCell}>
        <NumberCell column="rate" value={position.rate} label="Likme" onChange={(rate) => onChange({ ...position, rate })} />
      </td>
      <td className={moneyClass}>{money(prices.laborUnit, laborVisible)}</td>
      <td className={fitCell}>
        <PriceCell role="material" position={position} onChange={onChange} />
      </td>
      <td className={fitCell}>
        <PriceCell role="mechanism" position={position} onChange={onChange} />
      </td>
      <td className={moneyClass}>{money(prices.unitTotal, unitVisible)}</td>
      <td className={moneyClass}>{money(prices.laborVolume, laborVisible && volumeVisible)}</td>
      <td className={moneyClass}>{money(prices.materialVolume, materialVisible && volumeVisible)}</td>
      <td className={moneyClass}>{money(prices.mechanismVolume, mechanismVisible && volumeVisible)}</td>
      <td className={moneyClass}>{money(prices.volumeTotal, unitVisible && volumeVisible)}</td>
      <td className="px-1 py-1">
        {locked ? null : (
          <Tooltip text="Dzēst">
            <button type="button" aria-label="Dzēst" onClick={onRemove} className={`${iconButton} text-[#b42318] hover:bg-[#fdeceb]`}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </td>
      </tr>
    </>
  );
}

function PriceCell({
  role,
  position,
  onChange,
}: {
  role: PriceRole;
  position: OfferPosition;
  onChange: (position: OfferPosition) => void;
}) {
  const catalog = useContext(PriceCatalogContext);
  const { factor } = useContext(OfferCalcContext);
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const prices = positionPrices(position, factor);
  const amount = role === "material" ? prices.materialUnit : prices.mechanismUnit;
  const label = money(amount, amount !== 0);
  const locked = useOfferLocked();
  const updates = locked ? [] : offerPriceUpdates([position], catalog?.cards ?? []).filter((update) => update.role === role);
  const breakdown = role === "mechanism" && catalog ? mechanismBreakdown(position, catalog.cards, prices.mechanismUnit, factor) : null;
  useEffect(() => {
    if (review && updates.length === 0) setReview(false);
  }, [review, updates.length]);
  if (locked) return <span className="block min-w-0 px-1 text-right tabular-nums">{label}</span>;
  return (
    <>
      <button
        type="button"
        data-offer-cell={role}
        aria-label={role === "material" ? "Izvēlēties materiālu" : "Izvēlēties mehānismu"}
        onKeyDown={onOfferCellKey}
        onClick={() => (updates.length > 0 ? setReview(true) : setOpen(true))}
        className={`${cellInput} min-w-0 px-1 text-right tabular-nums ${updates.length > 0 ? "!border-[#b42318] hover:!border-[#8a1c14]" : ""}`}
      >
        {label}
      </button>
      {review ? (
        <RightDrawer front title="Cenu maiņa" hint={position.name || "Pozīcija"} onClose={() => setReview(false)}>
          {breakdown ? (
            <p className="mb-3 text-sm tabular-nums text-[#5f756a]">
              {breakdown.name}. {breakdown.detail}
            </p>
          ) : null}
          <ul className="space-y-3">
            {updates.map((update) => (
              <li key={`${update.lineId}:${update.entryId}`} className="rounded-xl bg-[#f4faf6] px-3 py-3">
                <p className="font-medium">{update.name}</p>
                <p className="mt-1 text-sm tabular-nums text-[#5f756a]">
                  {update.from} → {update.to}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => decidePriceUpdate(position, update, false, onChange)} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#1e3a2f]">
                    <X className="size-4 shrink-0" aria-hidden="true" />
                    Noraidīt
                  </button>
                  <button
                    type="button"
                    onClick={() => decidePriceUpdate(position, update, true, onChange)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-3 text-sm font-semibold text-white hover:bg-[#0f4a34]"
                  >
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                    Pielietot
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </RightDrawer>
      ) : null}
      {open && catalog && role === "material" ? (
        <MaterialLinesDialog
          positionUnit={position.unit}
          lines={position.materials}
          cards={catalog.cards.filter((card) => card.role === "material")}
          onClose={() => setOpen(false)}
          onCreated={catalog.reload}
          onChange={(materials) => onChange({ ...position, materials, materialPrice: "", materialPositionId: "" })}
        />
      ) : null}
      {open && catalog && role === "mechanism" ? (
        <PricePickDialog
          role="mechanism"
          cards={catalog.cards.filter((card) => card.role === "mechanism")}
          breakdown={mechanismBreakdown(position, catalog.cards, prices.mechanismUnit, factor)}
          onClose={() => setOpen(false)}
          onCreated={catalog.reload}
          onClear={() =>
            onChange({
              ...position,
              mechanismRate: "",
              mechanismPositionId: "",
              mechanismPrice: "",
              acknowledgedMechanismPriceId: "",
            })
          }
          onApply={(card, unitPrice) => {
            onChange({
              ...position,
              mechanismRate: formatUnitPrice(unitPrice),
              mechanismPositionId: card?.id ?? "",
              mechanismPrice: "",
              acknowledgedMechanismPriceId: card ? (latestEntry(card)?.id ?? "") : "",
            });
          }}
        />
      ) : null}
    </>
  );
}

function MoneyCells({ prices, volumeOnly = false }: { prices: OfferPrices | null; volumeOnly?: boolean }) {
  if (!prices) return null;
  return (
    <>
      {volumeOnly ? null : <td className={moneyClass}>{money(prices.unitTotal, prices.unitTotal !== 0)}</td>}
      <td className={moneyClass}>{money(prices.laborVolume, prices.laborVolume !== 0)}</td>
      <td className={moneyClass}>{money(prices.materialVolume, prices.materialVolume !== 0)}</td>
      <td className={moneyClass}>{money(prices.mechanismVolume, prices.mechanismVolume !== 0)}</td>
      <td className={moneyClass}>{money(prices.volumeTotal, prices.volumeTotal !== 0)}</td>
    </>
  );
}

function NumberCell({ column, value, label, onChange }: { column: string; value: string; label: string; onChange: (value: string) => void }) {
  const locked = useOfferLocked();
  const [focused, setFocused] = useState(false);
  const shown = focused ? value : formatOfferNumber(value);
  return (
    <input
      value={shown}
      data-offer-cell={column}
      inputMode="decimal"
      disabled={locked}
      aria-label={label}
      onKeyDown={onOfferCellKey}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const next = formatOfferNumber(value);
        if (next !== value) onChange(next);
      }}
      onChange={(event) => onChange(event.target.value.replace(/[^\d,.\s-]/g, ""))}
      className={`${cellInput} min-w-0 px-1 text-right tabular-nums`}
    />
  );
}

async function flush(
  siteId: string,
  nodes: OfferDocument,
  savedRef: { current: string },
  pendingRef: { current: OfferDocument | null },
  savingRef: { current: boolean },
  setStatus: (status: "saving" | "saved" | "error") => void,
  onReady: () => void,
) {
  pendingRef.current = nodes;
  if (savingRef.current) return;
  savingRef.current = true;
  let failed = false;
  while (pendingRef.current) {
    const next = pendingRef.current;
    pendingRef.current = null;
    const result = await saveOffer(siteId, next);
    if (!result.ok) {
      failed = true;
      break;
    }
    savedRef.current = JSON.stringify(next);
    onReady();
  }
  savingRef.current = false;
  if (!failed && pendingRef.current) {
    await flush(siteId, pendingRef.current, savedRef, pendingRef, savingRef, setStatus, onReady);
    return;
  }
  setStatus(failed ? "error" : "saved");
}

function replaceNode(nodes: OfferNode[], id: string, next: OfferNode): OfferNode[] {
  return nodes.map((node) => {
    if (node.id === id) return next;
    if (node.kind === "position") return node;
    return { ...node, children: replaceNode(node.children, id, next) };
  });
}

function removeNode(nodes: OfferNode[], id: string): OfferNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.kind === "position" ? node : { ...node, children: removeNode(node.children, id) }));
}

function collapseLabel(isCategory: boolean, collapsed: boolean) {
  if (collapsed) return isCategory ? "Izvērst kategoriju" : "Izvērst subkategoriju";
  return isCategory ? "Sakļaut kategoriju" : "Sakļaut subkategoriju";
}

const OFFER_COLUMNS = [
  { key: "name", min: 160, max: 720, fallback: 320 },
  { key: "unit", min: 52, max: 160, fallback: 64 },
  { key: "quantity", min: 72, max: 180, fallback: 88 },
  { key: "time", min: 76, max: 200, fallback: 96 },
  { key: "rate", min: 76, max: 200, fallback: 92 },
  { key: "laborUnit", min: 72, max: 200, fallback: 84 },
  { key: "materialUnit", min: 80, max: 220, fallback: 96 },
  { key: "mechanismUnit", min: 84, max: 220, fallback: 104 },
  { key: "unitTotal", min: 72, max: 200, fallback: 84 },
  { key: "laborVolume", min: 72, max: 200, fallback: 84 },
  { key: "materialVolume", min: 80, max: 220, fallback: 96 },
  { key: "mechanismVolume", min: 84, max: 220, fallback: 104 },
  { key: "volumeTotal", min: 72, max: 200, fallback: 84 },
] as const;

type OfferColumn = (typeof OFFER_COLUMNS)[number]["key"];

type OfferColumnWidths = Record<OfferColumn, number>;

const OFFER_COLUMN_DEFAULTS = Object.fromEntries(OFFER_COLUMNS.map((column) => [column.key, column.fallback])) as OfferColumnWidths;

const OFFER_ACTION_WIDTH = 44;

const COLUMN_COOKIE = "bm_offer_columns";

function offerTableWidth(widths: OfferColumnWidths) {
  return OFFER_COLUMNS.reduce((sum, column) => sum + widths[column.key], OFFER_ACTION_WIDTH);
}

function columnShare(widths: OfferColumnWidths, width: number) {
  const total = offerTableWidth(widths);
  return `${(width / total) * 100}%`;
}

function clampColumn(column: OfferColumn, width: number) {
  const limits = OFFER_COLUMNS.find((item) => item.key === column);
  if (!limits) return width;
  return Math.min(limits.max, Math.max(limits.min, Math.round(width)));
}

function readColumnWidths(): OfferColumnWidths {
  const next = { ...OFFER_COLUMN_DEFAULTS };
  const prefix = `${COLUMN_COOKIE}=`;
  const raw = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  if (!raw) return next;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw.slice(prefix.length)));
    if (!parsed || typeof parsed !== "object") return next;
    const record = parsed as Record<string, unknown>;
    for (const column of OFFER_COLUMNS) {
      const value = record[column.key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      next[column.key] = clampColumn(column.key, value);
    }
  } catch {
    return { ...OFFER_COLUMN_DEFAULTS };
  }
  return next;
}

function writeColumnWidths(widths: OfferColumnWidths) {
  const value = encodeURIComponent(JSON.stringify(widths));
  document.cookie = `${COLUMN_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function ResizableHead({
  column,
  width,
  onResize,
  className,
  rowSpan,
  children,
}: {
  column: OfferColumn;
  width: number;
  onResize: (column: OfferColumn, width: number, persist: boolean) => void;
  className: string;
  rowSpan?: number;
  children: ReactNode;
}) {
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  function onPointerDown(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const start = width;
    let latest = start;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "col-resize";
    function move(next: PointerEvent) {
      latest = clampColumn(column, start + next.clientX - startX);
      onResizeRef.current(column, latest, false);
    }
    function up() {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      document.body.style.cursor = previousCursor;
      onResizeRef.current(column, latest, true);
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }

  return (
    <th rowSpan={rowSpan} className={`relative overflow-hidden ${className}`}>
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label="Mainīt kolonnas platumu"
        onPointerDown={onPointerDown}
        className="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-[#1a6b4a]/35"
      />
    </th>
  );
}

function cookieName(siteId: string) {
  return `bm_offer_collapsed_${siteId}`;
}

function readCollapsedIds(siteId: string): Set<string> {
  const prefix = `${cookieName(siteId)}=`;
  const raw = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw.slice(prefix.length)));
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

function writeCollapsedIds(siteId: string, ids: ReadonlySet<string>) {
  const value = encodeURIComponent(JSON.stringify([...ids]));
  document.cookie = `${cookieName(siteId)}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function onOfferCellKey(event: KeyboardEvent<HTMLElement>) {
  const key = event.key;
  if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") return;
  if (document.querySelector("[role='dialog']")) return;
  const current = event.currentTarget;
  if ((key === "ArrowLeft" || key === "ArrowRight") && current instanceof HTMLInputElement && !atCellEdge(current, key)) return;
  const row = current.closest("tr");
  const table = current.closest("table");
  const column = current.dataset.offerCell;
  if (!row || !table || !column) return;
  const target = key === "ArrowUp" || key === "ArrowDown" ? cellAbove(table, row, column, key === "ArrowDown" ? 1 : -1) : cellBeside(row, current, key === "ArrowRight" ? 1 : -1);
  if (!target) return;
  event.preventDefault();
  target.focus();
  requestAnimationFrame(() => {
    if (target instanceof HTMLInputElement) target.select();
  });
}

function atCellEdge(input: HTMLInputElement, key: "ArrowLeft" | "ArrowRight") {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start === 0 && end === input.value.length) return true;
  if (start !== end) return false;
  return key === "ArrowLeft" ? start === 0 : end === input.value.length;
}

function cellBeside(row: HTMLTableRowElement, current: HTMLElement, step: 1 | -1) {
  const cells = [...row.querySelectorAll<HTMLElement>("[data-offer-cell]")];
  const index = cells.indexOf(current);
  return cells[index + step] ?? null;
}

function cellAbove(table: HTMLElement, row: HTMLTableRowElement, column: string, step: 1 | -1) {
  const rows = [...table.querySelectorAll("tr")].filter((item) => item.querySelector("[data-offer-cell]"));
  const index = rows.indexOf(row);
  for (let next = index + step; next >= 0 && next < rows.length; next += step) {
    const cell = rows[next].querySelector<HTMLElement>(`[data-offer-cell="${column}"]`);
    if (cell) return cell;
  }
  return null;
}

function mechanismBreakdown(position: OfferPosition, cards: PricePosition[], shown: number, factor: number): MechanismBreakdown | null {
  const card = cards.find((item) => item.id === position.mechanismPositionId);
  if (hasAmount(position.mechanismRate)) {
    const hours = parseAmount(position.timeNorm);
    const rate = parseAmount(position.mechanismRate);
    const product = Math.round((hours * rate + Number.EPSILON) * 100) / 100;
    const time = hasAmount(position.timeNorm) ? position.timeNorm : "0,00";
    const parts = `${time} c/h × ${position.mechanismRate} = ${formatUnitPrice(product)}`;
    const detail = factor !== 1 && shown !== product ? `${parts}. Šūnā ar peļņu ${formatUnitPrice(shown)}` : parts;
    return { name: card?.name || "Cena bez kartītes", detail };
  }
  if (!hasAmount(position.mechanismPrice)) return null;
  return { name: card?.name || "Ievadītā summa", detail: formatUnitPrice(parseAmount(position.mechanismPrice)) };
}

function decidePriceUpdate(position: OfferPosition, update: OfferPriceUpdate, apply: boolean, onChange: (position: OfferPosition) => void) {
  if (update.role === "material") {
    onChange({
      ...position,
      materials: position.materials.map((line) =>
        line.id === update.lineId
          ? { ...line, unitPrice: apply ? update.to : line.unitPrice, acknowledgedPriceId: update.entryId }
          : line,
      ),
    });
    return;
  }
  onChange({
    ...position,
    mechanismRate: apply ? update.to : position.mechanismRate,
    acknowledgedMechanismPriceId: update.entryId,
  });
}

function money(value: number, visible: boolean) {
  if (!visible) return "—";
  return formatMoney(value).replace(" €", "");
}

function formatOfferNumber(raw: string) {
  if (!hasAmount(raw)) return "";
  return formatMoney(parseAmount(raw)).replace(" €", "");
}

function formatFixedStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusText(status: "loading" | "saving" | "saved" | "error") {
  if (status === "loading") return "Ielādē...";
  if (status === "saving") return "Saglabā...";
  if (status === "error") return "Neizdevās saglabāt.";
  return "Saglabāts.";
}

const cellInput =
  "h-8 w-full rounded-lg border border-transparent bg-transparent px-1.5 outline-none hover:border-[#c5d9cd] focus:border-[#1a6b4a] focus:bg-white disabled:cursor-not-allowed disabled:text-[#143028] disabled:hover:border-transparent";

const headFit = "whitespace-nowrap px-1.5 py-2 text-center font-medium";

const headWrap = "px-1 py-2 text-center font-medium leading-tight";

const fitCell = "whitespace-nowrap px-1 py-1 text-right";

const groupHead = "bg-[#f4faf6] px-2 py-1.5 text-center text-[11px] font-semibold tracking-wide text-[#5f756a]";

const moneyClass = "whitespace-nowrap px-1.5 py-1 text-right tabular-nums";

const iconButton = "grid size-8 place-items-center rounded-lg text-[#1a6b4a] hover:bg-[#e7f6ec]";
