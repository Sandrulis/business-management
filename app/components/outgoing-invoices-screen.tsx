import { OutgoingInvoicesView } from "@/app/components/outgoing-invoices-view";
import { loadOutgoingInvoices } from "@/app/lib/outgoing/repository";
import { connection } from "next/server";
import { Suspense } from "react";

export function OutgoingInvoicesScreen() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <OutgoingInvoicesContent />
    </Suspense>
  );
}

async function OutgoingInvoicesContent() {
  await connection();
  const loaded = await loadOutgoingInvoices();
  return <OutgoingInvoicesView initialInvoices={loaded.items} available={loaded.ok} />;
}
