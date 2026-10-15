import { AppShell } from "@/app/components/app-shell";
import { InvoiceProvider } from "@/app/components/invoice-state";
import { loadDeskData } from "@/app/lib/invoices/repository";
import { todayIso } from "@/app/lib/invoices/model";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eef5f0]" />}>
      <DeskFrame>{children}</DeskFrame>
    </Suspense>
  );
}

async function DeskFrame({ children }: { children: ReactNode }) {
  await connection();
  const today = todayIso(new Date());
  const data = await loadDeskData();
  return (
    <InvoiceProvider
      today={today}
      connected={data.connected}
      invoices={data.invoices}
      inbox={data.inbox}
      sites={data.sites}
      works={data.works}
      settings={data.settings}
      initialNotice={data.notice}
    >
      <AppShell>{children}</AppShell>
    </InvoiceProvider>
  );
}
