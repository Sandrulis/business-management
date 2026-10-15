"use client";

import { FeedbackToast } from "@/app/components/feedback-toast";
import { useInvoices } from "@/app/components/invoice-state";
import {
  CircleAlert,
  Inbox,
  Building2,
  Hammer,
  LayoutDashboard,
  List,
  Menu,
  ReceiptText,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const INCOMING = [
  { href: "/saraksts", label: "Saraksts", icon: List },
  { href: "/neapmaksatie", label: "Neapmaksātie", icon: CircleAlert },
  { href: "/apstradei", label: "Apstrādei", icon: Inbox },
];

const INCOMING_SETTINGS = { href: "/ienakosie/uzstadijumi", label: "Uzstādījumi", icon: Settings };

const CLIENTS = [
  { href: "/klienti", label: "Saraksts", icon: List },
  { href: "/klienti/darbi", label: "Darbi", icon: Hammer },
];

const SETTINGS = { href: "/uznemuma-uzstadijumi", label: "Uzņēmuma uzstādījumi", icon: Settings };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { invoices, inbox, notice, dismissNotice } = useInvoices();
  const [open, setOpen] = useState(false);
  const unpaid = invoices.filter((invoice) => !invoice.paid).length;
  const sectionSettingsActive = pathname.startsWith(INCOMING_SETTINGS.href);
  const incomingActive = INCOMING.some((item) => pathname.startsWith(item.href)) || sectionSettingsActive;
  const clientsActive = pathname === "/klienti" || pathname.startsWith("/klienti/");
  const current = INCOMING.find((item) => pathname.startsWith(item.href));
  const clientCurrent = CLIENTS.find((item) => (item.href === "/klienti" ? pathname === "/klienti" : pathname.startsWith(item.href)));
  const title =
    current?.label ??
    (pathname === "/klienti" ? "Klienti" : clientCurrent?.label) ??
    (sectionSettingsActive
      ? INCOMING_SETTINGS.label
      : pathname.startsWith(SETTINGS.href)
        ? SETTINGS.label
        : pathname === "/"
          ? "Sākums"
          : "Uzņēmuma vadība");

  function countFor(href: string) {
    if (href === "/neapmaksatie") return unpaid;
    if (href === "/apstradei") return inbox.length;
    return 0;
  }

  function close() {
    setOpen(false);
  }

  return (
    <div
      className={`min-h-screen bg-[#eef5f0] text-[#143028] lg:grid ${
        incomingActive || clientsActive ? "lg:grid-cols-[240px_232px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-[#12382c] text-white transition-transform duration-300 lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:translate-x-0 lg:self-start ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[72px] items-center gap-3 px-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#d7f35f] text-[#12382c]">
            <ReceiptText size={18} />
          </div>
          <p className="min-w-0 text-sm leading-tight font-semibold tracking-tight">Uzņēmuma vadība</p>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-white/70 lg:hidden"
            onClick={close}
            aria-label="Aizvērt izvēlni"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
          <div className="space-y-1">
            <MainLink href="/" label="Sākums" icon={LayoutDashboard} active={pathname === "/"} onNavigate={close} />
            <MainLink
              href="/klienti"
              label="Klienti"
              icon={Building2}
              active={clientsActive}
              onNavigate={close}
            />
            <div className="space-y-1 py-1 pl-3 lg:hidden">
              {CLIENTS.map((item) => (
                <SubLink
                  key={item.href}
                  {...item}
                  tone="dark"
                  active={item.href === "/klienti" ? pathname === "/klienti" : pathname.startsWith(item.href)}
                  onNavigate={close}
                />
              ))}
            </div>
            <MainLink
              href="/saraksts"
              label="Ienākošie rēķini"
              icon={ReceiptText}
              active={incomingActive}
              count={unpaid + inbox.length}
              onNavigate={close}
            />
            <div className="space-y-1 py-1 pl-3 lg:hidden">
              {INCOMING.map((item) => (
                <SubLink
                  key={item.href}
                  {...item}
                  tone="dark"
                  active={pathname.startsWith(item.href)}
                  count={countFor(item.href)}
                  onNavigate={close}
                />
              ))}
              <SubLink
                {...INCOMING_SETTINGS}
                tone="dark"
                active={sectionSettingsActive}
                onNavigate={close}
              />
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <MainLink
              href={SETTINGS.href}
              label={SETTINGS.label}
              icon={SETTINGS.icon}
              active={pathname.startsWith(SETTINGS.href)}
              onNavigate={close}
            />
          </div>
        </nav>

        <div className="m-3 rounded-2xl bg-white/8 p-3">
          <p className="text-sm font-semibold">Sandris Ozoliņš</p>
          <p className="mt-0.5 text-xs text-[#b7d4c6]">Vadītājs</p>
        </div>
      </aside>

      {clientsActive ? (
        <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r border-[#d3e4da] bg-[#f4faf6] px-3 py-6 lg:flex">
          <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Klienti</p>
          <nav className="mt-4 space-y-1">
            {CLIENTS.map((item) => (
              <SubLink
                key={item.href}
                {...item}
                active={item.href === "/klienti" ? pathname === "/klienti" : pathname.startsWith(item.href)}
              />
            ))}
          </nav>
        </aside>
      ) : null}

      {incomingActive ? (
        <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r border-[#d3e4da] bg-[#f4faf6] px-3 py-6 lg:flex">
          <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Ienākošie rēķini</p>
          <nav className="mt-4 flex flex-1 flex-col">
            <div className="space-y-1">
              {INCOMING.map((item) => (
                <SubLink
                  key={item.href}
                  {...item}
                  active={pathname.startsWith(item.href)}
                  count={countFor(item.href)}
                />
              ))}
            </div>
            <div className="mt-4 border-t border-[#d3e4da] pt-4">
              <SubLink {...INCOMING_SETTINGS} active={sectionSettingsActive} />
            </div>
          </nav>
        </aside>
      ) : null}

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#0b241c]/45 lg:hidden"
          aria-label="Aizvērt izvēlni"
          onClick={close}
        />
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[#d3e4da] bg-[#eef5f0]/90 px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            className="rounded-xl border border-[#d3e4da] bg-white p-2.5"
            onClick={() => setOpen(true)}
            aria-label="Atvērt izvēlni"
          >
            <Menu size={18} />
          </button>
          <p className="ml-3 font-semibold">{title}</p>
        </header>
        {notice ? (
          <FeedbackToast
            key={`${notice.tone}:${notice.text}`}
            message={notice.text}
            tone={notice.tone}
            onDismiss={dismissNotice}
          />
        ) : null}
        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function MainLink({
  href,
  label,
  icon: Icon,
  active,
  count = 0,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active ? "bg-[#d7f35f] text-[#12382c]" : "text-[#d7ebe2] hover:bg-white/10"
      }`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="leading-tight">{label}</span>
      {count > 0 ? <Count value={count} active={active} tone="dark" /> : null}
    </Link>
  );
}

function SubLink({
  href,
  label,
  icon: Icon,
  active,
  count = 0,
  tone = "light",
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  count?: number;
  tone?: "light" | "dark";
  onNavigate?: () => void;
}) {
  const dark = tone === "dark";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
        dark
          ? active
            ? "bg-[#d7f35f] text-[#12382c]"
            : "text-[#d7ebe2] hover:bg-white/10"
          : active
            ? "bg-[#1a6b4a] text-white"
            : "text-[#1e3a2f] hover:bg-[#e7f3ec]"
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span>{label}</span>
      {count > 0 ? <Count value={count} active={active} tone={tone} /> : null}
    </Link>
  );
}

function Count({ value, active, tone = "light" }: { value: number; active: boolean; tone?: "light" | "dark" }) {
  return (
    <span
      className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        active
          ? tone === "dark"
            ? "bg-[#12382c]/12 text-[#12382c]"
            : "bg-white/15 text-white"
          : tone === "dark"
            ? "bg-white/12 text-white"
            : "bg-[#dff0e6] text-[#1e3a2f]"
      }`}
    >
      {value}
    </span>
  );
}
