import { parseInvoiceText, type InvoiceRead } from "@/app/lib/invoices/parse-invoice-text";
import type { PDFPageProxy } from "pdfjs-dist";

type PdfTextItem = { str?: string; transform?: number[] };

export async function readInvoiceFile(
  src: string,
  kind: "pdf" | "image",
  isCancelled: () => boolean,
): Promise<InvoiceRead> {
  const response = await fetch(src);
  if (!response.ok) throw new Error("file");
  if (kind === "image") {
    const text = await recognize(await response.blob(), isCancelled);
    return parseInvoiceText(text);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data });
  try {
    const pdf = await task.promise;
    let text = "";
    const pageCount = Math.min(pdf.numPages, 3);
    for (let number = 1; number <= pageCount; number += 1) {
      if (isCancelled()) return parseInvoiceText(text);
      const page = await pdf.getPage(number);
      text += `${await pageLines(page)}\n`;
    }
    if (text.trim().length < 40) {
      const ocrPages = Math.min(pdf.numPages, 2);
      for (let number = 1; number <= ocrPages; number += 1) {
        if (isCancelled()) break;
        const page = await pdf.getPage(number);
        text += `\n${await recognize(await pageCanvas(page), isCancelled)}`;
      }
    }
    return parseInvoiceText(text);
  } finally {
    await task.destroy();
  }
}

async function pageLines(page: PDFPageProxy) {
  const content = await page.getTextContent();
  const rows: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const entry of content.items) {
    const item = entry as PdfTextItem;
    if (!item.str?.trim() || !item.transform) continue;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, str: item.str });
  }
  rows.sort((left, right) => right.y - left.y);
  return rows
    .map((row) =>
      row.parts
        .sort((left, right) => left.x - right.x)
        .map((part) => part.str)
        .join(" "),
    )
    .join("\n");
}

async function pageCanvas(page: PDFPageProxy) {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2, 1400 / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

async function recognize(image: Blob | HTMLCanvasElement, isCancelled: () => boolean) {
  if (isCancelled()) return "";
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("lav+eng", 1, { logger() {} }).catch(() => createWorker("eng", 1, { logger() {} }));
  const url = image instanceof Blob ? URL.createObjectURL(image) : null;
  try {
    if (isCancelled()) return "";
    const result = await worker.recognize(url ?? (image as HTMLCanvasElement));
    return result.data.text ?? "";
  } finally {
    if (url) URL.revokeObjectURL(url);
    await worker.terminate();
  }
}
