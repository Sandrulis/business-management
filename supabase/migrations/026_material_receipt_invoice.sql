alter table public.material_receipts add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
alter table public.material_receipts drop column if exists file_name;
alter table public.material_receipts drop column if exists file_mime;
alter table public.material_receipts drop column if exists storage_path;

create index if not exists material_receipts_invoice_idx on public.material_receipts (invoice_id);

notify pgrst, 'reload schema';
