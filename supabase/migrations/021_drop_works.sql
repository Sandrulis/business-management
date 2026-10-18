alter table public.invoices add column if not exists category_id text not null default '';
alter table public.invoices add column if not exists category_name text not null default '';

alter table public.invoices drop column if exists work_id;
alter table public.invoices drop column if exists work_name;

drop policy if exists "demo_works_all" on public.works;
drop table if exists public.works;
