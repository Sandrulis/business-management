import { cleanInvoiceId, toReceipt } from "@/app/lib/catalog/receipt-record";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const maxDuration = 60;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Atlikums nav atrasts." }, { status: 404 });

  const supabase = createAdminClient();
  if (!supabase) return Response.json({ message: "Datubāze nav pieslēgta." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as {
    quantity?: number;
    amount?: number;
    shop?: string;
    invoiceId?: string | null;
  } | null;
  const quantity = Number(body?.quantity);
  const amount = Number(body?.amount);
  const shop = String(body?.shop ?? "").trim();
  const invoiceId = cleanInvoiceId(body?.invoiceId);
  if (invoiceId === false) return Response.json({ message: "Rēķins nav atrasts." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) return Response.json({ message: "Daudzums nav derīgs." }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) return Response.json({ message: "Summa nav derīga." }, { status: 400 });

  const updated = await supabase
    .from("material_receipts")
    .update({ quantity, shop, amount, invoice_id: invoiceId })
    .eq("id", id)
    .select("id, quantity, shop, amount, created_at, invoice_id")
    .single();

  if (updated.error || !updated.data) return Response.json({ message: "Atlikumu neizdevās saglabāt." }, { status: 502 });
  return Response.json({ receipt: toReceipt(updated.data) });
}
