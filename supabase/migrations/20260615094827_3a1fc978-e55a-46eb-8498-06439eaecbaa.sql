-- 1. Persist selected channel list on app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS selected_channel_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- 2. Content Library: date + brand for matching
ALTER TABLE public.content_library
  ADD COLUMN IF NOT EXISTS content_day smallint,
  ADD COLUMN IF NOT EXISTS content_month smallint,
  ADD COLUMN IF NOT EXISTS content_year smallint,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_content_library_match
  ON public.content_library (user_id, lower(title), brand, content_year, content_month, content_day);

-- 3. Caption Templates: date + brand + hashtag for matching
ALTER TABLE public.caption_templates
  ADD COLUMN IF NOT EXISTS content_day smallint,
  ADD COLUMN IF NOT EXISTS content_month smallint,
  ADD COLUMN IF NOT EXISTS content_year smallint,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS hashtag text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_caption_templates_match
  ON public.caption_templates (user_id, lower(template_name), brand, content_year, content_month, content_day);

-- 4. Speed up queue lookups by user + status
CREATE INDEX IF NOT EXISTS idx_auto_posting_queue_user_status
  ON public.auto_posting_queue (user_id, status, scheduled_at);