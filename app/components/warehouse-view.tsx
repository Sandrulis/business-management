"use client";

import { InvoicePreviewModal } from "@/app/components/invoice-preview-modal";
import { useInvoices } from "@/app/components/invoice-state";
import { RightDrawer } from "@/app/components/right-drawer";
import { Tooltip } from "@/app/components/tooltip";
import { createLiveList } from "@/app/lib/catalog/live-list";
import { addMaterialReceipt, saveMaterialRecord, updateMaterialReceipt } from "@/app/lib/catalog/repository";
import type { Material, MaterialReceipt } from "@/app/lib/catalog/types";
import { formatDate, formatMoney, type Invoice } from "@/app/lib/invoices/model";
import { formatQuantity, formatUnitPrice, parseDecimal } from "@/app/lib/prices/model";
import { Check, FileText, History, Pencil, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

const materialsLive = createLiveList<Material>();

export function WarehouseView({ initialItems, available }: { initialItems: Material[]; available: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notify, invoices } = useInvoices();
  const open = pathname === "/warehouse/new";
  const [rows, publish] = materialsLive.useLiveList(initialItems, available);
  const [draft, setDraft] = useState({ name: "", unit: "" });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const complete = draft.name.trim() !== "" && draft.unit.trim() !== "";
  const adding = rows.find((row) => row.id === addingId) ?? null;
  const history = rows.find((row) => row.id === historyId) ?? null;

  useEffect(() => {
    if (!available) notify("Datubāze nav pieejama.", "error");
  }, [available, notify]);

  function close() {
    setDraft({ name: "", unit: "" });
    router.push("/warehouse");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const saved = await saveMaterialRecord({ name: draft.name, unit: draft.unit });
    savingRef.current = false;
    setSaving(false);
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    publish([saved.item, ...rows]);
    notify("Materiāls pievienots.", "ok");
    setDraft({ name: "", unit: "" });
  }

  async function saveStock(materialId: string, receipt: StockInput, receiptId?: string) {
    const saved = receiptId ? await updateMaterialReceipt(receiptId, receipt) : await addMaterialReceipt(materialId, receipt);
    if (!saved.ok) {
      notify(saved.message, "error");
      return false;
    }
    publish(
      rows.map((row) => {
        if (row.id !== materialId) return row;
        const receipts = receiptId
          ? row.receipts.map((item) => (item.id === saved.receipt.id ? saved.receipt : item))
          : [saved.receipt, ...row.receipts];
        return { ...row, receipts };
      }),
    );
    notify(receiptId ? "Atlikums saglabāts." : "Atlikums pievienots.", "ok");
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Noliktava</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Noliktavas materiāli, mērvienības un atlikums.</p>
        </div>
        <button type="button" onClick={() => router.push("/warehouse/new")} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34]">
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Pievienot
        </button>
      </div>
      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Noliktavā vēl nekā nav.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#f7fbf8] text-xs tracking-wide text-[#5f756a] uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Nosaukums / Mērvienība</th>
                  <th className="px-4 py-3 font-medium">Pēdējā cena / Veikals</th>
                  <th className="px-4 py-3 text-right font-medium">Atlikums</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const latest = row.receipts[0];
                  return (
                    <tr key={row.id} className="border-t border-[#e4efe8]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.name}</p>
                        <p className="mt-0.5 text-sm text-[#5f756a]">{row.unit}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium tabular-nums">{latest ? formatMoney(latest.amount) : "—"}</p>
                        {latest?.shop ? <p className="mt-0.5 text-sm text-[#5f756a]">{latest.shop}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setAddingId(row.id)}
                            className="min-w-9 rounded-lg px-2 py-1 text-base font-semibold tabular-nums text-[#1a6b4a] hover:bg-[#e7f6ec]"
                            aria-label="Pievienot atlikumu"
                          >
                            {formatQuantity(stockTotal(row.receipts))}
                          </button>
                          <Tooltip text="Vēsture">
                            <button
                              type="button"
                              onClick={() => setHistoryId(row.id)}
                              className={iconButton}
                              aria-label="Vēsture"
                            >
                              <History className="size-4" aria-hidden="true" />
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
      {open ? (
        <RightDrawer
          title="Pievienot materiālu"
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
                disabled={!complete || saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                Pievienot
              </button>
            </>
          )}
        >
          <label className="block text-sm font-medium">
            Nosaukums
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className={fieldClass}
              placeholder="Piemēram, skrūves"
            />
          </label>
          <label className="block text-sm font-medium">
            Mērvienība
            <input
              value={draft.unit}
              onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))}
              className={fieldClass}
              placeholder="m3"
            />
          </label>
        </RightDrawer>
      ) : null}
      {adding ? (
        <WarehouseStockDrawer
          unit={adding.unit}
          invoices={invoices}
          onClose={() => setAddingId(null)}
          onSave={(receipt) => saveStock(adding.id, receipt)}
        />
      ) : null}
      {history ? (
        <MaterialHistoryDrawer
          item={history}
          invoices={invoices}
          onClose={() => setHistoryId(null)}
          onSave={(receipt, receiptId) => saveStock(history.id, receipt, receiptId)}
        />
      ) : null}
    </div>
  );
}

