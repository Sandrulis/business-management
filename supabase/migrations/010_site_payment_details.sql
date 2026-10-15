alter table public.sites add column if not exists iban text not null default '';
alter table public.sites add column if not exists bank_name text not null default '';
