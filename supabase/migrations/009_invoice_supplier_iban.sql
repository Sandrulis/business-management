alter table public.invoices add column if not exists supplier_iban text not null default '';
