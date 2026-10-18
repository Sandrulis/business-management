"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { OfferEditor } from "@/app/components/offer-editor";
import { useInvoices } from "@/app/components/invoice-state";
import { RightDrawer } from "@/app/components/right-drawer";
import { Tooltip } from "@/app/components/tooltip";
import type { Site } from "@/app/lib/invoices/model";
import { bankFromIban, isValidIban, normalizeIban } from "@/app/lib/payments/iban";
import { copyOfferDocument, offerNeedsPriceReview } from "@/app/lib/offers/model";
import { loadOffer, loadOfferDocuments, saveOffer } from "@/app/lib/offers/repository";
import { loadPriceCatalog } from "@/app/lib/prices/repository";
import { Check, CircleAlert, Copy, FileCheck, FilePlus, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const emptySite = (): Site => ({ id: "", address: "", customer: "", iban: "", bankName: "" });

export function SitesView() {
  const pathname = usePathname();
  const router = useRouter();
  const { sites, saveSite, removeSite, notify } = useInvoices();
  const creating = pathname === "/clients/new";
  const [draft, setDraft] = useState<Site>(emptySite);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmSite, setConfirmSite] = useState<Site | null>(null);
  const [offerSite, setOfferSite] = useState<Site | null>(null);
  const [offerMarks, setOfferMarks] = useState<Record<string, OfferMark>>({});
  const [reviewSiteIds, setReviewSiteIds] = useState<string[]>([]);
  const [copySite, setCopySite] = useState<Site | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  async function refreshOffers() {
    const [offers, catalog] = await Promise.all([loadOfferDocuments(), loadPriceCatalog()]);
    setOfferMarks(
      Object.fromEntries(
        offers.map((row) => [
          row.siteId,
          {
            fixed: Boolean(row.document.fixedAt),
            extras: row.document.extras.length,
            openExtra: row.document.extras.some((extra) => !extra.fixedAt),
          },
        ]),
      ),
    );
    if (!catalog.ok) {
      setReviewSiteIds([]);
      return;
    }
    setReviewSiteIds(offers.filter((row) => offerNeedsPriceReview(row.document, catalog.positions)).map((row) => row.siteId));
  }

  useEffect(() => {
    void refreshOffers();
  }, []);

  async function copyOffer(sourceId: string) {
    if (!copySite || copyingId) return;
    setCopyingId(sourceId);
    const loaded = await loadOffer(sourceId);
    if (!loaded.ok) {
      setCopyingId(null);
      notify(loaded.message, "error");
      return;
    }
    const saved = await saveOffer(copySite.id, copyOfferDocument(loaded.document));
    setCopyingId(null);
    if (!saved.ok) {
      notify(saved.message, "error");
      return;
    }
    const target = copySite;
    setCopySite(null);
    await refreshOffers();
    setOfferSite(target);
  }

  const editing = sites.find((site) => site.id === editingId) ?? null;
  const ibanValue = normalizeIban(draft.iban);
  const complete = draft.customer.trim() !== "" && draft.address.trim() !== "" && isValidIban(ibanValue);
  const editDirty = editing
    ? draft.customer.trim() !== editing.customer ||
      draft.address.trim() !== editing.address ||
      ibanValue !== normalizeIban(editing.iban)
    : false;

  function close() {
    const wasEditing = editingId !== null;
    setEditingId(null);
    setDraft(emptySite());
    if (!wasEditing) router.push("/clients");
  }

  function beginEdit(site: Site) {
    setEditingId(site.id);
    setDraft(site);
  }

  function applyIban(raw: string) {
    const iban = normalizeIban(raw);
    setDraft((current) => ({ ...current, iban, bankName: bankFromIban(iban)?.name ?? "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || pendingId !== null || (editing ? !editDirty : false)) return false;
    setPendingId(editing?.id ?? "new");
    const result = await saveSite({ ...draft, iban: ibanValue });
    setPendingId(null);
    if (!result.ok) {
      notify(result.message, "error");
      return false;
    }
    notify(editing ? "Klients saglabāts." : "Klients pievienots.", "ok");
    if (!editing) setDraft(emptySite());
  }

  async function remove(id: string) {
    setPendingId(id);
    const result = await removeSite(id);
    setPendingId(null);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    notify("Klients dzēsts.", "ok");
    setConfirmSite(null);
    if (editingId === id) close();
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Klienti</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
            Nosaukums, adrese un IBAN vajag maksājuma failam. Banku nolasa no IBAN.
          </p>
        </div>
        <button type="button" onClick={() => router.push("/clients/new")} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34]">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Pievienot
        </button>
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {sites.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Klientu vēl nav.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#f7fbf8] text-xs tracking-wide text-[#5f756a] uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Pasūtītājs / Adrese</th>
                  <th className="px-4 py-3 font-medium">Bankas konts / Banka</th>
                  <th className="px-4 py-3 text-right font-medium">Darbības</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const mark = offerMarks[site.id];
                  const offerReady = Boolean(mark);
                  const offerLabel = offerButtonLabel(mark);
                  const needsReview = reviewSiteIds.includes(site.id);
                  const bankName = bankFromIban(site.iban)?.name;
                  return (
                    <tr key={site.id} className="border-t border-[#e4efe8]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{site.customer}</p>
                        <p className="mt-0.5 text-sm text-[#5f756a]">{site.address}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{site.iban || "Nav IBAN"}</p>
                        {bankName ? <p className="mt-0.5 text-sm text-[#5f756a]">{bankName}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {needsReview ? (
                            <span className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-[#fdeceb] px-2.5 py-1 text-xs font-semibold text-[#8a1c14]">
                              <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                              Cenas jāpārskata
                            </span>
                          ) : null}
                          <Tooltip text="Labot">
                            <button type="button" onClick={() => beginEdit(site)} className={iconButton} aria-label="Labot">
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                          </Tooltip>
                          {offerReady ? null : (
                            <Tooltip text="Kopēt piedāvājumu">
                              <button type="button" onClick={() => setCopySite(site)} className={iconButton} aria-label="Kopēt piedāvājumu">
                                <Copy className="size-4" aria-hidden="true" />
                              </button>
                            </Tooltip>
                          )}
                          <Tooltip text={offerLabel}>
                            <button type="button" onClick={() => setOfferSite(site)} className={mark?.fixed ? tameButton : iconButton} aria-label={offerLabel}>
                              {offerReady ? (mark?.fixed ? <FileCheck className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />) : <FilePlus className="size-4" aria-hidden="true" />}
                              {mark?.fixed && mark.extras > 0 ? (
                                <span
                                  aria-hidden="true"
                                  className={`absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white ${mark.openExtra ? "bg-[#b42318]" : "bg-[#1f8a4c]"}`}
                                >
                                  {mark.extras}
                                </span>
                              ) : null}
                            </button>
                          </Tooltip>
                          <Tooltip text="Dzēst">
                            <button
                              type="button"
                              onClick={() => setConfirmSite(site)}
                              className={`${iconButton} text-[#b42318] hover:bg-[#fdeceb]`}
                              aria-label="Dzēst"
                            >
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
          </div>
        )}
      </section>
      {creating || editing ? (
        <RightDrawer
          title={editing ? "Labot klientu" : "Jauns klients"}
          hint=""
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
                disabled={pendingId !== null || !complete || (editing ? !editDirty : false)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
              >
                {editing ? <Check className="size-4 shrink-0" aria-hidden="true" /> : <Plus className="size-4 shrink-0" aria-hidden="true" />}
                {editing ? "Saglabāt" : "Pievienot"}
              </button>
            </>
          )}
        >
          <label className="block text-sm font-medium">
            Nosaukums
            <input
              value={draft.customer}
              onChange={(event) => setDraft((current) => ({ ...current, customer: event.target.value }))}
              className={fieldClass}
              placeholder="Uzņēmums vai persona"
            />
          </label>
          <label className="block text-sm font-medium">
            Adrese
            <input
              value={draft.address}
              onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
              className={fieldClass}
              placeholder="Iela, pilsēta"
            />
          </label>
          <label className="block text-sm font-medium">
            IBAN
            <input
              value={draft.iban}
              onChange={(event) => {
                const iban = event.target.value.toUpperCase();
                setDraft((current) => ({ ...current, iban, bankName: bankFromIban(normalizeIban(iban))?.name ?? "" }));
              }}
              onBlur={(event) => applyIban(event.target.value)}
              spellCheck={false}
              className={fieldClass}
              placeholder="LV00BANK0000000000000"
            />
            {ibanHint(draft.iban)}
          </label>
        </RightDrawer>
      ) : null}
      {offerSite ? (
        <OfferEditor
          site={offerSite}
          onClose={() => {
            setOfferSite(null);
            void refreshOffers();
          }}
          onReady={() =>
            setOfferMarks((current) =>
              current[offerSite.id] ? current : { ...current, [offerSite.id]: { fixed: false, extras: 0, openExtra: false } },
            )
          }
        />
      ) : null}
      {copySite ? (
        <CopyOfferModal
          sites={sites.filter((site) => site.id !== copySite.id && offerMarks[site.id])}
          copyingId={copyingId}
          onClose={() => {
            if (!copyingId) setCopySite(null);
          }}
          onCopy={(sourceId) => void copyOffer(sourceId)}
        />
      ) : null}
      {confirmSite ? (
        <ConfirmModal
          title="Dzēst klientu?"
          text={`${confirmSite.customer} tiks dzēsts.`}
          pending={pendingId === confirmSite.id}
          onCancel={() => {
            if (pendingId !== confirmSite.id) setConfirmSite(null);
          }}
          onConfirm={() => void remove(confirmSite.id)}
        />
      ) : null}
    </div>
  );
}

function CopyOfferModal({
  sites,
  copyingId,
  onClose,
  onCopy,
}: {
  sites: Site[];
  copyingId: string | null;
  onClose: () => void;
  onCopy: (siteId: string) => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !copyingId) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, copyingId]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#12382c]/35 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !copyingId) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="copy-offer-title" className="flex max-h-[min(32rem,calc(100vh-2rem))] w-full max-w-md flex-col rounded-3xl bg-white p-6 text-[#143028] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="copy-offer-title" className="text-lg font-semibold">Kopēt piedāvājumu</h2>
          <button type="button" onClick={onClose} disabled={copyingId !== null} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#5f756a] disabled:text-[#c5d8cc]" aria-label="Aizvērt">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-[#5f756a]">Izvēlies klientu, kura piedāvājumu nokopēt. Pēc kopēšanas var pārskatīt cenu izmaiņas.</p>
        {sites.length === 0 ? (
          <p className="mt-5 text-sm text-[#5f756a]">Nevienam citam klientam vēl nav piedāvājuma.</p>
        ) : (
          <ul className="mt-5 min-h-0 flex-1 divide-y divide-[#e4efe8] overflow-y-auto rounded-2xl border border-[#d3e4da]">
            {sites.map((site) => (
              <li key={site.id}>
                <button
                  type="button"
                  disabled={copyingId !== null}
                  onClick={() => onCopy(site.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#f4faf6] disabled:text-[#8aa396]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{site.customer}</span>
                    {site.address ? <span className="mt-0.5 block truncate text-sm text-[#5f756a]">{site.address}</span> : null}
                  </span>
                  <Copy className="size-4 shrink-0 text-[#1a6b4a]" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ibanHint(value: string) {
  const iban = normalizeIban(value);
  if (iban === "") return null;
  if (!isValidIban(iban)) return <span className="mt-1 block text-xs font-normal text-[#b42318]">IBAN nav derīgs.</span>;
  const bank = bankFromIban(iban);
  return bank ? <span className="mt-1 block text-xs font-normal text-[#5f756a]">{bank.name}</span> : null;
}

const iconButton = "grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]";

const tameButton = "relative grid size-9 place-items-center rounded-xl bg-[#143028] text-white hover:bg-[#0d241c]";

type OfferMark = { fixed: boolean; extras: number; openExtra: boolean };

function offerButtonLabel(mark: OfferMark | undefined) {
  if (!mark) return "Izveidot piedāvājumu";
  if (!mark.fixed) return "Apskatīt piedāvājumu";
  if (mark.extras === 0) return "Apskatīt tāmi";
  if (mark.openExtra) return "Apskatīt tāmi. Papildu darbu tāme nav nofiksēta.";
  return "Apskatīt tāmi. Papildu darbu tāmes ir nofiksētas.";
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
