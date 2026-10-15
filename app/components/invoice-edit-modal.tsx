"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { EmailFrame } from "@/app/components/email-frame";
import { InvoicePreviewModal } from "@/app/components/invoice-preview-modal";
import { useInvoices } from "@/app/components/invoice-state";
import { formatFileSize } from "@/app/lib/invoices/files";
import { formatDate, vatGross, type Invoice } from "@/app/lib/invoices/model";
import { isValidIban } from "@/app/lib/payments/iban";
import { FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function InvoiceEditModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { notify, saveInvoice, sites, works } = useInvoices();
  const [objectId, setObjectId] = useState(invoice.objectId ?? "");
  const [workId, setWorkId] = useState(invoice.workId ?? "");
  const [number, setNumber] = useState(invoice.number);
  const [issuedOn, setIssuedOn] = useState(invoice.issuedOn);
  const [dueOn, setDueOn] = useState(invoice.dueOn);
  const [net, setNet] = useState(invoice.net.toFixed(2));
  const [gross, setGross] = useState(invoice.gross.toFixed(2));
  const [grossEdited, setGrossEdited] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [preview, setPreview] = useState(false);
  const site = sites.find((entry) => entry.id === objectId) ?? null;
  const work = works.find((entry) => entry.id === workId) ?? null;
  const netValue = parseAmount(net);
  const grossValue = parseAmount(gross);
  const dirty =
    objectId !== (invoice.objectId ?? "") ||
    workId !== (invoice.workId ?? "") ||
    number !== invoice.number ||
    issuedOn !== invoice.issuedOn ||
    dueOn !== invoice.dueOn ||
    netValue !== invoice.net ||
    grossValue !== invoice.gross;
  const canSave =
    !saving &&
    site != null &&
    work != null &&
    number.trim() !== "" &&
    issuedOn.trim() !== "" &&
    dueOn.trim() !== "" &&
    hasAmount(net) &&
    hasAmount(gross) &&
    grossValue >= netValue &&
    dirty;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || preview || confirmClose) return;
      if (dirty) setConfirmClose(true);
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmClose, dirty, onClose, preview]);

  function askClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  async function save() {
    if (!canSave || !site || !work) return;
    setSaving(true);
    const result = await saveInvoice({
      ...invoice,
      number: number.trim(),
      client: site.customer,
      objectId: site.id,
      objectName: site.address,
      workId: work.id,
      workName: work.name,
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
    onClose();
  }

  const fileSrc = invoice.storagePath ? `/api/invoices/${invoice.id}/file` : "";

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[#12382c]/35 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || saving || preview || confirmClose) return;
        askClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="invoice-edit-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white text-[#143028] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4efe8] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Labot rēķinu</p>
            <h2 id="invoice-edit-title" className="mt-1 text-xl font-semibold tracking-tight">{invoice.number}</h2>
          </div>
          <button type="button" onClick={askClose} className="grid size-8 place-items-center rounded-lg text-[#5f756a]" aria-label="Aizvērt">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Piegādātājs" value={invoice.supplier} />
            {invoice.fromEmail ? <Info label="No" value={invoice.fromEmail} /> : null}
            {invoice.subject ? <Info label="Temats" value={invoice.subject} /> : null}
            <Info label="Datums" value={formatDate(invoice.issuedOn)} />
          </dl>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Klients
              <select value={objectId} onChange={(event) => setObjectId(event.target.value)} className={fieldClass}>
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
              Darbs
              <select value={workId} onChange={(event) => setWorkId(event.target.value)} className={fieldClass}>
                <option value="">Izvēlēties darbu</option>
                {works.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
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
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e4efe8] px-5 py-4 sm:px-6">
          <button type="button" onClick={askClose} disabled={saving} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f] disabled:text-[#5f756a]">
            Atcelt
          </button>
          <button type="button" onClick={() => void save()} disabled={!canSave} className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]">
            {saving ? "Saglabā..." : "Saglabāt"}
          </button>
        </div>
      </div>
      {confirmClose ? (
        <ConfirmModal
          title="Aizvērt bez saglabāšanas?"
          text="Nesaglabātās izmaiņas pazudīs."
          confirmLabel="Aizvērt"
          onCancel={() => setConfirmClose(false)}
          onConfirm={onClose}
        />
      ) : null}
      {preview && fileSrc ? (
        <InvoicePreviewModal src={fileSrc} name={invoice.fileName || "Rēķins"} mime={invoice.fileMime} onClose={() => setPreview(false)} />
      ) : null}
    </div>,
    document.body,
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
