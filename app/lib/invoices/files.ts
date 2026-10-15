import type { SupabaseClient } from "@supabase/supabase-js";

export const INVOICE_FILES_BUCKET = "invoice-files";
export const MAX_INVOICE_FILE_BYTES = 20 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  heic: "image/heic",
  txt: "text/plain",
  csv: "text/csv",
  xml: "application/xml",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function invoiceFileMime(name: string, type: string) {
  const given = type.trim().toLowerCase();
  if (given && given !== "application/octet-stream") return given;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

export function invoicePreviewKind(mime: string, name: string): "pdf" | "image" | "file" {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(lower)) return "image";
  return "file";
}

export function invoiceStoragePath(fileName: string) {
  const raw = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const ext = raw && raw.length <= 5 ? `.${raw}` : "";
  return `${crypto.randomUUID()}${ext}`;
}

export async function uploadInvoiceFile(
  supabase: SupabaseClient,
  path: string,
  bytes: Buffer,
  mime: string,
) {
  const { error } = await supabase.storage.from(INVOICE_FILES_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  return error?.message ?? null;
}

export async function downloadInvoiceFile(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.storage.from(INVOICE_FILES_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeInvoiceFile(supabase: SupabaseClient, path: string) {
  await supabase.storage.from(INVOICE_FILES_BUCKET).remove([path]);
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatSizeUnit(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${formatSizeUnit(bytes / (1024 * 1024))} MB`;
  return `${formatSizeUnit(bytes / (1024 * 1024 * 1024))} GB`;
}

function formatSizeUnit(value: number) {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded).replace(".", ",");
}

export function rigaToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
