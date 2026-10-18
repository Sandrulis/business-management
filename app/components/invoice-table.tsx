"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { InvoiceEditModal } from "@/app/components/invoice-edit-modal";
import { InvoicePreviewModal } from "@/app/components/invoice-preview-modal";
import { useInvoices } from "@/app/components/invoice-state";
import { Tooltip } from "@/app/components/tooltip";
import { duePhrase, formatDate, formatMoney, type Invoice } from "@/app/lib/invoices/model";
import { Check, FileText, Pencil } from "lucide-react";
import { useState } from "react";

export function InvoiceTable({
  invoices,
  today,
  empty,
}: {
  invoices: Invoice[];
  today: string;
  empty: string;
}) {
  const { markPaid } = useInvoices();
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payingPending, setPayingPending] = useState(false);
  const currentEdit = editing ? (invoices.find((invoice) => invoice.id === editing.id) ?? editing) : null;

  async function confirmPaid() {
    if (!paying) return;
    setPayingPending(true);
    const result = await markPaid(paying.id);
    setPayingPending(false);
    if (result.ok) setPaying(null);
  }

  if (invoices.length === 0) {
    return <p className="mt-8 rounded-3xl border border-[#d3e4da] bg-white px-6 py-14 text-center text-sm text-[#5f756a]">{empty}</p>;
  }

  return (
    <>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-[#5f756a] uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Datums</th>
                <th className="px-3 py-3 font-medium">Termiņš</th>
                <th className="px-3 py-3 font-medium">Summa</th>
                <th className="px-3 py-3 font-medium">Klients</th>
                <th className="px-6 py-3 text-right font-medium">Darbības</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4efe8]">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-[#f4faf6]">
                  <td className="px-6 py-4">
                    <p className="font-medium">{formatDate(invoice.issuedOn)}</p>
                    <p className="mt-1 text-xs text-[#5f756a]">{invoice.number}</p>
                  </td>
                  <td className="px-3 py-4">
                    <Due invoice={invoice} today={today} />
                  </td>
                  <td className="px-3 py-4">
                    <Amount invoice={invoice} />
                  </td>
                  <td className="px-3 py-4">
                    <p className="font-medium">{invoice.client}</p>
                    {invoice.objectName ? <p className="mt-1 text-xs text-[#5f756a]">{invoice.objectName}</p> : null}
                  </td>
                  <td className="px-6 py-4">
                    <Actions invoice={invoice} onEdit={setEditing} onPreview={setPreview} onPaid={setPaying} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-[#e4efe8] md:hidden">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatDate(invoice.issuedOn)}</p>
                  <p className="mt-1 text-xs text-[#5f756a]">{invoice.number}</p>
                </div>
                <Actions invoice={invoice} onEdit={setEditing} onPreview={setPreview} onPaid={setPaying} />
              </div>
              <div className="mt-3">
                <Due invoice={invoice} today={today} />
              </div>
              <div className="mt-3">
                <Amount invoice={invoice} />
              </div>
              <p className="mt-3 font-medium">{invoice.client}</p>
              {invoice.objectName ? <p className="mt-1 text-xs text-[#5f756a]">{invoice.objectName}</p> : null}
            </article>
          ))}
        </div>
      </section>
      {currentEdit && !currentEdit.paid ? <InvoiceEditModal invoice={currentEdit} onClose={() => setEditing(null)} /> : null}
      {preview?.storagePath && preview.fileName ? (
        <InvoicePreviewModal
          src={`/api/invoices/${preview.id}/file`}
          name={preview.fileName}
          mime={preview.fileMime}
          onClose={() => setPreview(null)}
        />
      ) : null}
      {paying ? (
        <ConfirmModal
          title="Vai tiešām ir apmaksāts?"
          text={`Rēķins ${paying.number} tiks atzīmēts kā apmaksāts.`}
          confirmLabel="Apmaksāts"
          tone="primary"
          pending={payingPending}
          onCancel={() => {
            if (!payingPending) setPaying(null);
          }}
          onConfirm={() => void confirmPaid()}
        />
      ) : null}
    </>
  );
}

function Amount({ invoice }: { invoice: Invoice }) {
  return (
    <div>
      <p className="font-semibold tabular-nums">{formatMoney(invoice.gross)}</p>
      <p className="mt-1 text-xs text-[#5f756a] tabular-nums">{formatMoney(invoice.net)} bez PVN</p>
      {invoice.categoryName ? <p className="mt-1 text-xs text-[#5f756a]">{invoice.categoryName}</p> : null}
    </div>
  );
}

function Due({ invoice, today }: { invoice: Invoice; today: string }) {
  if (invoice.paid) {
    return (
      <div>
        <p className="font-medium">{formatDate(invoice.dueOn)}</p>
        <StatusBadge tone="paid">Apmaksāts</StatusBadge>
      </div>
    );
  }
  const phrase = duePhrase(invoice.dueOn, today);
  return (
    <div>
      <p className="font-medium">
        {formatDate(invoice.dueOn)}
        <span className={phrase.overdue ? "text-[#b42318]" : "font-normal text-[#5f756a]"}> · {phrase.text}</span>
      </p>
      <StatusBadge tone={phrase.overdue ? "overdue" : "unpaid"}>{phrase.overdue ? "Nokavēts" : "Neapmaksāts"}</StatusBadge>
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: "unpaid" | "overdue" | "paid"; children: string }) {
  const toneClass = {
    unpaid: "bg-[#fde8e6] text-[#b42318]",
    overdue: "bg-[#f8d0cc] text-[#8a1c14]",
    paid: "bg-[#e5f6ea] text-[#0f4a34]",
  }[tone];
  return <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

function Actions({
  invoice,
  onEdit,
  onPreview,
  onPaid,
}: {
  invoice: Invoice;
  onEdit: (invoice: Invoice) => void;
  onPreview: (invoice: Invoice) => void;
  onPaid: (invoice: Invoice) => void;
}) {
  const hasFile = Boolean(invoice.storagePath && invoice.fileName);
  return (
    <div className="flex justify-end gap-1">
      {invoice.paid ? null : (
        <Tooltip text="Labot">
          <button type="button" onClick={() => onEdit(invoice)} className="grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]" aria-label="Labot">
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
      <Tooltip text={hasFile ? "Apskatīt failu" : "Fails nav saglabāts"}>
        <button
          type="button"
          onClick={() => onPreview(invoice)}
          disabled={!hasFile}
          className="grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec] disabled:text-[#c5d8cc]"
          aria-label={hasFile ? "Apskatīt failu" : "Fails nav saglabāts"}
        >
          <FileText className="size-4" aria-hidden="true" />
        </button>
      </Tooltip>
      {invoice.paid ? null : (
        <Tooltip text="Apmaksāts">
          <button type="button" onClick={() => onPaid(invoice)} className="grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]" aria-label="Apmaksāts">
            <Check className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
