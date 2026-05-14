
ALTER TABLE public.telegram_configs
  ADD COLUMN IF NOT EXISTS bot_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS telegram_account_id uuid REFERENCES public.telegram_configs(id) ON DELETE SET NULL;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS telegram_account_id uuid REFERENCES public.telegram_configs(id) ON DELETE SET NULL;

ALTER TABLE public.posting_logs
  ADD COLUMN IF NOT EXISTS telegram_account_id uuid REFERENCES public.telegram_configs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_account ON public.posts(telegram_account_id);
CREATE INDEX IF NOT EXISTS idx_sched_account ON public.schedules(telegram_account_id);
CREATE INDEX IF NOT EXISTS idx_plogs_account ON public.posting_logs(telegram_account_id);
