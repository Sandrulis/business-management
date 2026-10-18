"use client";

import { InvoicePreviewModal } from "@/app/components/invoice-preview-modal";
import { Tooltip } from "@/app/components/tooltip";
import { formatDate, type Invoice } from "@/app/lib/invoices/model";
import { FileText } from "lucide-react";
import { useState, type ReactNode } from "react";

export type PriceDraft = {
  price: string;
  client: string;
  number: string;
  invoiceId: string;
};

export function emptyPrice(): PriceDraft {
  return { price: "", client: "", number: "", invoiceId: "" };
}

export function PriceEntryForm({
  draft,
  invoices,
  preview,
  previewBeside,
  previewFront = false,
  autoFocus = false,
  onChange,
  onPreview,
}: {
  draft: PriceDraft;
  invoices: Invoice[];
  preview: Invoice | null;
  previewBeside?: number;
  previewFront?: boolean;
  autoFocus?: boolean;
  onChange: (draft: PriceDraft) => void;
  onPreview: (invoice: Invoice | null) => void;
}) {
  return (
    <>
      <label className="block text-sm font-medium">
        Vienības cena
        <input
          value={draft.price}
          inputMode="decimal"
          autoFocus={autoFocus}
          onChange={(event) => onChange({ ...draft, price: event.target.value.replace(/[^\d,.\s-]/g, "") })}
          className={fieldClass}
          placeholder="0,00"
        />
      </label>
      <ClientField
        value={draft.client}
        invoices={invoices}
        onChange={(client) => {
          const picked = invoices.find((invoice) => invoice.id === draft.invoiceId);
          if (picked && !sameText(picked.client, client)) onChange({ ...draft, client, invoiceId: "", number: "" });
          else onChange({ ...draft, client });
        }}
      />
      <InvoiceNumberField
        value={draft.number}
        client={draft.client}
        invoiceId={draft.invoiceId}
        invoices={invoices}
        onChange={(number) => onChange({ ...draft, number, invoiceId: "" })}
        onPick={(invoice) =>
          onChange({
            ...draft,
            number: invoice.number,
            invoiceId: invoice.id,
            client: draft.client.trim() ? draft.client : invoice.client,
          })
        }
        onPreview={onPreview}
      />
      <p className="text-xs text-[#5f756a]">Klients un rēķins nav obligāti. Cenu var saglabāt arī bez tiem.</p>
      {preview?.storagePath && preview.fileName ? (
        <InvoicePreviewModal
          beside={previewBeside}
          front={previewFront}
          src={`/api/invoices/${preview.id}/file`}
          name={preview.fileName}
          mime={preview.fileMime}
          onClose={() => onPreview(null)}
        />
      ) : null}
    </>
  );
}

