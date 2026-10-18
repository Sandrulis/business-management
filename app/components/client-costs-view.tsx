"use client";

import { InvoicePreviewModal } from "@/app/components/invoice-preview-modal";
import { useInvoices } from "@/app/components/invoice-state";
import { Tooltip } from "@/app/components/tooltip";
import { useOfferCategoryState } from "@/app/components/use-offer-categories";
import { formatDate, formatMoney, type Invoice } from "@/app/lib/invoices/model";
import { ChevronDown, ChevronRight, FileText, GripVertical } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

const UNASSIGNED = "unassigned";

export function ClientCostsView() {
  const { invoices, sites, saveInvoice, notify } = useInvoices();
  const [selected, setSelected] = useState(UNASSIGNED);
  const [over, setOver] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const saving = useRef(new Set<string>());
  const site = sites.find((entry) => entry.id === selected) ?? null;
  const { categories, ready } = useOfferCategoryState(site?.id ?? "");
  const knownIds = new Set(sites.map((entry) => entry.id));
  const unassigned = invoices
    .filter((invoice) => !invoice.objectId || !knownIds.has(invoice.objectId))
    .sort(byDate);
  const clientInvoices = site ? invoices.filter((invoice) => invoice.objectId === site.id).sort(byDate) : [];
  const categoryIds = new Set(categories.map((category) => category.id));
  const loose = clientInvoices.filter((invoice) => !invoice.categoryId || !categoryIds.has(invoice.categoryId));

  function beginDrag(invoiceId: string, event: DragEvent<HTMLElement>) {
    dragId.current = invoiceId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", invoiceId);
  }

  function endDrag() {
    dragId.current = null;
    setOver(null);
  }

  function allowDrop(target: string, event: DragEvent<HTMLElement>) {
    if (!dragId.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(target);
  }

  function leaveDrop(target: string, event: DragEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setOver((current) => (current === target ? null : current));
  }

  async function persist(next: Invoice) {
    if (saving.current.has(next.id)) return;
    saving.current.add(next.id);
    const result = await saveInvoice(next);
    saving.current.delete(next.id);
    if (!result.ok) notify(result.message, "error");
  }

  function dropOnClient(siteId: string | null, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setOver(null);
    const invoiceId = dragId.current;
    dragId.current = null;
    if (!invoiceId) return;
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) return;
    if (siteId === null) {
      if (!invoice.objectId && !invoice.categoryId) return;
      void persist({ ...invoice, objectId: null, objectName: "", client: "", categoryId: "", categoryName: "" });
      setSelected(UNASSIGNED);
      return;
    }
    const target = sites.find((entry) => entry.id === siteId);
    if (!target || invoice.objectId === target.id) {
      setSelected(siteId);
      return;
    }
    void persist({
      ...invoice,
      objectId: target.id,
      objectName: target.address,
      client: target.customer,
      categoryId: "",
      categoryName: "",
    });
    setSelected(target.id);
  }

  function dropOnCategory(categoryId: string, categoryName: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setOver(null);
    const invoiceId = dragId.current;
    dragId.current = null;
    if (!invoiceId || !site) return;
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    if (!invoice || (invoice.objectId === site.id && invoice.categoryId === categoryId)) return;
    void persist({
      ...invoice,
      objectId: site.id,
      objectName: site.address,
      client: site.customer,
      categoryId,
      categoryName,
    });
  }

  function dropOnLoose(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setOver(null);
    const invoiceId = dragId.current;
    dragId.current = null;
    if (!invoiceId || !site) return;
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    if (!invoice || !invoice.categoryId || invoice.objectId !== site.id) return;
    void persist({ ...invoice, categoryId: "", categoryName: "" });
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Klientu izmaksas</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
        Velc rēķinu uz klientu, lai piesaistītu. Nenokategorizēto rēķinu velc uz kategoriju no piedāvājuma.
      </p>
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-3xl border border-[#d3e4da] bg-white lg:sticky lg:top-6">
          <ul className="max-h-[70vh] divide-y divide-[#e4efe8] overflow-y-auto">
            <li>
              <ClientRow
                label="Nepiesaistītie"
                detail="Bez klienta"
                count={unassigned.length}
                selected={selected === UNASSIGNED}
                dropping={over === UNASSIGNED}
                onClick={() => setSelected(UNASSIGNED)}
                onDragOver={(event) => allowDrop(UNASSIGNED, event)}
                onDragLeave={(event) => leaveDrop(UNASSIGNED, event)}
                onDrop={(event) => dropOnClient(null, event)}
              />
            </li>
            {sites.map((entry) => {
              const count = invoices.filter((invoice) => invoice.objectId === entry.id).length;
              const target = `client:${entry.id}`;
              return (
                <li key={entry.id}>
                  <ClientRow
                    label={entry.customer}
                    detail={entry.address}
                    count={count}
                    selected={selected === entry.id}
                    dropping={over === target}
                    onClick={() => setSelected(entry.id)}
                    onDragOver={(event) => allowDrop(target, event)}
                    onDragLeave={(event) => leaveDrop(target, event)}
                    onDrop={(event) => dropOnClient(entry.id, event)}
                  />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="min-w-0">
          {site ? (
            !ready ? (
              <p className="rounded-3xl border border-[#d3e4da] bg-white px-6 py-10 text-center text-sm text-[#5f756a]">Ielādē kategorijas...</p>
            ) : (
              <CostTable
                key={site.id}
                groups={[
                  ...(loose.length > 0
                    ? [{ id: "loose", title: "Nenokategorizētie", invoices: loose, offerTotal: null, dropId: "loose" as const }]
                    : []),
                  ...categories.map((category) => ({
                    id: category.id,
                    title: category.name,
                    invoices: clientInvoices.filter((invoice) => invoice.categoryId === category.id),
                    offerTotal: category.offerTotal,
                    dropId: `category:${category.id}`,
                  })),
                ]}
                over={over}
                allowDrop={allowDrop}
                leaveDrop={leaveDrop}
                onDropGroup={(dropId, event) => {
                  if (dropId === "loose") dropOnLoose(event);
                  else {
                    const category = categories.find((entry) => dropId === `category:${entry.id}`);
                    if (category) dropOnCategory(category.id, category.name, event);
                  }
                }}
                onDragStart={beginDrag}
                onDragEnd={endDrag}
                empty={
                  categories.length === 0 && loose.length === 0
                    ? "Šim klientam nav ne rēķinu, ne piedāvājuma kategoriju."
                    : categories.length === 0
                      ? "Šim klientam piedāvājumā nav kategoriju."
                      : null
                }
              />
            )
          ) : unassigned.length === 0 ? (
            <p className="rounded-3xl border border-[#d3e4da] bg-white px-6 py-14 text-center text-sm text-[#5f756a]">
              Visi rēķini ir piesaistīti klientiem.
            </p>
          ) : (
            <CostTable
              groups={[{ id: "unassigned", title: "Nepiesaistītie", invoices: unassigned, offerTotal: null, dropId: null }]}
              over={over}
              allowDrop={allowDrop}
              leaveDrop={leaveDrop}
              onDropGroup={() => undefined}
              onDragStart={beginDrag}
              onDragEnd={endDrag}
              empty={null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ClientRow({
  label,
  detail,
  count,
  selected,
  dropping,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  detail: string;
  count: number;
  selected: boolean;
  dropping: boolean;
  onClick: () => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
        dropping ? "bg-[#e7f3ec] ring-2 ring-inset ring-[#1a6b4a]" : selected ? "bg-[#1a6b4a] text-white" : "hover:bg-[#f4faf6]"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className={`mt-0.5 block truncate text-xs ${selected && !dropping ? "text-white/75" : "text-[#5f756a]"}`}>{detail}</span>
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
          selected && !dropping ? "bg-white/15 text-white" : "bg-[#dff0e6] text-[#1e3a2f]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

type CostGroup = {
  id: string;
  title: string;
  invoices: Invoice[];
  offerTotal: number | null;
  dropId: string | null;
};

function CostTable({
  groups,
  over,
  allowDrop,
  leaveDrop,
  onDropGroup,
  onDragStart,
  onDragEnd,
  empty,
}: {
  groups: CostGroup[];
  over: string | null;
  allowDrop: (target: string, event: DragEvent<HTMLElement>) => void;
  leaveDrop: (target: string, event: DragEvent<HTMLElement>) => void;
  onDropGroup: (dropId: string, event: DragEvent<HTMLElement>) => void;
  onDragStart: (invoiceId: string, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  empty: string | null;
}) {
  const spent = groups.reduce((sum, group) => sum + group.invoices.reduce((inner, invoice) => inner + invoice.gross, 0), 0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["loose", "unassigned"]));
  const [preview, setPreview] = useState<Invoice | null>(null);
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function reveal(id: string) {
    setExpanded((current) => (current.has(id) ? current : new Set(current).add(id)));
  }
  if (groups.length === 0) {
    return <p className="rounded-3xl border border-[#d3e4da] bg-white px-6 py-14 text-center text-sm text-[#5f756a]">{empty}</p>;
  }
  return (
    <section className="overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs tracking-wide text-[#5f756a] uppercase">
            <tr>
              <th className="px-6 py-3 font-medium">Izmaksas</th>
              <th className="px-3 py-3 font-medium">Datums</th>
              <th className="px-3 py-3 text-right font-medium">Summa</th>
              <th className="w-14 px-3 py-3"><span className="sr-only">Apskatīt</span></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const groupSpent = group.invoices.reduce((sum, invoice) => sum + invoice.gross, 0);
              const dropping = group.dropId != null && over === group.dropId;
              const dropProps =
                group.dropId == null
                  ? {}
                  : {
                      onDragOver: (event: DragEvent<HTMLTableRowElement>) => allowDrop(group.dropId as string, event),
                      onDragLeave: (event: DragEvent<HTMLTableRowElement>) => leaveDrop(group.dropId as string, event),
                      onDrop: (event: DragEvent<HTMLTableRowElement>) => onDropGroup(group.dropId as string, event),
                    };
              return (
                <GroupRows
                  key={group.id}
                  group={group}
                  spent={groupSpent}
                  open={expanded.has(group.id)}
                  dropping={dropping}
                  dropProps={dropProps}
                  onToggle={() => toggle(group.id)}
                  onReveal={() => reveal(group.id)}
                  onPreview={setPreview}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#d3e4da]">
              <td className="px-6 py-4 font-semibold" colSpan={2}>
                Kopā
              </td>
              <td className="px-3 py-4 text-right font-semibold tabular-nums">{formatMoney(spent)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {empty ? <p className="border-t border-[#e4efe8] px-6 py-4 text-sm text-[#5f756a]">{empty}</p> : null}
      {preview?.storagePath && preview.fileName ? (
        <InvoicePreviewModal
          src={`/api/invoices/${preview.id}/file`}
          name={preview.fileName}
          mime={preview.fileMime}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </section>
  );
}

function GroupRows({
  group,
  spent,
  open,
  dropping,
  dropProps,
  onToggle,
  onReveal,
  onPreview,
  onDragStart,
  onDragEnd,
}: {
  group: CostGroup;
  spent: number;
  open: boolean;
  dropping: boolean;
  dropProps: {
    onDragOver?: (event: DragEvent<HTMLTableRowElement>) => void;
    onDragLeave?: (event: DragEvent<HTMLTableRowElement>) => void;
    onDrop?: (event: DragEvent<HTMLTableRowElement>) => void;
  };
  onToggle: () => void;
  onReveal: () => void;
  onPreview: (invoice: Invoice) => void;
  onDragStart: (invoiceId: string, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const highlight = dropping ? "bg-[#e7f3ec]" : "";
  const drop = {
    ...dropProps,
    onDrop: (event: DragEvent<HTMLTableRowElement>) => {
      dropProps.onDrop?.(event);
      onReveal();
    },
  };
  return (
    <>
      <tr className={`border-t border-[#e4efe8] ${dropping ? "bg-[#e7f3ec]" : "bg-[#f7fbf8]"}`} {...drop}>
        <td className="px-6 py-3" colSpan={2}>
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 font-semibold">
            {open ? <ChevronDown className="size-4 shrink-0 text-[#5f756a]" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-[#5f756a]" aria-hidden="true" />}
            {group.title}
          </button>
        </td>
        <td className="px-3 py-3 text-right">
          <p className="font-semibold tabular-nums">{formatMoney(spent)}</p>
          {group.offerTotal != null ? <BudgetLine spent={spent} offerTotal={group.offerTotal} /> : null}
        </td>
        <td />
      </tr>
      {open && group.invoices.length === 0 ? (
        <tr className={`border-t border-[#e4efe8] ${highlight}`} {...drop}>
          <td className="px-6 py-6 text-center text-sm text-[#5f756a]" colSpan={4}>
            Ievelc rēķinu šeit.
          </td>
        </tr>
      ) : null}
      {open
        ? group.invoices.map((invoice) => {
            const hasFile = Boolean(invoice.storagePath && invoice.fileName);
            return (
              <tr key={invoice.id} className={`border-t border-[#e4efe8] ${highlight}`} {...drop}>
                <td className="px-6 py-3">
                  <div
                    draggable
                    onDragStart={(event) => onDragStart(invoice.id, event)}
                    onDragEnd={onDragEnd}
                    className="flex cursor-grab items-center gap-2 active:cursor-grabbing"
                  >
                    <GripVertical className="size-4 shrink-0 text-[#8aa396]" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{invoice.supplier || invoice.number || "Rēķins"}</span>
                      {invoice.number ? <span className="mt-0.5 block truncate text-xs text-[#5f756a]">{invoice.number}</span> : null}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-[#5f756a]">{formatDate(invoice.issuedOn)}</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums">{formatMoney(invoice.gross)}</td>
                <td className="px-3 py-3 text-right">
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
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}

function BudgetLine({ spent, offerTotal }: { spent: number; offerTotal: number }) {
  const remaining = Math.round((offerTotal - spent + Number.EPSILON) * 100) / 100;
  const overBudget = remaining < 0;
  return (
    <p className="mt-1 text-xs font-normal text-[#8aa396] tabular-nums">
      {formatMoney(offerTotal)}{" "}
      <span className={overBudget ? "font-semibold text-[#b42318]" : undefined}>
        ({formatMoney(remaining)}
        {overBudget ? ", ārpus budžeta" : ""})
      </span>
    </p>
  );
}

function byDate(a: Invoice, b: Invoice) {
  return b.issuedOn.localeCompare(a.issuedOn) || a.number.localeCompare(b.number);
}
