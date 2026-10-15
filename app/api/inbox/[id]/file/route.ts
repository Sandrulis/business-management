import { downloadInvoiceFile } from "@/app/lib/invoices/files";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Nav atrasts.", { status: 404 });

  const supabase = createAdminClient();
  if (!supabase) return new Response("Datubāze nav pieslēgta.", { status: 503 });

  const row = await supabase.from("inbox_items").select("file_name, file_mime, storage_path").eq("id", id).maybeSingle();
  if (row.error || !row.data?.storage_path) return new Response("Fails nav saglabāts.", { status: 404 });

  const bytes = await downloadInvoiceFile(supabase, row.data.storage_path as string);
  if (!bytes) return new Response("Failu neizdevās atvērt.", { status: 404 });

  const name = (row.data.file_name as string | null) || "rekins";
  const mime = (row.data.file_mime as string) || "application/octet-stream";
  const inline = mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("text/");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, max-age=3600",
    },
  });
}
