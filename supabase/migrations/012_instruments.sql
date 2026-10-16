create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  brand text not null,
  model text not null,
  serial_number text not null,
  purchased_on date not null,
  price numeric(14,2) not null check (price >= 0),
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.instrument_assignments (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  assigned_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists instruments_created_at_idx on public.instruments (created_at desc);
create index if not exists instrument_assignments_instrument_idx on public.instrument_assignments (instrument_id, created_at desc);

alter table public.instruments enable row level security;
alter table public.instrument_assignments enable row level security;

drop policy if exists "demo_instruments_all" on public.instruments;
create policy "demo_instruments_all"
on public.instruments
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_instrument_assignments_all" on public.instrument_assignments;
create policy "demo_instrument_assignments_all"
on public.instrument_assignments
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.instruments to anon, authenticated;
grant select, insert, update, delete on public.instrument_assignments to anon, authenticated;

notify pgrst, 'reload schema';