function WarehouseStockDrawer({
  unit,
  invoices,
  receipt,
  beside,
  onClose,
  onSave,
}: {
  unit: string;
  invoices: Invoice[];
  receipt?: MaterialReceipt | null;
  beside?: number;
  onClose: () => void;
  onSave: (receipt: StockInput) => void | false | Promise<void | false>;
}) {
  const [quantity, setQuantity] = useState(() => (receipt ? formatQuantity(receipt.quantity) : ""));
  const [shop, setShop] = useState(() => receipt?.shop ?? "");
  const [amount, setAmount] = useState(() => (receipt ? formatUnitPrice(receipt.amount) : ""));
  const [invoiceId, setInvoiceId] = useState(() => receipt?.invoiceId ?? "");
  const [saving, setSaving] = useState(false);
  const count = parseDecimal(quantity);
  const sum = parseDecimal(amount);
  const complete = count != null && count > 0 && sum != null && sum >= 0;
  const editing = Boolean(receipt);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || count == null || sum == null || saving) return false;
    setSaving(true);
    const result = await onSave({ quantity: count, shop: shop.trim(), amount: sum, invoiceId: invoiceId || null });
    setSaving(false);
    return result;
  }

  return (
    <RightDrawer
      beside={beside}
      title={editing ? "Labot atlikumu" : "Pievienot atlikumu"}
      hint=""
      onClose={onClose}
      onSubmit={submit}
      footer={(dismiss) => (
        <>
          <button type="button" onClick={dismiss} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
            <X className="size-4 shrink-0" aria-hidden="true" />
            Atcelt
          </button>
          <button
            type="submit"
            disabled={!complete || saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            {editing ? <Check className="size-4 shrink-0" aria-hidden="true" /> : <Plus className="size-4 shrink-0" aria-hidden="true" />}
            {editing ? "Saglabāt" : "Pievienot"}
          </button>
        </>
      )}
    >
      <label className="block text-sm font-medium">
        Daudzums
        <span className={suffixRow}>
          <input
            value={quantity}
            inputMode="decimal"
            onChange={(event) => setQuantity(event.target.value.replace(/[^\d,.\s]/g, ""))}
            className={suffixInput}
            placeholder="0,5"
          />
          {unit ? <span className={suffixLabel}>{unit}</span> : null}
        </span>
      </label>
      <label className="block text-sm font-medium">
        Veikals
        <input value={shop} onChange={(event) => setShop(event.target.value)} className={fieldClass} placeholder="Veikala nosaukums" />
        <span className="mt-1 block text-xs font-normal text-[#5f756a]">Neobligāts</span>
      </label>
      <label className="block text-sm font-medium">
        Summa
        <input
          value={amount}
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value.replace(/[^\d,.\s]/g, ""))}
          className={fieldClass}
          placeholder="0,00"
        />
      </label>
      <InvoicePick invoices={invoices} invoiceId={invoiceId} onChange={setInvoiceId} />
    </RightDrawer>
  );
}

