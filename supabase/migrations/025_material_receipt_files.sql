alter table public.material_receipts add column if not exists file_name text not null default '';
alter table public.material_receipts add column if not exists file_mime text not null default '';
alter table public.material_receipts add column if not exists storage_path text;

notify pgrst, 'reload schema';
