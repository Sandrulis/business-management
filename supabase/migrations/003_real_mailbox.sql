alter table public.inbox_items add column if not exists message_id text;

create unique index if not exists inbox_items_message_id_idx
  on public.inbox_items (message_id)
  where message_id is not null;

create table if not exists public.mailbox_imports (
  message_id text primary key,
  imported_at timestamptz not null default now()
);

alter table public.mailbox_imports enable row level security;

delete from public.invoices
where number in (
  'DEP-44102',
  'CS-9088',
  'CK-22014',
  'RAM-331',
  'EL-55291',
  'HLT-1002',
  'DEP-43990'
);

delete from public.inbox_items
where number in ('DEP-44821', '883920', 'ABC-77')
  and message_id is null;

update public.company_settings
set mailbox_email = '', mailbox_password = ''
where id = 1
  and mailbox_email = 'rekini@uznemums.lv'
  and mailbox_password = 'test-parole';
