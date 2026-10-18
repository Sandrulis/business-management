create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.sites(id) on delete cascade,
  document jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.offers enable row level security;

drop policy if exists "demo_offers_all" on public.offers;
create policy "demo_offers_all"
on public.offers
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.offers to anon, authenticated;

notify pgrst, 'reload schema';