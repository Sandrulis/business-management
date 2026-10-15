"use client";

import { PdfPreview } from "@/app/components/pdf-preview";
import { invoicePreviewKind } from "@/app/lib/invoices/files";
import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export function InvoicePreviewModal({
  src,
  name,
  mime,
  onClose,
}: {
  src: string;
  name: string;
  mime: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kind = invoicePreviewKind(mime, name);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-[#12382c]/35 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Rēķina priekšskatījums" className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white text-[#143028] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#e4efe8] px-5 py-4">
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#5f756a]" aria-label="Aizvērt">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {kind === "pdf" ? <PdfPreview src={src} name={name} bare /> : null}
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={name} className="w-full rounded-xl bg-white" />
          ) : null}
          {kind === "file" ? (
            <a href={src} className="text-sm font-semibold text-[#1a6b4a]">
              Atvērt {name}
            </a>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
