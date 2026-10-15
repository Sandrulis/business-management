import { removeInvoiceFile } from "@/app/lib/invoices/files";
import { createAdminClient } from "@/app/lib/supabase/admin";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Nav atrasts." }, { status: 404 });

  const supabase = createAdminClient();
  if (!supabase) return Response.json({ message: "Datubāze nav pieslēgta." }, { status: 503 });

  const row = await supabase.from("inbox_items").select("storage_path").eq("id", id).maybeSingle();
  if (row.error || !row.data) return Response.json({ message: "Ieraksts nav atrasts." }, { status: 404 });

  const path = row.data.storage_path as string | null;
  if (path) await removeInvoiceFile(supabase, path);

  const removed = await supabase.from("inbox_items").delete().eq("id", id);
  if (removed.error) return Response.json({ message: "Neizdevās dzēst." }, { status: 502 });

  return Response.json({ ok: true });
}
