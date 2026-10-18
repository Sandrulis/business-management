create table if not exists public.outgoing_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.sites(id) on delete set null,
  client_name text not null default '',
  number text not null,
  issued_on date not null,
  due_on date not null,
  net numeric(14,2) not null check (net >= 0),
  gross numeric(14,2) not null check (gross >= 0),
  category_id text not null default '',
  category_name text not null default '',
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  unique (number)
);

create index if not exists outgoing_invoices_issued_on_idx on public.outgoing_invoices (issued_on desc);

alter table public.outgoing_invoices enable row level security;

drop policy if exists "demo_outgoing_invoices_all" on public.outgoing_invoices;
create policy "demo_outgoing_invoices_all"
on public.outgoing_invoices
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.outgoing_invoices to anon, authenticated;

notify pgrst, 'reload schema';
