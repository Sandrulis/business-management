alter table public.price_entries
  add column if not exists document text not null default '';

notify pgrst, 'reload schema';
