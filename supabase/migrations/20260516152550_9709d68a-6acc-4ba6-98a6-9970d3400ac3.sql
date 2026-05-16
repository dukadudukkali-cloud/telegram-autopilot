
-- Phase 1: multi-media + content library

-- 1) Add media column on posts (jsonb array)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'telegram';

-- 2) content_library table
CREATE TABLE IF NOT EXISTS public.content_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'image', -- image | video | caption | template
  title text NOT NULL DEFAULT '',
  caption text,
  media_url text,
  thumb_url text,
  file_size bigint,
  mime_type text,
  tags text[] NOT NULL DEFAULT '{}',
  category text,
  brand text,
  is_favorite boolean NOT NULL DEFAULT false,
  used_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  platform text NOT NULL DEFAULT 'telegram',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library select own or admin"
  ON public.content_library FOR SELECT
  USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

CREATE POLICY "library insert own"
  ON public.content_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library update own"
  ON public.content_library FOR UPDATE
  USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

CREATE POLICY "library delete own"
  ON public.content_library FOR DELETE
  USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

CREATE TRIGGER content_library_updated_at
  BEFORE UPDATE ON public.content_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_content_library_user ON public.content_library(user_id);
CREATE INDEX IF NOT EXISTS idx_content_library_type ON public.content_library(type);
CREATE INDEX IF NOT EXISTS idx_content_library_fav ON public.content_library(user_id, is_favorite);

-- 3) Storage bucket: telegram-media (reuse post-images is fine but make a dedicated one too)
INSERT INTO storage.buckets (id, name, public)
VALUES ('telegram-media', 'telegram-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-library', 'content-library', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path scoped by user id as first folder segment)
CREATE POLICY "tg-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'telegram-media');

CREATE POLICY "tg-media user write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'telegram-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tg-media user update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'telegram-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tg-media user delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'telegram-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "lib public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-library');

CREATE POLICY "lib user write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'content-library' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "lib user update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'content-library' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "lib user delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'content-library' AND auth.uid()::text = (storage.foldername(name))[1]);
