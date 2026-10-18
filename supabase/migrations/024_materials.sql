create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.material_receipts (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  quantity numeric(14,3) not null check (quantity > 0),
  shop text not null default '',
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists materials_created_at_idx on public.materials (created_at desc);
create index if not exists material_receipts_material_idx on public.material_receipts (material_id, created_at desc);

alter table public.materials enable row level security;
alter table public.material_receipts enable row level security;

drop policy if exists "demo_materials_all" on public.materials;
create policy "demo_materials_all"
on public.materials
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "demo_material_receipts_all" on public.material_receipts;
create policy "demo_material_receipts_all"
on public.material_receipts
for all
to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.materials to anon, authenticated;
grant select, insert, update, delete on public.material_receipts to anon, authenticated;

notify pgrst, 'reload schema';
