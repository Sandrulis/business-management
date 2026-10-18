"use client";

import { FeedbackToasts } from "@/app/components/feedback-toast";
import { useInvoices } from "@/app/components/invoice-state";
import { PersonalTodoButton, PersonalTodoPanel, useOpenTodoCount } from "@/app/components/personal-todo-panel";
import { useOutgoingUnpaid } from "@/app/components/use-outgoing-unpaid";
import { useDemoTasks } from "@/app/lib/tasks/demo-store";
import {
  Calculator,
  CalendarRange,
  CircleAlert,
  FileInput,
  FileOutput,
  HardHat,
  Inbox,
  Banknote,
  Building2,
  Landmark,
  LayoutDashboard,
  PieChart,
  List,
  ListTodo,
  Menu,
  ReceiptText,
  Settings,
  Shirt,
  Tags,
  Timer,
  Wallet,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const INCOMING = [
  { href: "/incoming_invoices", label: "Saraksts", icon: List, exact: true },
  { href: "/incoming_invoices/unpaid", label: "Neapmaksātie", icon: CircleAlert },
  { href: "/incoming_invoices/processing", label: "Apstrādei", icon: Inbox },
  { href: "/incoming_invoices/costs", label: "Klientu izmaksas", icon: Wallet },
];

const INCOMING_SETTINGS = { href: "/incoming_invoices/settings", label: "Uzstādījumi", icon: Settings };

const WAREHOUSE_LINKS = [
  { href: "/warehouse", label: "Saraksts", icon: List },
  { href: "/warehouse/prices", label: "Pozīciju cenas", icon: Tags },
];

const EMPLOYEE_LINKS = [
  { href: "/employees", label: "Saraksts", icon: List },
  { href: "/employees/now", label: "Šobrīd darbā", icon: Timer },
  { href: "/employees/timesheet", label: "Darba laika atskaite", icon: CalendarRange },
];

const ACCOUNTING_LINKS = [
  { href: "/accounting", label: "Rēķinu kopsavilkums", icon: PieChart },
  { href: "/accounting/salaries", label: "Algas", icon: Banknote },
  { href: "/accounting/taxes", label: "Nodokļi", icon: Landmark },
];

const CATALOG = [
  { href: "/warehouse", label: "Noliktava", icon: Warehouse },
  { href: "/employees", label: "Darbinieki", icon: HardHat },
  { href: "/tools", label: "Instrumenti", icon: Wrench },
  { href: "/clothing", label: "Apģērbs", icon: Shirt },
];

const SETTINGS = { href: "/company_settings", label: "Uzņēmuma uzstādījumi", icon: Settings };

function navActive(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { invoices, inbox, notices, dismissNotice } = useInvoices();
  const { lists: taskLists } = useDemoTasks();
  const [open, setOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const todoCount = useOpenTodoCount();
  const unpaid = invoices.filter((invoice) => !invoice.paid).length;
  const outgoingUnpaid = useOutgoingUnpaid();
  const sectionSettingsActive = navActive(pathname, INCOMING_SETTINGS.href);
  const incomingActive = pathname === "/incoming_invoices" || pathname.startsWith("/incoming_invoices/");
  const warehouseActive = pathname === "/warehouse" || pathname.startsWith("/warehouse/");
  const warehouseListActive = pathname === "/warehouse" || pathname === "/warehouse/new";
  const employeesActive = pathname === "/employees" || pathname.startsWith("/employees/");
  const employeesListActive = pathname === "/employees" || pathname === "/employees/new";
  const tasksActive = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const accountingActive = pathname === "/accounting" || pathname.startsWith("/accounting/");
  const outgoingActive = pathname === "/outgoing_invoices" || pathname.startsWith("/outgoing_invoices/");
  const clientsActive = pathname === "/clients" || pathname.startsWith("/clients/");
  const catalogSection = CATALOG.find((item) => navActive(pathname, item.href));
  const current = INCOMING.find((item) => navActive(pathname, item.href, item.exact));
  const title =
    tasksActive
      ? "Uzdevumi"
      : accountingActive
        ? (ACCOUNTING_LINKS.find((link) => link.href === pathname)?.label ?? "Grāmatvedība")
      : pathname === "/employees/now"
      ? "Šobrīd darbā"
      : pathname === "/employees/timesheet"
        ? "Darba laika atskaite"
        : current?.label ??
    (sectionSettingsActive
      ? INCOMING_SETTINGS.label
      : pathname === "/warehouse/prices"
        ? "Pozīciju cenas"
        : catalogSection
          ? catalogSection.label
          : outgoingActive
            ? "Izejošie rēķini"
            : clientsActive
              ? "Klienti"
              : navActive(pathname, SETTINGS.href)
                ? SETTINGS.label
                : pathname === "/" || pathname === "/dashboard"
                  ? "Sākums"
                  : "Uzņēmuma vadība");

  function countFor(href: string) {
    if (href === "/incoming_invoices/unpaid") return unpaid;
    if (href === "/incoming_invoices/processing") return inbox.length;
    return 0;
  }

  function close() {
    setOpen(false);
  }

  return (
    <div
      className={`min-h-screen bg-[#eef5f0] text-[#143028] lg:grid ${
        incomingActive || warehouseActive || employeesActive || tasksActive || accountingActive ? "lg:grid-cols-[240px_232px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"
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
            <MainLink href="/dashboard" label="Sākums" icon={LayoutDashboard} active={pathname === "/" || pathname === "/dashboard"} onNavigate={close} />
            <MainLink href="/tasks" label="Uzdevumi" icon={ListTodo} active={tasksActive} onNavigate={close} />
            <div className="space-y-1 py-1 pl-3 lg:hidden">
              <SubLink href="/tasks" label="Visi" icon={List} tone="dark" active={pathname === "/tasks"} onNavigate={close} />
              {taskLists.map((list) => (
                <SubLink
                  key={list.id}
                  href={`/tasks/${list.id}`}
                  label={list.name}
                  icon={ListTodo}
                  tone="dark"
                  active={pathname === `/tasks/${list.id}` || pathname.startsWith(`/tasks/${list.id}/`)}
                  onNavigate={close}
                />
              ))}
            </div>
            <MainLink
              href="/clients"
              label="Klienti"
              icon={Building2}
              active={clientsActive}
              onNavigate={close}
            />
            <MainLink
              href="/outgoing_invoices"
              label="Izejošie rēķini"
              icon={FileOutput}
              active={navActive(pathname, "/outgoing_invoices")}
              count={outgoingUnpaid}
              onNavigate={close}
            />
            <MainLink
              href="/incoming_invoices"
              label="Ienākošie rēķini"
              icon={FileInput}
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
                  active={navActive(pathname, item.href, item.exact)}
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
            <MainLink href="/accounting" label="Grāmatvedība" icon={Calculator} active={accountingActive} onNavigate={close} />
            <div className="space-y-1 py-1 pl-3 lg:hidden">
              {ACCOUNTING_LINKS.map((link) => (
                <SubLink
                  key={link.href}
                  {...link}
                  tone="dark"
                  active={link.href === "/accounting" ? pathname === "/accounting" : navActive(pathname, link.href)}
                  onNavigate={close}
                />
              ))}
            </div>
            {CATALOG.map((item) => (
              <div key={item.href}>
                <MainLink
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={navActive(pathname, item.href)}
                  onNavigate={close}
                />
                {item.href === "/warehouse" ? (
                  <div className="space-y-1 py-1 pl-3 lg:hidden">
                    {WAREHOUSE_LINKS.map((link) => (
                      <SubLink
                        key={link.href}
                        {...link}
                        tone="dark"
                        active={link.href === "/warehouse" ? warehouseListActive : navActive(pathname, link.href)}
                        onNavigate={close}
                      />
                    ))}
                  </div>
                ) : null}
                {item.href === "/employees" ? (
                  <div className="space-y-1 py-1 pl-3 lg:hidden">
                    {EMPLOYEE_LINKS.map((link) => (
                      <SubLink
                        key={link.href}
                        {...link}
                        tone="dark"
                        active={link.href === "/employees" ? employeesListActive : navActive(pathname, link.href)}
                        onNavigate={close}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <MainLink
              href={SETTINGS.href}
              label={SETTINGS.label}
              icon={SETTINGS.icon}
              active={navActive(pathname, SETTINGS.href)}
              onNavigate={close}
            />
          </div>
        </nav>

        <PersonalTodoButton count={todoCount} open={todoOpen} onClick={() => setTodoOpen((current) => !current)} />
        <div className="m-3 mt-0 rounded-2xl bg-white/8 p-3">
          <p className="text-sm font-semibold">Sandris Ozoliņš</p>
          <p className="mt-0.5 text-xs text-[#b7d4c6]">Vadītājs</p>
        </div>
      </aside>
      <PersonalTodoPanel open={todoOpen} onClose={() => setTodoOpen(false)} />

      {incomingActive ? (
        <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r border-[#d3e4da] bg-[#f4faf6] px-3 py-6 lg:flex">
          <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Ienākošie rēķini</p>
          <nav className="mt-4 flex flex-1 flex-col">
            <div className="space-y-1">
              {INCOMING.map((item) => (
                <SubLink
                  key={item.href}
                  {...item}
                  active={navActive(pathname, item.href, item.exact)}
                  count={countFor(item.href)}
                />
              ))}
            </div>
            <div className="mt-4 border-t border-[#d3e4da] pt-4">
              <SubLink {...INCOMING_SETTINGS} active={sectionSettingsActive} />
            </div>
          </nav>
        </aside>
      ) : warehouseActive ? (
        <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r border-[#d3e4da] bg-[#f4faf6] px-3 py-6 lg:flex">
          <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Noliktava</p>
          <nav className="mt-4 space-y-1">
            {WAREHOUSE_LINKS.map((link) => (
              <SubLink
                key={link.href}
                {...link}
                active={link.href === "/warehouse" ? warehouseListActive : navActive(pathname, link.href)}
              />
            ))}
          </nav>
        </aside>
      ) : tasksActive ? (
        <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r border-[#d3e4da] bg-[#f4faf6] px-3 py-6 lg:flex">
          <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Uzdevumi</p>
          <nav className="mt-4 space-y-1">
            <SubLink href="/tasks" label="Visi" icon={List} active={pathname === "/tasks"} />
            {taskLists.map((list) => (
              <SubLink
                key={list.id}
                href={`/tasks/${list.id}`}
                label={list.name}
                icon={ListTodo}
                active={pathname === `/tasks/${list.id}` || pathname.startsWith(`/tasks/${list.id}/`)}
              />
            ))}
          </nav>
        </aside>
      ) : accountingActive ? (
        <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r border-[#d3e4da] bg-[#f4faf6] px-3 py-6 lg:flex">
          <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Grāmatvedība</p>
          <nav className="mt-4 space-y-1">
            {ACCOUNTING_LINKS.map((link) => (
              <SubLink
                key={link.href}
                {...link}
                active={link.href === "/accounting" ? pathname === "/accounting" : navActive(pathname, link.href)}
              />
            ))}
          </nav>
        </aside>
      ) : employeesActive ? (
        <aside className="sticky top-0 hidden h-screen flex-col self-start overflow-y-auto border-r border-[#d3e4da] bg-[#f4faf6] px-3 py-6 lg:flex">
          <p className="px-3 text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">Darbinieki</p>
          <nav className="mt-4 space-y-1">
            {EMPLOYEE_LINKS.map((link) => (
              <SubLink
                key={link.href}
                {...link}
                active={link.href === "/employees" ? employeesListActive : navActive(pathname, link.href)}
              />
            ))}
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
        <FeedbackToasts notices={notices} onDismiss={dismissNotice} />
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
  exact?: boolean;
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
