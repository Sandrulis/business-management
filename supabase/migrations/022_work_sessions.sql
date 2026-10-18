create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name text not null,
  site_id uuid references public.sites(id) on delete set null,
  place_name text not null,
  place_address text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint work_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index if not exists work_sessions_started_at_idx on public.work_sessions (started_at desc);
create unique index if not exists work_sessions_open_employee_idx
  on public.work_sessions (employee_id)
  where ended_at is null;

alter table public.work_sessions enable row level security;

drop policy if exists "demo_work_sessions_all" on public.work_sessions;
create policy "demo_work_sessions_all"
on public.work_sessions
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.work_sessions to anon, authenticated;

notify pgrst, 'reload schema';
