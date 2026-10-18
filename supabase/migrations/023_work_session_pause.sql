alter table public.work_sessions
  add column if not exists paused_at timestamptz,
  add column if not exists pause_seconds integer not null default 0;

alter table public.work_sessions
  drop constraint if exists work_sessions_pause_seconds_nonnegative;

alter table public.work_sessions
  add constraint work_sessions_pause_seconds_nonnegative check (pause_seconds >= 0);

notify pgrst, 'reload schema';
