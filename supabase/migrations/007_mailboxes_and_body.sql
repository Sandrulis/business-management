alter table public.inbox_items add column if not exists body_text text not null default '';

create table if not exists public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists mailboxes_email_idx on public.mailboxes (lower(email));

alter table public.mailboxes enable row level security;

drop policy if exists "demo_mailboxes_all" on public.mailboxes;
create policy "demo_mailboxes_all"
on public.mailboxes
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.mailboxes to anon, authenticated;

insert into public.mailboxes (email, password, sort_order)
select settings.mailbox_email, settings.mailbox_password, 0
from public.company_settings as settings
where settings.id = 1
  and settings.mailbox_email <> ''
  and not exists (
    select 1 from public.mailboxes as mailbox
    where lower(mailbox.email) = lower(settings.mailbox_email)
  );
