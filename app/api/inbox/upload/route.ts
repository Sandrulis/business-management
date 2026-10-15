import type { InboxItem } from "@/app/lib/invoices/model";
import { invoiceFileMime, invoiceStoragePath, MAX_INVOICE_FILE_BYTES, removeInvoiceFile, rigaToday, uploadInvoiceFile } from "@/app/lib/invoices/files";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) return Response.json({ message: "Datubāze nav pieslēgta." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ message: "Fails nav pievienots." }, { status: 400 });
  }
  if (file.size > MAX_INVOICE_FILE_BYTES) {
    return Response.json({ message: "Fails ir par lielu. Maksimālais izmērs ir 20 MB." }, { status: 400 });
  }

  const mime = invoiceFileMime(file.name, file.type);
  const path = invoiceStoragePath(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadInvoiceFile(supabase, path, bytes, mime);
  if (uploaded) return Response.json({ message: "Failu neizdevās saglabāt." }, { status: 502 });

  const stem = file.name.replace(/\.[^.]+$/, "") || "Jauns rēķins";
  const inserted = await supabase
    .from("inbox_items")
    .insert({
      source: "upload",
      from_email: "Augšupielāde",
      subject: file.name,
      file_name: file.name,
      file_mime: mime,
      file_size: file.size,
      storage_path: path,
      received_on: rigaToday(),
      supplier: stem.slice(0, 120),
      number: stem.slice(0, 40),
      net: null,
      gross: null,
      due_on: null,
      unread: true,
      message_id: null,
    })
    .select("id, received_on")
    .single();

  if (inserted.error || !inserted.data) {
    await removeInvoiceFile(supabase, path);
    return Response.json({ message: inserted.error?.message ?? "Failu neizdevās pievienot." }, { status: 502 });
  }

  const item: InboxItem = {
    id: inserted.data.id as string,
    source: "upload",
    fromEmail: "Augšupielāde",
    subject: file.name,
    fileName: file.name,
    fileMime: mime,
    fileSize: file.size,
    receivedOn: inserted.data.received_on as string,
    supplier: stem.slice(0, 120),
    number: stem.slice(0, 40),
    net: null,
    gross: null,
    dueOn: null,
    messageId: null,
    bodyText: "",
    storagePath: path,
  };

  return Response.json({ item });
}
