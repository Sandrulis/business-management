import { formatMoney } from "@/app/lib/invoices/model";

export type PriceKind = "warehouse" | "shop" | "quarry" | "factory";
export type PriceRole = "material" | "mechanism";

export type PriceEntry = {
  id: string;
  pricedOn: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
  invoiceId: string | null;
  invoiceNumber: string;
  document: string;
  createdAt: string;
};

export type PricePosition = {
  id: string;
  name: string;
  unit: string;
  kind: PriceKind;
  role: PriceRole;
  entries: PriceEntry[];
};

export type InvoiceOption = {
  id: string;
  number: string;
  supplier: string;
  issuedOn: string;
};

export const PRICE_KINDS: { id: PriceKind; label: string }[] = [
  { id: "warehouse", label: "Noliktava" },
  { id: "shop", label: "Veikals" },
  { id: "quarry", label: "Karjers" },
  { id: "factory", label: "Ražotne" },
];

export const PRICE_ROLES: { id: PriceRole; label: string }[] = [
  { id: "material", label: "Materiāls" },
  { id: "mechanism", label: "Mehānisms" },
];

export function kindLabel(kind: PriceKind) {
  return PRICE_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function roleLabel(role: PriceRole) {
  return PRICE_ROLES.find((item) => item.id === role)?.label ?? role;
}

export function latestEntry(position: PricePosition) {
  return position.entries[0] ?? null;
}

export function stockQuantity(position: PricePosition) {
  if (position.kind !== "warehouse") return null;
  return position.entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

export function formatUnitPrice(value: number) {
  return formatMoney(value).replace(" €", "");
}

export function formatQuantity(value: number) {
  const [whole, fraction = ""] = value.toFixed(3).split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return trimmed ? `${grouped},${trimmed}` : grouped;
}

export function parseDecimal(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "" || normalized === "." || normalized === "-") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
