import { cleanInvoiceId, toReceipt } from "@/app/lib/catalog/receipt-record";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) return Response.json({ message: "Datubāze nav pieslēgta." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as {
    materialId?: string;
    quantity?: number;
    amount?: number;
    shop?: string;
    invoiceId?: string | null;
  } | null;
  const materialId = body?.materialId ?? "";
  const quantity = Number(body?.quantity);
  const amount = Number(body?.amount);
  const shop = String(body?.shop ?? "").trim();
  const invoiceId = cleanInvoiceId(body?.invoiceId);
  if (!/^[0-9a-f-]{36}$/i.test(materialId)) return Response.json({ message: "Materiāls nav atrasts." }, { status: 400 });
  if (invoiceId === false) return Response.json({ message: "Rēķins nav atrasts." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) return Response.json({ message: "Daudzums nav derīgs." }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) return Response.json({ message: "Summa nav derīga." }, { status: 400 });

  const inserted = await supabase
    .from("material_receipts")
    .insert({
      material_id: materialId,
      quantity,
      shop,
      amount,
      invoice_id: invoiceId,
    })
    .select("id, quantity, shop, amount, created_at, invoice_id")
    .single();

  if (inserted.error || !inserted.data) return Response.json({ message: "Atlikumu neizdevās saglabāt." }, { status: 502 });
  return Response.json({ receipt: toReceipt(inserted.data) });
}
