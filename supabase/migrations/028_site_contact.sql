alter table public.sites add column if not exists email text not null default '';
alter table public.sites add column if not exists phone text not null default '';
alter table public.sites add column if not exists note text not null default '';

notify pgrst, 'reload schema';
