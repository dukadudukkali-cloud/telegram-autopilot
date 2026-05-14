-- Add queue/timing columns for safe 1-minute spaced auto posting

alter table public.schedules
  add column if not exists sent_at timestamptz,
  add column if not exists available_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists queue_position integer;

create index if not exists idx_schedules_user_status_scheduled_at
  on public.schedules(user_id, status, scheduled_at);

create index if not exists idx_schedules_user_status_available_at
  on public.schedules(user_id, status, available_at);