function ClientField({
  value,
  invoices,
  onChange,
}: {
  value: string;
  invoices: Invoice[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const names = clientNames(invoices);
  const hints = filterHints(names, typed ? value : "", (name) => name);
  return (
    <label className="block text-sm font-medium">
      Klients
      <input
        value={value}
        onChange={(event) => {
          setTyped(true);
          onChange(event.target.value);
        }}
        onFocus={() => {
          setTyped(false);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={fieldClass}
        placeholder="Sāc rakstīt klientu"
        autoComplete="off"
      />
      {open ? (
        <HintList empty={hints.length === 0} query={typed ? value : ""}>
          {hints.map((name) => (
            <HintRow
              key={name}
              title={name}
              onPick={() => {
                onChange(name);
                setOpen(false);
              }}
            />
          ))}
        </HintList>
      ) : null}
    </label>
  );
}

function InvoiceNumberField({
  value,
  client,
  invoiceId,
  invoices,
  onChange,
  onPick,
  onPreview,
}: {
  value: string;
  client: string;
  invoiceId: string;
  invoices: Invoice[];
  onChange: (value: string) => void;
  onPick: (invoice: Invoice) => void;
  onPreview: (invoice: Invoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const pool = invoicesForClient(invoices, client);
  const hints = filterHints(pool, typed ? value : "", (invoice) => invoice.number);
  const picked = invoices.find((invoice) => invoice.id === invoiceId);
  return (
    <label className="block text-sm font-medium">
      Rēķina numurs
      <input
        value={value}
        onChange={(event) => {
          setTyped(true);
          onChange(event.target.value);
        }}
        onFocus={() => {
          setTyped(false);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={fieldClass}
        placeholder="Sāc rakstīt numuru"
        autoComplete="off"
      />
      {picked ? <span className="mt-1 block text-xs font-normal text-[#5f756a]">{formatDate(picked.issuedOn)}</span> : null}
      {open ? (
        <HintList empty={hints.length === 0} query={typed ? value : ""}>
          {hints.map((invoice) => {
            const hasFile = Boolean(invoice.storagePath && invoice.fileName);
            return (
              <HintRow
                key={invoice.id}
                title={invoice.number}
                detail={formatDate(invoice.issuedOn)}
                onPick={() => {
                  onPick(invoice);
                  setOpen(false);
                }}
                action={
                  <Tooltip text={hasFile ? "Apskatīt" : "Fails nav saglabāts"}>
                    <button
                      type="button"
                      aria-label={hasFile ? "Apskatīt" : "Fails nav saglabāts"}
                      disabled={!hasFile}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onPreview(invoice)}
                      className="grid size-8 place-items-center rounded-lg text-[#1a6b4a] hover:bg-[#e7f6ec] disabled:text-[#c5d8cc]"
                    >
                      <FileText className="size-4" aria-hidden="true" />
                    </button>
                  </Tooltip>
                }
              />
            );
          })}
        </HintList>
      ) : null}
    </label>
  );
}

function HintList({ empty, query, children }: { empty: boolean; query: string; children: ReactNode }) {
  return (
    <ul className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#d3e4da] bg-white py-1 shadow-lg">
      {empty ? (
        <li className="px-3 py-2 text-sm font-normal text-[#5f756a]">{query.trim() ? "Nekas neatbilst meklēšanai." : "Nav ko izvēlēties."}</li>
      ) : (
        children
      )}
    </ul>
  );
}

function HintRow({
  title,
  detail,
  onPick,
  action,
}: {
  title: string;
  detail?: string;
  onPick: () => void;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-1 pr-1 hover:bg-[#e7f6ec]">
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onPick} className="min-w-0 flex-1 px-3 py-2 text-left">
        <span className="block truncate text-sm font-semibold">{title}</span>
        {detail ? <span className="block text-xs font-normal text-[#5f756a]">{detail}</span> : null}
      </button>
      {action}
    </li>
  );
}

function clientNames(invoices: Invoice[]) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const invoice of [...invoices].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))) {
    const name = invoice.client.trim();
    const key = name.toLocaleLowerCase("lv");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function invoicesForClient(invoices: Invoice[], client: string) {
  const query = client.trim().toLocaleLowerCase("lv");
  const sorted = [...invoices].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || a.number.localeCompare(b.number, "lv"));
  if (!query) return sorted;
  const exact = sorted.filter((invoice) => sameText(invoice.client, client));
  if (exact.length > 0) return exact;
  return sorted.filter((invoice) => invoice.client.toLocaleLowerCase("lv").includes(query));
}

function filterHints<T>(items: T[], query: string, text: (item: T) => string) {
  const words = query.trim().toLocaleLowerCase("lv").split(/\s+/).filter(Boolean);
  const matched = words.length === 0 ? items : items.filter((item) => words.every((word) => text(item).toLocaleLowerCase("lv").includes(word)));
  return matched.slice(0, words.length === 0 ? 8 : 12);
}

function sameText(left: string, right: string) {
  return left.trim().toLocaleLowerCase("lv") === right.trim().toLocaleLowerCase("lv");
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
