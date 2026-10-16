alter table public.instruments alter column number drop not null;
alter table public.instruments alter column brand drop not null;
alter table public.instruments alter column model drop not null;
alter table public.instruments alter column serial_number drop not null;
alter table public.instruments alter column purchased_on drop not null;
alter table public.instruments alter column price drop not null;
alter table public.instruments alter column note drop not null;

alter table public.instruments drop constraint if exists instruments_number_key;

create unique index if not exists instruments_number_unique_idx
  on public.instruments (number)
  where number is not null;

notify pgrst, 'reload schema';