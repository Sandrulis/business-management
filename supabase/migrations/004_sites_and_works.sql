create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  customer text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.invoices add column if not exists object_id uuid;
alter table public.invoices add column if not exists work_id uuid;
alter table public.invoices add column if not exists work_name text not null default '';
alter table public.invoices alter column cost_type set default '';

alter table public.sites enable row level security;
alter table public.works enable row level security;

drop policy if exists "demo_sites_all" on public.sites;
create policy "demo_sites_all"
on public.sites
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_works_all" on public.works;
create policy "demo_works_all"
on public.works
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.sites to anon, authenticated;
grant select, insert, update, delete on public.works to anon, authenticated;
