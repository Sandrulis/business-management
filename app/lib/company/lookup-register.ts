const REGISTER_RESOURCE = "25e80bf3-f107-4ab4-89ef-251b5b9374e9";
const VAT_RESOURCE = "610910e9-e086-4c5b-a7ea-0a896a697672";
const DATA_URL = "https://data.gov.lv/dati/lv/api/action/datastore_search";

export type CompanyLookup = {
  registrationNumber: string;
  name: string;
  address: string;
  vatNumber: string | null;
};

type RegisterRow = {
  name?: string;
  name_before_quotes?: string;
  name_in_quotes?: string;
  name_after_quotes?: string;
  address?: string;
};

export async function lookupRegisteredCompany(registrationNumber: string): Promise<CompanyLookup | null> {
  const reg = registrationNumber.replace(/\D/g, "");
  if (!/^\d{11}$/.test(reg)) return null;

  const register = await search<RegisterRow>(REGISTER_RESOURCE, { regcode: reg });
  const row = register[0];
  if (!row) return null;

  const vatRows = await search<{ Aktivs?: string; Izslegts?: string }>(VAT_RESOURCE, { Numurs: `LV${reg}` });
  const vat = vatRows[0];
  const active = (vat?.Aktivs ?? "").trim().toLowerCase() === "ir";
  const removed = (vat?.Izslegts ?? "").trim() !== "";

  return {
    registrationNumber: reg,
    name: displayName(row),
    address: (row.address ?? "").trim(),
    vatNumber: active && !removed ? `LV${reg}` : null,
  };
}

function displayName(row: RegisterRow) {
  const quoted = (row.name_in_quotes ?? "").trim();
  const form = [row.name_before_quotes, row.name_after_quotes].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
  if (quoted && form) return `${quoted}, ${form}`;
  return (row.name ?? "").replaceAll('"', "").replaceAll("'", "").trim();
}

async function search<T>(resourceId: string, filters: Record<string, string>): Promise<T[]> {
  const response = await fetch(DATA_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ resource_id: resourceId, filters, limit: 1 }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("register");
  const payload = (await response.json()) as { success?: boolean; result?: { records?: T[] } };
  if (!payload.success) throw new Error("register");
  return payload.result?.records ?? [];
}
