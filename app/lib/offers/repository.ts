import { createDataClient } from "@/app/lib/invoices/repository";
import { sanitizeOfferDocument, type OfferDocument } from "@/app/lib/offers/model";

export async function loadOfferSiteIds(): Promise<string[]> {
  const documents = await loadOfferDocuments();
  return documents.map((row) => row.siteId);
}

export async function loadOfferDocuments(): Promise<{ siteId: string; document: OfferDocument }[]> {
  const supabase = createDataClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("offers").select("site_id, document");
  if (error || !data) return [];
  return data.map((row) => ({ siteId: row.site_id as string, document: sanitizeOfferDocument(row.document) }));
}

export async function loadOffer(siteId: string): Promise<{ ok: true; document: OfferDocument } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data, error } = await supabase.from("offers").select("document").eq("site_id", siteId).maybeSingle();
  if (error) return { ok: false, message: "Piedāvājumu neizdevās ielādēt." };
  return { ok: true, document: sanitizeOfferDocument(data?.document ?? []) };
}

export async function saveOffer(siteId: string, document: OfferDocument): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { error } = await supabase.from("offers").upsert(
    { site_id: siteId, document, updated_at: new Date().toISOString() },
    { onConflict: "site_id" },
  );
  if (error) return { ok: false, message: "Piedāvājumu neizdevās saglabāt." };
  return { ok: true };
}
