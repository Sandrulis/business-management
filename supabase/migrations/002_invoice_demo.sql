-- Demo rēķini grāmatvedes apskatei. Nav pieslēgts vecajai organizāciju shēmai.

create table if not exists public.company_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default '',
  registration_number text not null default '',
  vat_number text not null default '',
  address text not null default '',
  email text not null default '',
  phone text not null default '',
  vat_rate text not null default '21',
  payment_days text not null default '14',
  currency text not null default 'EUR',
  bank_name text not null default '',
  iban text not null default '',
  overdue_reminders boolean not null default true,
  mailbox_email text not null default '',
  mailbox_password text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  supplier text not null,
  client text not null,
  object_name text not null,
  cost_type text not null,
  net numeric(14,2) not null,
  gross numeric(14,2) not null,
  issued_on date not null,
  due_on date not null,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'email' check (source in ('email', 'upload')),
  from_email text not null default '',
  subject text not null default '',
  file_name text,
  received_on date not null default current_date,
  supplier text not null,
  number text not null,
  net numeric(14,2),
  gross numeric(14,2),
  due_on date,
  unread boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists invoices_issued_on_idx on public.invoices (issued_on desc);
create index if not exists invoices_unpaid_due_idx on public.invoices (due_on) where paid = false;
create index if not exists inbox_items_unread_idx on public.inbox_items (received_on desc) where unread = true;

insert into public.company_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.company_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.inbox_items enable row level security;

drop policy if exists "demo_company_settings_all" on public.company_settings;
create policy "demo_company_settings_all"
on public.company_settings
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_invoices_all" on public.invoices;
create policy "demo_invoices_all"
on public.invoices
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_inbox_items_all" on public.inbox_items;
create policy "demo_inbox_items_all"
on public.inbox_items
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.company_settings to anon, authenticated;
grant select, insert, update, delete on public.invoices to anon, authenticated;
grant select, insert, update, delete on public.inbox_items to anon, authenticated;
