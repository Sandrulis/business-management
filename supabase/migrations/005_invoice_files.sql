alter table public.inbox_items add column if not exists file_mime text not null default '';
alter table public.inbox_items add column if not exists storage_path text;

insert into storage.buckets (id, name, public)
values ('invoice-files', 'invoice-files', false)
on conflict (id) do update set public = false;
