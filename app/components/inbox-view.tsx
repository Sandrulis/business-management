"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { DateField } from "@/app/components/date-field";
import { EmailFrame } from "@/app/components/email-frame";
import { FloatingPanel } from "@/app/components/floating-panel";
import { PdfPreview } from "@/app/components/pdf-preview";
import { useInvoices } from "@/app/components/invoice-state";
import { useOfferCategories } from "@/app/components/use-offer-categories";
import { formatFileSize, invoicePreviewKind } from "@/app/lib/invoices/files";
import { formatDate, vatGross, type InboxItem } from "@/app/lib/invoices/model";
import { type InvoiceRead } from "@/app/lib/invoices/parse-invoice-text";
import { readInvoiceFile } from "@/app/lib/invoices/read-invoice-file";
import { isValidIban } from "@/app/lib/payments/iban";
import { Mail, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function InboxView() {
  const { inbox, addUpload, discardInbox, loadUnreadMail, settings } = useInvoices();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InboxItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [loadingMail, setLoadingMail] = useState(false);
  const mailboxReady = settings.mailboxes.some((mailbox) => mailbox.email.trim().length > 0 && mailbox.password.length > 0);
  const selected = inbox.find((item) => item.id === selectedId) ?? inbox[0] ?? null;

  async function removeItem(id: string) {
    setDeletingId(id);
    const result = await discardInbox(id);
    setDeletingId(null);
    if (result.ok) setDeleteTarget(null);
  }

  async function loadMail() {
    if (!mailboxReady || loadingMail) return;
    setLoadingMail(true);
    try {
      await loadUnreadMail();
    } finally {
      setLoadingMail(false);
    }
  }

  const uploadRef = useRef(addUpload);
  uploadRef.current = addUpload;

  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes("Files");
    }

    function onEnter(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setOver(true);
    }

    function onOver(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
    }

    function onLeave(event: DragEvent) {
      if (!hasFiles(event) || event.relatedTarget) return;
      setOver(false);
    }

    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setOver(false);
      const files = event.dataTransfer?.files;
      if (!files) return;
      for (const file of files) void uploadRef.current(file);
    }

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Apstrādei</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
            Ievelc rēķinu šajā lapā vai ielādē neizlasītos e-pastus. Ielasītais e-pasts tiek atzīmēts kā izlasīts. Pēc apstrādes rēķins nonāk sarakstā.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMail()}
          disabled={!mailboxReady || loadingMail}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
        >
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          {loadingMail ? "Ielādē..." : "Ielādēt epastus"}
        </button>
      </div>
      {mailboxReady ? null : (
        <p className="mt-3 text-sm text-[#5f756a]">Poga ieslēdzas, kad uzstādījumos ir saglabāts rēķinu e-pasts.</p>
      )}

      {over
        ? createPortal(
            <div className="fixed inset-0 z-[75] grid place-items-center bg-[#1a6b4a]/85 px-6 text-center text-white">
              <p className="text-3xl font-semibold tracking-tight">Ievelc failus</p>
            </div>,
            document.body,
          )
        : null}

      {inbox.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#d3e4da] bg-white px-6 py-16 text-center">
          <h2 className="font-semibold">Visi rēķini ir apstrādāti</h2>
          <p className="mt-2 text-sm text-[#5f756a]">Jauni e-pasta rēķini un augšupielādes parādīsies šeit.</p>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
            {inbox.map((item) => {
              const active = item.id === selected?.id;
              const fileLabel = item.fileName ?? (item.source === "upload" ? "Augšupielāde" : item.fromEmail);
              return (
                <div
                  key={item.id}
                  className={`border-b border-[#e4efe8] last:border-b-0 ${active ? "bg-[#e3f3ea]" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`block w-full px-4 pt-4 text-left ${active ? "" : "hover:bg-[#f4faf6]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{item.supplier}</p>
                      <p className="text-xs text-[#5f756a]">{formatDate(item.receivedOn)}</p>
                    </div>
                    <p className="mt-1 truncate text-sm">{item.subject}</p>
                    <p className="mt-2 truncate text-xs text-[#5f756a]">{fileLabel}</p>
                    {item.fileName && item.fileSize != null ? (
                      <p className="mt-1 text-xs text-[#5f756a]">{formatFileSize(item.fileSize)}</p>
                    ) : null}
                  </button>
                  <div className="flex justify-end px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#b42318]"
                    >
                      <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                      Dzēst
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {selected ? (
            <div className="min-w-0">
              <ReviewForm key={selected.id} item={selected} />
              <EmailBody text={selected.bodyText} />
              <InvoicePreview item={selected} />
            </div>
          ) : null}
        </div>
      )}
      {deleteTarget ? (
        <ConfirmModal
          title="Dzēst no apstrādes?"
          text={`${deleteTarget.fileName || deleteTarget.subject} tiks noņemts un netiks pievienots sarakstam.`}
          pending={deletingId === deleteTarget.id}
          onCancel={() => {
            if (deletingId) return;
            setDeleteTarget(null);
          }}
          onConfirm={() => void removeItem(deleteTarget.id)}
        />
      ) : null}
    </div>
  );
}

function ReviewForm({ item }: { item: InboxItem }) {
  const { approve, discardInbox, notify, sites } = useInvoices();
  const [objectId, setObjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categories = useOfferCategories(objectId);
  const [number, setNumber] = useState(item.number);
  const [issuedOn, setIssuedOn] = useState("");
  const [net, setNet] = useState(item.net?.toString() ?? "");
  const [gross, setGross] = useState(item.gross?.toString() ?? "");
  const [dueOn, setDueOn] = useState(item.dueOn ?? "");
  const [grossEdited, setGrossEdited] = useState(item.gross != null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const touched = useRef({ number: false, issuedOn: false, dueOn: false, net: false, gross: false });
  const { read, status } = useInvoiceRead(item);
  const site = sites.find((entry) => entry.id === objectId) ?? null;
  const category = categories.find((entry) => entry.id === categoryId) ?? null;
  const netValue = parseAmount(net);
  const grossValue = parseAmount(gross);
  const canSubmit =
    sites.length > 0 &&
    !deleting &&
    site != null &&
    category != null &&
    issuedOn.trim() !== "" &&
    dueOn.trim() !== "" &&
    hasAmount(net) &&
    hasAmount(gross) &&
    grossValue >= netValue;

  useEffect(() => {
    if (!read) return;
    if (read.number && !touched.current.number) setNumber(read.number);
    if (read.issuedOn && !touched.current.issuedOn) setIssuedOn(read.issuedOn);
    if (read.dueOn && !touched.current.dueOn) setDueOn(read.dueOn);
    if (read.net != null && !touched.current.net) setNet(read.net.toFixed(2));
    if (read.gross != null && !touched.current.gross) {
      setGross(read.gross.toFixed(2));
      setGrossEdited(!read.grossFromVat);
    }
  }, [read]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !site || !category) {
      notify("Izvēlieties klientu un pozīciju, un aizpildiet numuru, datumus un summas.", "error");
      return;
    }

    approve(item.id, {
      client: site.customer,
      objectId: site.id,
      objectName: site.address,
      categoryId: category.id,
      categoryName: category.name,
      number,
      issuedOn,
      net: netValue,
      gross: grossValue,
      dueOn,
    });
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">
        {item.source === "upload" ? "Augšupielādēts rēķins" : "E-pasta rēķins"}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{item.subject}</h2>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <Info label="No" value={item.fromEmail} />
        <Info label="Saņemts" value={formatDate(item.receivedOn)} />
        <Info label="Piegādātājs" value={item.supplier} />
        <Info label="Temats" value={item.subject} />
      </dl>

      {sites.length === 0 ? (
        <p className="mt-6 text-sm text-[#5f756a]">Vispirms sadaļā Klienti pievieno vismaz vienu klientu.</p>
      ) : null}

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
              <option key={entry.id} value={entry.id}>
                {entry.customer}, {entry.address}
              </option>
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
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          {site && categories.length === 0 ? (
            <span className="mt-1 block text-xs font-normal text-[#5f756a]">Šim klientam piedāvājumā nav kategoriju.</span>
          ) : null}
        </label>
        <label className="block text-sm font-medium">
          Rēķina numurs
          <input
            value={number}
            onChange={(event) => {
              touched.current.number = true;
              setNumber(event.target.value);
            }}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Rēķina datums
          <DateField
            value={issuedOn}
            onChange={(value) => {
              touched.current.issuedOn = true;
              setIssuedOn(value);
            }}
          />
        </label>
        <div className="grid items-end gap-4 sm:col-span-2 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Bez PVN
            <input
              value={net}
              onChange={(event) => {
                touched.current.net = true;
                setNet(event.target.value);
              }}
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
                touched.current.gross = true;
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
            <DateField
              value={dueOn}
              onChange={(value) => {
                touched.current.dueOn = true;
                setDueOn(value);
              }}
            />
          </label>
        </div>
        <p className="text-sm text-[#5f756a] sm:col-span-2">{readStatus(status, read)}</p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#b42318]">
          <Trash2 className="size-4 shrink-0" aria-hidden="true" />
          Dzēst
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Pievienot sarakstam
        </button>
      </div>
      {confirmDelete ? (
        <ConfirmModal
          title="Dzēst no apstrādes?"
          text={`${item.fileName || item.subject} tiks noņemts un netiks pievienots sarakstam.`}
          pending={deleting}
          onCancel={() => {
            if (!deleting) setConfirmDelete(false);
          }}
          onConfirm={() => {
            setDeleting(true);
            void discardInbox(item.id).finally(() => {
              setDeleting(false);
              setConfirmDelete(false);
            });
          }}
        />
      ) : null}
    </form>
  );
}

function EmailBody({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <FloatingPanel storageKey="bm-float-email" title="E-pasta teksts">
      <EmailFrame text={text} />
    </FloatingPanel>
  );
}

function InvoicePreview({ item }: { item: InboxItem }) {
  if (!item.fileName) return null;
  return (
    <FloatingPanel storageKey="bm-float-file" title="Rēķina fails">
      <InvoiceFile item={item} />
    </FloatingPanel>
  );
}

function InvoiceFile({ item }: { item: InboxItem }) {
  if (!item.fileName) return null;
  if (!item.fileMime) {
    return <p className="text-sm text-[#5f756a]">Šim rēķinam fails nav saglabāts. Ievelc to vēlreiz, lai var apskatīt.</p>;
  }

  const src = `/api/inbox/${item.id}/file`;
  const kind = invoicePreviewKind(item.fileMime, item.fileName);
  if (kind === "pdf") return <PdfPreview src={src} name={item.fileName} bare />;
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={item.fileName} className="w-full rounded-xl bg-white" />
    );
  }
  return (
    <a href={src} className="text-sm font-semibold text-[#1a6b4a]">
      Atvērt {item.fileName}
    </a>
  );
}

function useInvoiceRead(item: InboxItem) {
  const [read, setRead] = useState<InvoiceRead | null>(null);
  const [status, setStatus] = useState<"reading" | "done" | "empty" | "skip">("reading");

  useEffect(() => {
    const kind = item.fileName && item.fileMime ? invoicePreviewKind(item.fileMime, item.fileName) : "file";
    if (!item.fileName || !item.fileMime) {
      setRead(null);
      setStatus("skip");
      return;
    }
    if (kind === "file") {
      setRead(null);
      setStatus("empty");
      return;
    }
    let cancelled = false;
    setRead(null);
    setStatus("reading");
    void readInvoiceFile(`/api/inbox/${item.id}/file`, kind, () => cancelled)
      .then((result) => {
        if (cancelled) return;
        setRead(result);
        const found = Boolean(result.number || result.issuedOn || result.dueOn || result.net != null || result.gross != null);
        setStatus(found ? "done" : "empty");
      })
      .catch(() => {
        if (!cancelled) {
          setRead(null);
          setStatus("empty");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [item.fileMime, item.fileName, item.id]);

  return { read, status };
}

function readStatus(status: "reading" | "done" | "empty" | "skip", read: InvoiceRead | null) {
  if (status === "skip") return "";
  if (status === "reading") return "Nolasu datus no faila...";
  if (status === "empty" || !read) return "Failā šos laukus neizdevās nolasīt.";
  const parts = [
    read.number ? "rēķina numurs" : "",
    read.issuedOn ? "rēķina datums" : "",
    read.dueOn ? "apmaksas termiņš" : "",
    read.net != null ? "summa bez PVN" : "",
    read.gross != null ? (read.grossFromVat ? "summa ar PVN (21%)" : "summa ar PVN") : "",
  ].filter(Boolean);
  return `No faila nolasīts: ${parts.join(", ")}.`;
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
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15 disabled:bg-[#eef5f0]";
