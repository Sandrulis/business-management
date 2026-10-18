alter table public.company_settings
  add column if not exists offer_hourly_rate text not null default '',
  add column if not exists offer_valid_days text not null default '',
  add column if not exists offer_note text not null default '';

notify pgrst, 'reload schema';
