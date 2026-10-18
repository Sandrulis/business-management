"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { EmailFrame } from "@/app/components/email-frame";
import { InvoicePreviewModal } from "@/app/components/invoice-preview-modal";
import { useInvoices } from "@/app/components/invoice-state";
import { useOfferCategories } from "@/app/components/use-offer-categories";
import { RightDrawer } from "@/app/components/right-drawer";
import { formatFileSize } from "@/app/lib/invoices/files";
import { formatDate, vatGross, type Invoice } from "@/app/lib/invoices/model";
import { isValidIban } from "@/app/lib/payments/iban";
import { Check, FileText, X } from "lucide-react";
import { useRef, useState } from "react";

export function InvoiceEditModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { notify, saveInvoice, sites } = useInvoices();
  const [objectId, setObjectId] = useState(invoice.objectId ?? "");
  const [categoryId, setCategoryId] = useState(invoice.categoryId);
  const [number, setNumber] = useState(invoice.number);
  const [issuedOn, setIssuedOn] = useState(invoice.issuedOn);
  const [dueOn, setDueOn] = useState(invoice.dueOn);
  const [net, setNet] = useState(invoice.net.toFixed(2));
  const [gross, setGross] = useState(invoice.gross.toFixed(2));
  const [grossEdited, setGrossEdited] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [preview, setPreview] = useState(false);
  const dismissRef = useRef<() => void>(() => {});
  const site = sites.find((entry) => entry.id === objectId) ?? null;
  const categories = useOfferCategories(objectId);
  const category = categories.find((entry) => entry.id === categoryId) ?? null;
  const netValue = parseAmount(net);
  const grossValue = parseAmount(gross);
  const dirty =
    objectId !== (invoice.objectId ?? "") ||
    categoryId !== invoice.categoryId ||
    number !== invoice.number ||
    issuedOn !== invoice.issuedOn ||
    dueOn !== invoice.dueOn ||
    netValue !== invoice.net ||
    grossValue !== invoice.gross;
  const canSave =
    !saving &&
    site != null &&
    category != null &&
    number.trim() !== "" &&
    issuedOn.trim() !== "" &&
    dueOn.trim() !== "" &&
    hasAmount(net) &&
    hasAmount(gross) &&
    grossValue >= netValue &&
    dirty;

  function blockClose() {
    if (saving || confirmClose || preview) return false;
    if (dirty) {
      setConfirmClose(true);
      return false;
    }
    return true;
  }

  async function save() {
    if (!canSave || !site || !category) return;
    setSaving(true);
    const result = await saveInvoice({
      ...invoice,
      number: number.trim(),
      client: site.customer,
      objectId: site.id,
      objectName: site.address,
      categoryId: category.id,
      categoryName: category.name,
      issuedOn,
      dueOn,
      net: netValue,
      gross: grossValue,
      supplierIban: "",
    });
    setSaving(false);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    notify("Rēķins saglabāts.", "ok");
    dismissRef.current();
  }

  const fileSrc = invoice.storagePath ? `/api/invoices/${invoice.id}/file` : "";

  return (
    <RightDrawer
      wide
      title="Labot rēķinu"
      hint={invoice.number}
      onClose={onClose}
      beforeClose={blockClose}
      dismissRef={dismissRef}
      footer={(close) => (
        <>
          <button type="button" onClick={close} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f] disabled:text-[#5f756a]">
            <X className="size-4 shrink-0" aria-hidden="true" />
            Atcelt
          </button>
          <button type="button" onClick={() => void save()} disabled={!canSave} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            {saving ? "Saglabā..." : "Saglabāt"}
          </button>
        </>
      )}
    >
      <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Piegādātājs" value={invoice.supplier} />
            {invoice.fromEmail ? <Info label="No" value={invoice.fromEmail} /> : null}
            {invoice.subject ? <Info label="Temats" value={invoice.subject} /> : null}
            <Info label="Datums" value={formatDate(invoice.issuedOn)} />
          </dl>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Klients
              <select
                value={objectId}
                onChange={(event) => {
                  setObjectId(event.target.value);
                  setCategoryId("");
                }}
                className={fieldClass}
              >
                <option value="">Izvēlēties klientu</option>
                {sites.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.customer}, {entry.address}</option>
                ))}
              </select>
              {site ? <span className="mt-1 block text-xs font-normal text-[#5f756a]">{site.address}</span> : null}
              {site && !isValidIban(site.iban) ? (
                <span className="mt-1 block text-xs font-normal text-[#b42318]">Šim klientam nav IBAN. To norādi sadaļā Klienti.</span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              Pozīcija
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!site} className={fieldClass}>
                <option value="">{site ? "Izvēlēties pozīciju" : "Vispirms izvēlies klientu"}</option>
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
              {site && categories.length === 0 ? (
                <span className="mt-1 block text-xs font-normal text-[#5f756a]">Šim klientam piedāvājumā nav kategoriju.</span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              Rēķina numurs
              <input value={number} onChange={(event) => setNumber(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm font-medium">
              Rēķina datums
              <DateField value={issuedOn} onChange={setIssuedOn} />
            </label>
            <div className="grid items-end gap-4 sm:col-span-2 sm:grid-cols-3">
              <label className="block text-sm font-medium">
                Bez PVN
                <input
                  value={net}
                  onChange={(event) => setNet(event.target.value)}
                  onBlur={() => {
                    const value = parseAmount(net);
                    if (!grossEdited && Number.isFinite(value) && value >= 0) setGross(vatGross(value).toFixed(2));
                  }}
                  inputMode="decimal"
                  className={fieldClass}
                  placeholder="0,00"
                />
              </label>
              <label className="block text-sm font-medium">
                Ar PVN
                <input
                  value={gross}
                  onChange={(event) => {
                    setGrossEdited(true);
                    setGross(event.target.value);
                  }}
                  inputMode="decimal"
                  className={fieldClass}
                  placeholder="0,00"
                />
              </label>
              <label className="block text-sm font-medium">
                Apmaksas termiņš
                <DateField value={dueOn} onChange={setDueOn} />
              </label>
            </div>
          </div>
          {invoice.bodyText.trim() ? (
            <section className="mt-6">
              <p className="text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">E-pasta teksts</p>
              <div className="mt-3">
                <EmailFrame text={invoice.bodyText} />
              </div>
            </section>
          ) : null}
          <section className="mt-6 rounded-2xl border border-[#d3e4da] px-4 py-3">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Fails</p>
            {invoice.fileName && invoice.storagePath ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invoice.fileName}</p>
                  {invoice.fileSize != null ? <p className="text-xs text-[#5f756a]">{formatFileSize(invoice.fileSize)}</p> : null}
                </div>
                <button type="button" onClick={() => setPreview(true)} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#1a6b4a]">
                  <FileText className="size-4" aria-hidden="true" />
                  Apskatīt
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#5f756a]">Šim rēķinam fails nav saglabāts.</p>
            )}
          </section>
      </>
      {confirmClose ? (
        <ConfirmModal
          title="Aizvērt bez saglabāšanas?"
          text="Nesaglabātās izmaiņas pazudīs."
          confirmLabel="Aizvērt"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            dismissRef.current();
          }}
        />
      ) : null}
      {preview && fileSrc ? (
        <InvoicePreviewModal
          beside={720}
          src={fileSrc}
          name={invoice.fileName || "Rēķins"}
          mime={invoice.fileMime}
          onClose={() => setPreview(false)}
        />
      ) : null}
    </RightDrawer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#eef5f0] px-4 py-3">
      <dt className="text-xs text-[#5f756a]">{label}</dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  );
}

function parseAmount(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function hasAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const amount = parseAmount(trimmed);
  return Number.isFinite(amount) && amount >= 0;
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
