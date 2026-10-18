"use client";

import { PdfPreview } from "@/app/components/pdf-preview";
import { RightDrawer } from "@/app/components/right-drawer";
import { invoicePreviewKind } from "@/app/lib/invoices/files";

export function InvoicePreviewModal({
  src,
  name,
  mime,
  beside,
  front = false,
  hint = "Rēķina fails",
  onClose,
}: {
  src: string;
  name: string;
  mime: string;
  beside?: number;
  front?: boolean;
  hint?: string;
  onClose: () => void;
}) {
  return (
    <RightDrawer wide beside={beside} front={front} title={name} hint={hint} onClose={onClose}>
      <InvoiceFileView src={src} name={name} mime={mime} />
    </RightDrawer>
  );
}

export function InvoiceFileView({ src, name, mime }: { src: string; name: string; mime: string }) {
  const kind = invoicePreviewKind(mime, name);
  if (kind === "pdf") return <PdfPreview src={src} name={name} bare />;
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className="w-full rounded-xl bg-white" />
    );
  }
  return (
    <a href={src} className="text-sm font-semibold text-[#1a6b4a]">
      Atvērt {name}
    </a>
  );
}
