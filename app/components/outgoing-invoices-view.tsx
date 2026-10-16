"use client";

import { DateField } from "@/app/components/date-field";
import { useInvoices } from "@/app/components/invoice-state";
import { RightDrawer } from "@/app/components/right-drawer";
import { addDays, formatDate, formatMoney } from "@/app/lib/invoices/model";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type DraftInvoice = {
  id: string;
  clientId: string;
  clientName: string;
  number: string;
  issuedOn: string;
  dueOn: string;
  net: number;
  gross: number;
  workName: string;
};

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function parseAmount(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100) / 100;
  return value > 0 ? value : null;
}

function amountText(value: number) {
  return value.toFixed(2).replace(".", ",");
}

const draftInvoices: DraftInvoice[] = [];

export function OutgoingInvoicesView() {
  const pathname = usePathname();
  const router = useRouter();
  const { sites, works, settings } = useInvoices();
  const creating = pathname === "/outgoing_invoices/new";
  const clients = [...sites].sort((a, b) => a.customer.localeCompare(b.customer, "lv"));
  const workOptions = [...works].sort((a, b) => a.name.localeCompare(b.name, "lv"));
  const [invoices, setInvoices] = useState<DraftInvoice[]>(() => draftInvoices);
  const [clientId, setClientId] = useState("");
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayIso);
  const [dueOn, setDueOn] = useState(addDays(todayIso(), Number(settings.paymentDays) || 14));
  const [net, setNet] = useState("");
  const [gross, setGross] = useState("");
  const [workId, setWorkId] = useState("");

  const parsedNet = parseAmount(net);
  const parsedGross = parseAmount(gross);
  const complete = clientId !== "" && number.trim() !== "" && issuedOn !== "" && dueOn !== "" && parsedNet !== null && parsedGross !== null;

  function close() {
    router.push("/outgoing_invoices");
  }

  function applyNet(raw: string) {
    setNet(raw);
    const value = parseAmount(raw);
    const rate = Number(settings.vatRate);
    if (value === null || !Number.isFinite(rate)) return;
    setGross(amountText(Math.round(value * (1 + rate / 100) * 100) / 100));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || parsedNet === null || parsedGross === null) return false;
    const client = clients.find((site) => site.id === clientId);
    const work = workOptions.find((item) => item.id === workId);
    const next = {
      id: crypto.randomUUID(),
      clientId,
      clientName: client?.customer ?? "",
      number: number.trim(),
      issuedOn,
      dueOn,
      net: parsedNet,
      gross: parsedGross,
      workName: work?.name ?? "",
    };
    draftInvoices.unshift(next);
    setInvoices([...draftInvoices]);
    setClientId("");
    setNumber("");
    setNet("");
    setGross("");
    setWorkId("");
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Izejošie rēķini</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Rēķini, ko uzņēmums izraksta klientiem.</p>

      <section className="mt-8 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {invoices.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Izejošo rēķinu vēl nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{invoice.number}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">{invoice.clientName}</p>
                  <p className="mt-1 text-sm text-[#5f756a]">
                    {formatDate(invoice.issuedOn)} līdz {formatDate(invoice.dueOn)}
                    {invoice.workName ? `, ${invoice.workName}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium tabular-nums">{formatMoney(invoice.gross)}</p>
                  <p className="mt-1 text-sm text-[#5f756a] tabular-nums">{formatMoney(invoice.net)} bez PVN</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating ? (
        <RightDrawer
          title="Jauns rēķins"
          hint="Priekšskats. Saglabāšana vēl nav pieslēgta."
          onClose={close}
          onSubmit={submit}
          footer={(dismiss) => (
            <>
              <button type="button" onClick={dismiss} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
                Atcelt
              </button>
              <button
                type="submit"
                disabled={!complete}
                className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
              >
                Izveidot
              </button>
            </>
          )}
        >
                  <label className="block text-sm font-medium">
                    Klients
                    <select value={clientId} onChange={(event) => setClientId(event.target.value)} className={fieldClass}>
                      <option value="">Izvēlies klientu</option>
                      {clients.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.customer}
                          {site.address ? `, ${site.address}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Numurs
                    <input value={number} onChange={(event) => setNumber(event.target.value)} className={fieldClass} placeholder="2026-001" />
                  </label>
                  <label className="block text-sm font-medium">
                    Datums
                    <DateField value={issuedOn} onChange={setIssuedOn} className={fieldClass} />
                  </label>
                  <label className="block text-sm font-medium">
                    Apmaksas termiņš
                    <DateField value={dueOn} onChange={setDueOn} className={fieldClass} />
                  </label>
                  <label className="block text-sm font-medium">
                    Bez PVN
                    <input value={net} onChange={(event) => applyNet(event.target.value)} inputMode="decimal" className={fieldClass} placeholder="0,00" />
                  </label>
                  <label className="block text-sm font-medium">
                    Ar PVN
                    <input value={gross} onChange={(event) => setGross(event.target.value)} inputMode="decimal" className={fieldClass} placeholder="0,00" />
                  </label>
                  <label className="block text-sm font-medium">
                    Darbs
                    <select value={workId} onChange={(event) => setWorkId(event.target.value)} className={fieldClass}>
                      <option value="">Bez darba</option>
                      {workOptions.map((work) => (
                        <option key={work.id} value={work.id}>
                          {work.name}
                        </option>
                      ))}
                    </select>
                  </label>
        </RightDrawer>
      ) : null}
    </div>
  );
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
