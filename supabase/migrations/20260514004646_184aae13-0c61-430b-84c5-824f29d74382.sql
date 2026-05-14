-- Add new columns (safe if re-run)
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS available_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_position integer NOT NULL DEFAULT 0;

-- Ensure scheduled_at is timestamptz (no-op if already)
ALTER TABLE public.schedules
  ALTER COLUMN scheduled_at TYPE timestamptz USING scheduled_at AT TIME ZONE 'UTC';

-- Normalize legacy uppercase / alias status values to lowercase canonical set
UPDATE public.schedules
SET status = CASE lower(status)
  WHEN 'success' THEN 'sent'
  WHEN 'done' THEN 'sent'
  WHEN 'complete' THEN 'sent'
  WHEN 'completed' THEN 'sent'
  WHEN 'error' THEN 'failed'
  ELSE lower(status)
END
WHERE status IS NOT NULL
  AND (status <> lower(status) OR lower(status) IN ('success','done','complete','completed','error'));

-- Backfill available_at for pending rows so queue picks them up correctly
UPDATE public.schedules
SET available_at = scheduled_at
WHERE available_at IS NULL AND scheduled_at IS NOT NULL;

-- Helpful indexes for the queue worker
CREATE INDEX IF NOT EXISTS idx_schedules_status_available
  ON public.schedules (status, available_at);
CREATE INDEX IF NOT EXISTS idx_schedules_queue_position
  ON public.schedules (queue_position);