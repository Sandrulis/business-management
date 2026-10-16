create table if not exists public.clothing_assignments (
  id uuid primary key default gen_random_uuid(),
  clothing_id uuid not null references public.clothing(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  size text not null,
  assigned_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists clothing_assignments_employee_idx
  on public.clothing_assignments (employee_id, created_at desc);

alter table public.clothing_assignments enable row level security;

drop policy if exists "demo_clothing_assignments_all" on public.clothing_assignments;
create policy "demo_clothing_assignments_all"
on public.clothing_assignments
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.clothing_assignments to anon, authenticated;

notify pgrst, 'reload schema';