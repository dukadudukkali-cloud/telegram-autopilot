
-- 0) Add optional channel link to existing content_library
ALTER TABLE public.content_library
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.telegram_configs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_content_library_channel ON public.content_library(channel_id);

-- 1) auto_posting_jobs
CREATE TABLE IF NOT EXISTS public.auto_posting_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.telegram_configs(id) ON DELETE CASCADE,
  channel_name text,
  mode_posting text NOT NULL DEFAULT 'auto_db',
    -- manual_queue | auto_db | auto_caption_ai | full_ai
  image_source text NOT NULL DEFAULT 'library',
    -- library | channel_content | ai_generate
  caption_source text NOT NULL DEFAULT 'template',
    -- template | random_template | ai_rewrite | ai_generate
  total_posts integer NOT NULL DEFAULT 1,
  interval_seconds integer NOT NULL DEFAULT 60,
  button_account_id uuid REFERENCES public.telegram_configs(id) ON DELETE SET NULL,
  ai_theme text,
  ai_keywords text,
  status text NOT NULL DEFAULT 'idle',
    -- idle | running | paused | stopped | error | completed
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  next_run_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  stopped_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_posting_jobs TO authenticated;
GRANT ALL ON public.auto_posting_jobs TO service_role;

ALTER TABLE public.auto_posting_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_posting_jobs owner read"  ON public.auto_posting_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auto_posting_jobs owner write" ON public.auto_posting_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auto_posting_jobs owner update" ON public.auto_posting_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auto_posting_jobs owner delete" ON public.auto_posting_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_apj_user ON public.auto_posting_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_apj_status_next ON public.auto_posting_jobs(status, next_run_at);

CREATE TRIGGER trg_apj_updated BEFORE UPDATE ON public.auto_posting_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) auto_posting_logs
CREATE TABLE IF NOT EXISTS public.auto_posting_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.auto_posting_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.telegram_configs(id) ON DELETE SET NULL,
  post_id uuid,
  image_url text,
  caption_text text,
  telegram_message_id bigint,
  status text NOT NULL,  -- sent | failed
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.auto_posting_logs TO authenticated;
GRANT ALL ON public.auto_posting_logs TO service_role;

ALTER TABLE public.auto_posting_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_posting_logs owner read"  ON public.auto_posting_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auto_posting_logs owner insert" ON public.auto_posting_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_apl_job ON public.auto_posting_logs(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apl_user ON public.auto_posting_logs(user_id, created_at DESC);

-- 3) caption_templates (channel-scoped)
CREATE TABLE IF NOT EXISTS public.caption_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.telegram_configs(id) ON DELETE SET NULL,
  channel_name text,
  template_name text NOT NULL,
  caption_text text NOT NULL,
  status text NOT NULL DEFAULT 'active',  -- active | inactive
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caption_templates TO authenticated;
GRANT ALL ON public.caption_templates TO service_role;

ALTER TABLE public.caption_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caption_templates owner read"   ON public.caption_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "caption_templates owner insert" ON public.caption_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "caption_templates owner update" ON public.caption_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "caption_templates owner delete" ON public.caption_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_capt_user_channel ON public.caption_templates(user_id, channel_id);

CREATE TRIGGER trg_capt_updated BEFORE UPDATE ON public.caption_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
