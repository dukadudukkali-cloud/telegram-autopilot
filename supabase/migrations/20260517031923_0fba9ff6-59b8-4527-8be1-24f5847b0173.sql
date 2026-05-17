
-- content_drafts
CREATE TABLE public.content_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  telegram_account_id UUID,
  scheduled_at TIMESTAMPTZ,
  repeat_type TEXT NOT NULL DEFAULT 'none',
  source TEXT NOT NULL DEFAULT 'editor',
  template_id UUID,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drafts select own or admin" ON public.content_drafts
  FOR SELECT USING ((auth.uid() = user_id) OR is_admin(auth.uid()));
CREATE POLICY "drafts insert own" ON public.content_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "drafts update own" ON public.content_drafts
  FOR UPDATE USING ((auth.uid() = user_id) OR is_admin(auth.uid()));
CREATE POLICY "drafts delete own" ON public.content_drafts
  FOR DELETE USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

CREATE TRIGGER trg_drafts_updated_at BEFORE UPDATE ON public.content_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_drafts_user_updated ON public.content_drafts (user_id, updated_at DESC);

-- content_templates
CREATE TABLE public.content_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  caption TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates select own or admin" ON public.content_templates
  FOR SELECT USING ((auth.uid() = user_id) OR is_admin(auth.uid()));
CREATE POLICY "templates insert own" ON public.content_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates update own" ON public.content_templates
  FOR UPDATE USING ((auth.uid() = user_id) OR is_admin(auth.uid()));
CREATE POLICY "templates delete own" ON public.content_templates
  FOR DELETE USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON public.content_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_templates_user_updated ON public.content_templates (user_id, updated_at DESC);
