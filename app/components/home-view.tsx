"use client";

import { Tooltip } from "@/app/components/tooltip";
import { useInvoices } from "@/app/components/invoice-state";
import { loadInstruments } from "@/app/lib/catalog/repository";
import type { Instrument } from "@/app/lib/catalog/types";
import { addDays, duePhrase, formatDate, formatMoney, isOverdue, type Invoice, type Site } from "@/app/lib/invoices/model";
import { loadOfferDocuments } from "@/app/lib/offers/repository";
import type { OfferDocument } from "@/app/lib/offers/model";
import { formatDuration, workedSeconds, type WorkSession } from "@/app/lib/work-sessions/model";
import { loadOpenSessions } from "@/app/lib/work-sessions/repository";
import { Eye, EyeOff, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "bm_dashboard_blocks";

const BLOCKS = [
  { id: "offers", label: "Nenoslēgtie piedāvājumi" },
  { id: "outgoing", label: "Izejošie neapmaksātie" },
  { id: "incoming", label: "Ienākošie neapmaksātie" },
  { id: "deadlines", label: "Termiņi šonedēļ" },
  { id: "working", label: "Šobrīd darbā" },
  { id: "tools", label: "Instrumenti" },
] as const;

type BlockId = (typeof BLOCKS)[number]["id"];

export function HomeView() {
  const { today, invoices, sites } = useInvoices();
  const [hidden, setHidden] = useState<BlockId[]>([]);
  const [ready, setReady] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [offers, setOffers] = useState<{ site: Site; note: string }[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [tools, setTools] = useState<Instrument[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setHidden(parsed.filter((id): id is BlockId => BLOCKS.some((block) => block.id === id)));
        }
      } catch {
        setHidden([]);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  }, [hidden, ready]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    loadOfferDocuments().then((rows) => {
      if (!active) return;
      const byId = new Map(sites.map((site) => [site.id, site]));
      setOffers(
        rows
          .map((row) => {
            const site = byId.get(row.siteId);
            const note = openOfferNote(row.document);
            return site && note ? { site, note } : null;
          })
          .filter((row): row is { site: Site; note: string } => row != null)
          .sort((a, b) => a.site.customer.localeCompare(b.site.customer, "lv")),
      );
    });
    return () => {
      active = false;
    };
  }, [sites]);

  useEffect(() => {
    let active = true;
    loadOpenSessions().then((result) => {
      if (active && result.ok) setSessions(result.sessions);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadInstruments().then((result) => {
      if (active && result.ok) setTools(result.items);
    });
    return () => {
      active = false;
    };
  }, []);

  const unpaid = invoices.filter((invoice) => !invoice.paid).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const weekEnd = addDays(today, 7);
  const deadlines = unpaid.filter((invoice) => invoice.dueOn >= today && invoice.dueOn <= weekEnd);
  const assigned = tools.filter((tool) => tool.assignments[0]?.kind === "assigned").length;
  const repair = 0;
  const free = tools.length - assigned - repair;
  const visible = (id: BlockId) => !hidden.includes(id);

  function toggle(id: BlockId) {
    setHidden((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="animate-slide-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sākums</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">Piedāvājumi, rēķini, darbinieki un instrumenti vienā skatā.</p>
        </div>
        <button
          type="button"
          onClick={() => setChooser((current) => !current)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d3e4da] bg-white px-4 text-sm font-semibold text-[#143028] hover:bg-[#f4faf6]"
        >
          <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
          Bloki
        </button>
      </div>

      {chooser || hidden.length === BLOCKS.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {BLOCKS.map((block) => {
            const on = visible(block.id);
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => toggle(block.id)}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium ${on ? "bg-[#1a6b4a] text-white" : "bg-white text-[#5f756a] ring-1 ring-[#d3e4da]"}`}
              >
                {on ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
                {block.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {visible("offers") ? (
          <Card title="Nenoslēgtie piedāvājumi" href="/clients" action="Klienti" count={offers.length} onHide={() => toggle("offers")}>
            {offers.length === 0 ? (
              <Empty text="Visi sagatavotie piedāvājumi ir noslēgti." />
            ) : (
              <ul className="divide-y divide-[#e4efe8]">
                {offers.slice(0, 6).map((row) => (
                  <li key={row.site.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.site.customer}</p>
                      <p className="mt-0.5 truncate text-sm text-[#5f756a]">{row.site.address}</p>
                    </div>
                    <p className="shrink-0 text-right text-xs text-[#5f756a]">{row.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {visible("outgoing") ? (
          <Card title="Izejošie neapmaksātie" href="/outgoing_invoices" action="Izejošie rēķini" count={0} onHide={() => toggle("outgoing")}>
            <Empty text="Izejošie rēķini vēl netiek saglabāti, tāpēc neapmaksāto saraksts ir tukšs." />
          </Card>
        ) : null}

        {visible("incoming") ? (
          <Card
            title="Ienākošie neapmaksātie"
            href="/incoming_invoices/unpaid"
            action="Neapmaksātie"
            count={unpaid.length}
            extra={unpaid.length > 0 ? formatMoney(unpaid.reduce((sum, invoice) => sum + invoice.gross, 0)) : undefined}
            onHide={() => toggle("incoming")}
          >
            {unpaid.length === 0 ? <Empty text="Neapmaksātu ienākošo rēķinu nav." /> : <InvoiceList rows={unpaid.slice(0, 6)} today={today} />}
          </Card>
        ) : null}

        {visible("deadlines") ? (
          <Card title="Termiņi šonedēļ" href="/incoming_invoices/unpaid" action="Neapmaksātie" count={deadlines.length} onHide={() => toggle("deadlines")}>
            {deadlines.length === 0 ? (
              <Empty text="Tuvākajās 7 dienās apmaksas termiņu nav." />
            ) : (
              <InvoiceList rows={deadlines.slice(0, 6)} today={today} />
            )}
          </Card>
        ) : null}

        {visible("working") ? (
          <Card title="Šobrīd darbā" href="/employees/now" action="Šobrīd darbā" count={sessions.length} onHide={() => toggle("working")}>
            {sessions.length === 0 ? (
              <Empty text="Šobrīd neviens nestrādā." />
            ) : (
              <ul className="divide-y divide-[#e4efe8]">
                {sessions.slice(0, 6).map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{session.employeeName}</p>
                      <p className="mt-0.5 truncate text-sm text-[#5f756a]">{session.placeAddress || session.placeName}</p>
                    </div>
                    <p className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${session.pausedAt ? "text-[#8aa396]" : "text-[#143028]"}`}>
                      {now > 0 ? formatDuration(workedSeconds(session, now)) : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {visible("tools") ? (
          <Card title="Instrumenti" href="/tools" action="Instrumenti" count={tools.length} onHide={() => toggle("tools")}>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Piesaistīti" value={String(assigned)} />
              <Stat label="Brīvi" value={String(free)} />
              <Stat label="Remontā" value={String(repair)} />
            </div>
            <p className="mt-3 text-xs text-[#5f756a]">Remonta statuss instrumentu kartē vēl nav, tāpēc šis skaits ir 0.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Card({
  title,
  href,
  action,
  count,
  extra,
  onHide,
  children,
}: {
  title: string;
  href: string;
  action: string;
  count: number;
  extra?: string;
  onHide: () => void;
  children: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-[#d3e4da] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[#5f756a]">
            {count}
            {extra ? <span className="tabular-nums"> · {extra}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link href={href} className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-[#1a6b4a] hover:bg-[#e7f6ec]">
            {action}
          </Link>
          <Tooltip text="Paslēpt">
            <button type="button" onClick={onHide} className="grid size-9 place-items-center rounded-xl text-[#5f756a] hover:bg-[#f4faf6]" aria-label="Paslēpt">
              <EyeOff className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function InvoiceList({ rows, today }: { rows: Invoice[]; today: string }) {
  return (
    <ul className="divide-y divide-[#e4efe8]">
      {rows.map((invoice) => {
        const overdue = isOverdue(invoice.dueOn, today, invoice.paid);
        const phrase = duePhrase(invoice.dueOn, today);
        return (
          <li key={invoice.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{invoice.supplier}</p>
              <p className="mt-0.5 truncate text-sm text-[#5f756a]">{invoice.number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{formatMoney(invoice.gross)}</p>
              <p className={`mt-0.5 text-xs ${overdue ? "font-semibold text-[#b42318]" : "text-[#5f756a]"}`}>
                {formatDate(invoice.dueOn)} · {phrase.text}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7fbf8] px-3 py-3">
      <p className="text-xs text-[#5f756a]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-sm text-[#5f756a]">{text}</p>;
}

function openOfferNote(document: OfferDocument) {
  const hasOffer = document.groups.length > 0;
  const openExtra = document.extras.some((extra) => !extra.fixedAt && extra.groups.length > 0);
  if (hasOffer && !document.fixedAt) return "Piedāvājums nav noslēgts";
  if (openExtra) return "Papildu darbi nav noslēgti";
  return "";
}
