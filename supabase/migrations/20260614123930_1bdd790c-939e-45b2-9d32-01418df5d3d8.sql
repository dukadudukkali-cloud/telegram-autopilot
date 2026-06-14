
-- 1) auto_posting_queue
CREATE TABLE IF NOT EXISTS public.auto_posting_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_title text NOT NULL,
  brand text,
  image_id uuid REFERENCES public.content_library(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  caption text NOT NULL,
  caption_source text NOT NULL CHECK (caption_source IN ('ai','database')),
  selected_channel_ids uuid[] NOT NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','success','partial','failed','cancelled')),
  processing_started_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apq_user_status ON public.auto_posting_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_apq_status_sched ON public.auto_posting_queue(status, scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_posting_queue TO authenticated;
GRANT ALL ON public.auto_posting_queue TO service_role;

ALTER TABLE public.auto_posting_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_select_own" ON public.auto_posting_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "queue_insert_own" ON public.auto_posting_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "queue_update_own" ON public.auto_posting_queue FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "queue_delete_own" ON public.auto_posting_queue FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_apq_updated_at BEFORE UPDATE ON public.auto_posting_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) auto_posting_logs adjustments
ALTER TABLE public.auto_posting_logs ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE public.auto_posting_logs ADD COLUMN IF NOT EXISTS queue_id uuid REFERENCES public.auto_posting_queue(id) ON DELETE CASCADE;
ALTER TABLE public.auto_posting_logs ADD COLUMN IF NOT EXISTS channel_name text;
ALTER TABLE public.auto_posting_logs ADD COLUMN IF NOT EXISTS telegram_chat_id text;
ALTER TABLE public.auto_posting_logs ADD CONSTRAINT auto_posting_logs_job_or_queue CHECK (job_id IS NOT NULL OR queue_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apl_queue_channel ON public.auto_posting_logs(queue_id, channel_id) WHERE queue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apl_queue ON public.auto_posting_logs(queue_id);
