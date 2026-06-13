
-- 1) Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2) Revoke EXECUTE on SECURITY DEFINER trigger/helper functions from client roles.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_post_soft_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 3) Keep has_role / is_admin executable by authenticated (RLS policies depend on them),
--    but revoke from anon and PUBLIC.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- 4) Storage: drop the broad SELECT policies that allow listing.
--    Buckets stay public so files remain reachable by their direct CDN URL
--    (Telegram fetches images by URL), but anonymous LIST queries are blocked.
DROP POLICY IF EXISTS "post-images public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read telegram-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read content-library" ON storage.objects;

-- 5) Tighten post-images INSERT to the user's own folder
DROP POLICY IF EXISTS "post-images auth upload" ON storage.objects;
CREATE POLICY "post-images owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-images'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
