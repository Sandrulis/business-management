import { createDataClient } from "@/app/lib/invoices/repository";
import {
  type InvoiceOption,
  type PriceEntry,
  type PriceKind,
  type PricePosition,
  type PriceRole,
} from "@/app/lib/prices/model";

type EntryRow = {
  id: string;
  position_id: string;
  priced_on: string;
  quantity: number | string;
  unit_price: number | string;
  supplier: string;
  invoice_id: string | null;
  document: string | null;
  created_at: string;
  invoices: { number: string; supplier: string } | { number: string; supplier: string }[] | null;
};

type PositionRow = {
  id: string;
  name: string;
  unit: string;
  kind: string;
  role: string;
};

export async function loadPriceCatalog(): Promise<
  { ok: true; positions: PricePosition[]; invoices: InvoiceOption[] } | { ok: false; message: string }
> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const [positions, entries, invoices] = await Promise.all([
    supabase.from("price_positions").select("id, name, unit, kind, role").order("name"),
    supabase
      .from("price_entries")
      .select("id, position_id, priced_on, quantity, unit_price, supplier, invoice_id, document, created_at, invoices(number, supplier)")
      .order("priced_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, number, supplier, issued_on").order("issued_on", { ascending: false }).limit(80),
  ]);
  if (positions.error || entries.error || invoices.error) return { ok: false, message: "Pozīciju cenas neizdevās ielādēt." };
  const grouped = new Map<string, PriceEntry[]>();
  for (const row of (entries.data ?? []) as EntryRow[]) {
    const list = grouped.get(row.position_id) ?? [];
    list.push(toEntry(row));
    grouped.set(row.position_id, list);
  }
  return {
    ok: true,
    positions: ((positions.data ?? []) as PositionRow[]).map((row) => toPosition(row, grouped.get(row.id) ?? [])),
    invoices: (invoices.data ?? []).map((row) => ({
      id: row.id as string,
      number: row.number as string,
      supplier: row.supplier as string,
      issuedOn: row.issued_on as string,
    })),
  };
}

export async function savePricePosition(input: {
  id?: string;
  name: string;
  unit: string;
  kind: PriceKind;
  role: PriceRole;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const payload = { name: input.name.trim(), unit: input.unit.trim(), kind: input.kind, role: input.role };
  if (input.id) {
    const { error } = await supabase.from("price_positions").update(payload).eq("id", input.id);
    if (error) return { ok: false, message: "Pozīciju neizdevās saglabāt." };
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from("price_positions").insert(payload).select("id").single();
  if (error || !data) return { ok: false, message: "Pozīciju neizdevās saglabāt." };
  return { ok: true, id: data.id as string };
}

export async function addPriceEntry(input: {
  positionId: string;
  pricedOn: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
  invoiceId: string | null;
  document?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { error } = await supabase.from("price_entries").insert({
    position_id: input.positionId,
    priced_on: input.pricedOn,
    quantity: input.quantity,
    unit_price: input.unitPrice,
    supplier: input.supplier.trim(),
    invoice_id: input.invoiceId,
    document: input.document?.trim() ?? "",
  });
  if (error) return { ok: false, message: "Cenu neizdevās pievienot." };
  return { ok: true };
}

export async function deletePricePosition(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { error } = await supabase.from("price_positions").delete().eq("id", id);
  if (error) return { ok: false, message: "Pozīciju neizdevās dzēst." };
  return { ok: true };
}

function toPosition(row: PositionRow, entries: PriceEntry[]): PricePosition {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    kind: row.kind === "shop" || row.kind === "quarry" || row.kind === "factory" ? row.kind : "warehouse",
    role: row.role === "mechanism" ? "mechanism" : "material",
    entries,
  };
}

function toEntry(row: EntryRow): PriceEntry {
  const invoice = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
  return {
    id: row.id,
    pricedOn: row.priced_on,
    quantity: num(row.quantity),
    unitPrice: num(row.unit_price),
    supplier: row.supplier,
    invoiceId: row.invoice_id,
    invoiceNumber: invoice?.number ?? "",
    document: row.document?.trim() ?? "",
    createdAt: row.created_at,
  };
}

function num(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
