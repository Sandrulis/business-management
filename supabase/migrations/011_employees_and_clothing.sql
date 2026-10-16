create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  personal_code text not null unique,
  email text not null,
  phone text not null,
  contract_number text not null,
  contract_date date not null,
  role text not null,
  photo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.clothing (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value numeric(14,2) not null check (value >= 0),
  months integer not null check (months >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.clothing_stocks (
  clothing_id uuid not null references public.clothing(id) on delete cascade,
  size text not null,
  quantity integer not null check (quantity >= 0),
  primary key (clothing_id, size)
);

create unique index if not exists clothing_stocks_size_ci_idx
  on public.clothing_stocks (clothing_id, lower(size));

create index if not exists employees_created_at_idx on public.employees (created_at desc);
create index if not exists clothing_created_at_idx on public.clothing (created_at desc);

alter table public.employees enable row level security;
alter table public.clothing enable row level security;
alter table public.clothing_stocks enable row level security;

drop policy if exists "demo_employees_all" on public.employees;
create policy "demo_employees_all"
on public.employees
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_clothing_all" on public.clothing;
create policy "demo_clothing_all"
on public.clothing
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_clothing_stocks_all" on public.clothing_stocks;
create policy "demo_clothing_stocks_all"
on public.clothing_stocks
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.employees to anon, authenticated;
grant select, insert, update, delete on public.clothing to anon, authenticated;
grant select, insert, update, delete on public.clothing_stocks to anon, authenticated;

notify pgrst, 'reload schema';
