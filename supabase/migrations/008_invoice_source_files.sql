alter table public.invoices add column if not exists from_email text not null default '';
alter table public.invoices add column if not exists subject text not null default '';
alter table public.invoices add column if not exists body_text text not null default '';
alter table public.invoices add column if not exists file_name text;
alter table public.invoices add column if not exists file_mime text not null default '';
alter table public.invoices add column if not exists file_size bigint;
alter table public.invoices add column if not exists storage_path text;