function MaterialHistoryDrawer({
  item,
  invoices,
  onClose,
  onSave,
}: {
  item: Material;
  invoices: Invoice[];
  onClose: () => void;
  onSave: (receipt: StockInput, receiptId: string) => void | false | Promise<void | false>;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MaterialReceipt | null>(null);
  const preview = invoices.find((invoice) => invoice.id === previewId) ?? null;
  return (
    <>
      <RightDrawer
        wide
        title="Vēsture"
        hint={item.name}
        onClose={onClose}
        footer={(close) => (
          <button type="button" onClick={close} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
            <X className="size-4 shrink-0" aria-hidden="true" />
            Aizvērt
          </button>
        )}
      >
        {item.receipts.length === 0 ? (
          <p className="text-sm text-[#5f756a]">Šim materiālam vēl nav iepirkumu.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#d3e4da]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-[#f7fbf8] text-xs tracking-wide text-[#5f756a] uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Pievienotais daudzums / Datums</th>
                  <th className="px-3 py-3 font-medium">Cena / Veikals</th>
                  <th className="px-3 py-3" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {item.receipts.map((line) => {
                  const invoice = line.invoiceId ? invoices.find((item) => item.id === line.invoiceId) ?? null : null;
                  const hasFile = Boolean(invoice?.storagePath && invoice.fileName);
                  return (
                    <tr key={line.id} className="border-t border-[#e4efe8]">
                      <td className="px-3 py-3">
                        <p className="font-medium tabular-nums">
                          {formatQuantity(line.quantity)} {item.unit}
                        </p>
                        <p className="mt-0.5 text-sm text-[#5f756a]">{formatDate(line.createdAt.slice(0, 10))}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium tabular-nums">{formatMoney(line.amount)}</p>
                        {line.shop ? <p className="mt-0.5 text-sm text-[#5f756a]">{line.shop}</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {invoice ? (
                            <Tooltip text={hasFile ? "Pavadzīme" : "Fails nav saglabāts"}>
                              <button
                                type="button"
                                disabled={!hasFile}
                                onClick={() => {
                                  setEditing(null);
                                  setPreviewId(invoice.id);
                                }}
                                className={iconButton}
                                aria-label={hasFile ? "Pavadzīme" : "Fails nav saglabāts"}
                              >
                                <FileText className="size-4" aria-hidden="true" />
                              </button>
                            </Tooltip>
                          ) : null}
                          <Tooltip text="Labot">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewId(null);
                                setEditing(line);
                              }}
                              className={iconButton}
                              aria-label="Labot"
                            >
                              <Pencil className="size-4" aria-hidden="true" />
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
      </RightDrawer>
      {editing ? (
        <WarehouseStockDrawer
          beside={720}
          unit={item.unit}
          invoices={invoices}
          receipt={editing}
          onClose={() => setEditing(null)}
          onSave={(input) => onSave(input, editing.id)}
        />
      ) : null}
      {preview?.storagePath && preview.fileName ? (
        <InvoicePreviewModal
          beside={720}
          src={`/api/invoices/${preview.id}/file`}
          name={preview.fileName}
          mime={preview.fileMime}
          hint="Pavadzīme"
          onClose={() => setPreviewId(null)}
        />
      ) : null}
    </>
  );
}

function InvoicePick({ invoices, invoiceId, onChange }: { invoices: Invoice[]; invoiceId: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const picked = invoices.find((invoice) => invoice.id === invoiceId) ?? null;
  const words = query.trim().toLocaleLowerCase("lv").split(/\s+/).filter(Boolean);
  const hints = [...invoices]
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))
    .filter((invoice) => {
      if (words.length === 0) return true;
      const text = `${invoice.number} ${invoice.supplier}`.toLocaleLowerCase("lv");
      return words.every((word) => text.includes(word));
    })
    .slice(0, 8);

  return (
    <label className="block text-sm font-medium">
      Ienākošais rēķins
      <input
        value={open ? query : picked ? invoiceLabel(picked) : ""}
        onChange={(event) => {
          setQuery(event.target.value);
          if (invoiceId) onChange("");
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={fieldClass}
        placeholder="Numurs vai piegādātājs"
        autoComplete="off"
      />
      <span className="mt-1 block text-xs font-normal text-[#5f756a]">{picked ? formatDate(picked.issuedOn) : "Neobligāts"}</span>
      {open ? (
        <ul className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#d3e4da] bg-white py-1 shadow-lg">
          {hints.length === 0 ? (
            <li className="px-3 py-2 text-sm font-normal text-[#5f756a]">{query.trim() ? "Nekas neatbilst meklēšanai." : "Ienākošo rēķinu vēl nav."}</li>
          ) : (
            hints.map((invoice) => (
              <li key={invoice.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(invoice.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#e7f6ec]"
                >
                  <span className="block truncate text-sm font-semibold">{invoiceLabel(invoice)}</span>
                  <span className="block text-xs font-normal text-[#5f756a]">{formatDate(invoice.issuedOn)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </label>
  );
}

function invoiceLabel(invoice: Invoice) {
  return invoice.number ? `${invoice.number} · ${invoice.supplier}` : invoice.supplier;
}

type StockInput = {
  quantity: number;
  shop: string;
  amount: number;
  invoiceId: string | null;
};

function stockTotal(lines: MaterialReceipt[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";

const suffixRow =
  "mt-2 flex h-11 overflow-hidden rounded-xl border border-[#c5d9cd] focus-within:border-[#1a6b4a] focus-within:ring-4 focus-within:ring-[#1a6b4a]/15";

const suffixInput = "min-w-0 flex-1 bg-transparent px-3 outline-none";

const suffixLabel = "grid place-items-center bg-[#f4faf6] px-3 text-sm text-[#5f756a]";

const iconButton = "grid size-9 place-items-center rounded-xl text-[#1a6b4a] hover:bg-[#e7f6ec]";
