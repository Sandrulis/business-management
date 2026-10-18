import type { MaterialReceipt } from "@/app/lib/catalog/types";

export function cleanInvoiceId(value: string | null | undefined) {
  if (value == null || value === "") return null;
  return /^[0-9a-f-]{36}$/i.test(value) ? value : false;
}

export function toReceipt(row: {
  id: string;
  quantity: number | string;
  shop: string | null;
  amount: number | string;
  created_at: string;
  invoice_id: string | null;
}): MaterialReceipt {
  return {
    id: row.id,
    quantity: Number(row.quantity),
    shop: row.shop ?? "",
    amount: Number(row.amount),
    createdAt: row.created_at,
    invoiceId: row.invoice_id,
  };
}
