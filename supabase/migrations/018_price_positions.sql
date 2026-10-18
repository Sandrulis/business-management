create table if not exists public.price_positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default '',
  kind text not null check (kind in ('warehouse', 'shop', 'quarry', 'factory')),
  role text not null check (role in ('material', 'mechanism')),
  created_at timestamptz not null default now()
);

create table if not exists public.price_entries (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.price_positions(id) on delete cascade,
  priced_on date not null default current_date,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  unit_price numeric(14,4) not null check (unit_price >= 0),
  supplier text not null default '',
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists price_entries_position_idx
  on public.price_entries (position_id, priced_on desc, created_at desc);

alter table public.price_positions enable row level security;
alter table public.price_entries enable row level security;

drop policy if exists "demo_price_positions_all" on public.price_positions;
create policy "demo_price_positions_all"
on public.price_positions
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_price_entries_all" on public.price_entries;
create policy "demo_price_entries_all"
on public.price_entries
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.price_positions to anon, authenticated;
grant select, insert, update, delete on public.price_entries to anon, authenticated;

notify pgrst, 'reload schema';
