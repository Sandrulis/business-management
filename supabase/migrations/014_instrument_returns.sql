alter table public.instrument_assignments
  add column if not exists kind text not null default 'assigned';

alter table public.instrument_assignments
  drop constraint if exists instrument_assignments_kind_check;

alter table public.instrument_assignments
  add constraint instrument_assignments_kind_check
  check (kind in ('assigned', 'returned'));

notify pgrst, 'reload schema';