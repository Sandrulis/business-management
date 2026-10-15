create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'manager', 'worker', 'accountant');
create type public.project_status as enum ('lead', 'quoted', 'planned', 'active', 'paused', 'completed', 'cancelled');
create type public.estimate_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
create type public.tool_status as enum ('available', 'assigned', 'maintenance', 'retired');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'worker',
  hourly_cost numeric(12,2) not null default 0 check (hourly_cost >= 0),
  job_title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  registration_number text,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  number text not null,
  title text not null,
  status public.estimate_status not null default 'draft',
  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  valid_until date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  estimate_id uuid references public.estimates(id) on delete set null,
  number text not null,
  name text not null,
  description text,
  status public.project_status not null default 'planned',
  starts_on date,
  due_on date,
  completed_on date,
  progress smallint not null default 0 check (progress between 0 and 100),
  budget_revenue numeric(14,2) not null default 0,
  budget_materials numeric(14,2) not null default 0,
  budget_labor numeric(14,2) not null default 0,
  address text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  minutes integer not null check (minutes > 0),
  hourly_cost numeric(12,2) not null default 0 check (hourly_cost >= 0),
  description text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.material_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  supplier text,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'gab.',
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  purchased_on date,
  entered_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventory_number text not null,
  name text not null,
  category text,
  status public.tool_status not null default 'available',
  purchase_date date,
  next_service_on date,
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, inventory_number)
);

create table public.tool_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz,
  notes text,
  check (project_id is not null or user_id is not null)
);

create index projects_organization_status_idx on public.projects (organization_id, status);
create index time_entries_project_date_idx on public.time_entries (project_id, work_date);
create index material_costs_project_idx on public.material_costs (project_id);
create index tools_organization_status_idx on public.tools (organization_id, status);

create or replace function public.is_organization_member(requested_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = requested_organization_id
      and user_id = auth.uid()
      and active = true
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.estimates enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.time_entries enable row level security;
alter table public.material_costs enable row level security;
alter table public.tools enable row level security;
alter table public.tool_assignments enable row level security;

create policy "Members can read organizations"
on public.organizations for select
using (public.is_organization_member(id));

create policy "Users can read their own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Members can read organization memberships"
on public.organization_members for select
using (public.is_organization_member(organization_id));

create policy "Members can manage customers"
on public.customers for all
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members can manage estimates"
on public.estimates for all
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members can manage projects"
on public.projects for all
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members can manage project members"
on public.project_members for all
using (
  exists (
    select 1 from public.projects
    where projects.id = project_members.project_id
      and public.is_organization_member(projects.organization_id)
  )
)
with check (
  exists (
    select 1 from public.projects
    where projects.id = project_members.project_id
      and public.is_organization_member(projects.organization_id)
  )
);

create policy "Members can manage time entries"
on public.time_entries for all
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members can manage material costs"
on public.material_costs for all
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members can manage tools"
on public.tools for all
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members can manage tool assignments"
on public.tool_assignments for all
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
