import { createDataClient } from "@/app/lib/invoices/repository";

export type OutgoingInvoice = {
  id: string;
  clientId: string | null;
  clientName: string;
  number: string;
  issuedOn: string;
  dueOn: string;
  net: number;
  gross: number;
  categoryId: string;
  categoryName: string;
  paid: boolean;
};

export type OutgoingInvoiceDraft = {
  clientId: string;
  clientName: string;
  number: string;
  issuedOn: string;
  dueOn: string;
  net: number;
  gross: number;
  categoryId: string;
  categoryName: string;
};

const columns = "id, client_id, client_name, number, issued_on, due_on, net, gross, category_id, category_name, paid";

type OutgoingRow = {
  id: string;
  client_id: string | null;
  client_name: string;
  number: string;
  issued_on: string;
  due_on: string;
  net: number | string;
  gross: number | string;
  category_id: string;
  category_name: string;
  paid: boolean;
};

export async function loadOutgoingInvoices(): Promise<{ ok: true; items: OutgoingInvoice[] } | { ok: false; items: OutgoingInvoice[] }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, items: [] };
  const result = await supabase.from("outgoing_invoices").select(columns).order("issued_on", { ascending: false }).order("created_at", { ascending: false });
  if (result.error || !result.data) return { ok: false, items: [] };
  return { ok: true, items: result.data.map(toInvoice) };
}

export async function insertOutgoingInvoice(
  draft: OutgoingInvoiceDraft,
): Promise<{ ok: true; invoice: OutgoingInvoice } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const inserted = await supabase
    .from("outgoing_invoices")
    .insert({
      client_id: draft.clientId,
      client_name: draft.clientName,
      number: draft.number,
      issued_on: draft.issuedOn,
      due_on: draft.dueOn,
      net: draft.net,
      gross: draft.gross,
      category_id: draft.categoryId,
      category_name: draft.categoryName,
    })
    .select(columns)
    .single();
  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === "23505") return { ok: false, message: "Rēķins ar šādu numuru jau ir." };
    return { ok: false, message: "Rēķinu neizdevās saglabāt." };
  }
  return { ok: true, invoice: toInvoice(inserted.data) };
}

export async function markOutgoingInvoicePaid(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const updated = await supabase.from("outgoing_invoices").update({ paid: true }).eq("id", id).select("id").maybeSingle();
  if (updated.error || !updated.data) return { ok: false, message: "Rēķinu neizdevās atzīmēt kā samaksātu." };
  return { ok: true };
}

function toInvoice(row: OutgoingRow): OutgoingInvoice {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    number: row.number,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    net: Number(row.net),
    gross: Number(row.gross),
    categoryId: row.category_id,
    categoryName: row.category_name,
    paid: row.paid,
  };
}
