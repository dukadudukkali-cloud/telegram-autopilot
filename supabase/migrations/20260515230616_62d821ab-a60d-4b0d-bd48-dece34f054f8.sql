
-- 1) Inline buttons table
CREATE TABLE IF NOT EXISTS public.telegram_inline_buttons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_account_id uuid NOT NULL REFERENCES public.telegram_configs(id) ON DELETE CASCADE,
  button_text text NOT NULL,
  button_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tib_account ON public.telegram_inline_buttons(telegram_account_id, sort_order);

ALTER TABLE public.telegram_inline_buttons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tib select own or admin" ON public.telegram_inline_buttons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.telegram_configs tc WHERE tc.id = telegram_inline_buttons.telegram_account_id
            AND (tc.user_id = auth.uid() OR public.is_admin(auth.uid())))
  );

CREATE POLICY "tib insert own" ON public.telegram_inline_buttons
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.telegram_configs tc WHERE tc.id = telegram_inline_buttons.telegram_account_id
            AND (tc.user_id = auth.uid() OR public.is_admin(auth.uid())))
  );

CREATE POLICY "tib update own" ON public.telegram_inline_buttons
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.telegram_configs tc WHERE tc.id = telegram_inline_buttons.telegram_account_id
            AND (tc.user_id = auth.uid() OR public.is_admin(auth.uid())))
  );

CREATE POLICY "tib delete own" ON public.telegram_inline_buttons
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.telegram_configs tc WHERE tc.id = telegram_inline_buttons.telegram_account_id
            AND (tc.user_id = auth.uid() OR public.is_admin(auth.uid())))
  );

CREATE TRIGGER trg_tib_updated_at
  BEFORE UPDATE ON public.telegram_inline_buttons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) posts: error_message + sent_at
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- 3) schedules: retry_count
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
