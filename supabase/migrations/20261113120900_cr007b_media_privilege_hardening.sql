-- CR-007B.5: preserve the original eight migrations and close media privilege leakage.
-- Metadata verification and lifecycle writes belong to trusted future server commands.
BEGIN;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.media_assets FROM authenticated;
DROP POLICY admin_write ON public.media_assets;
DROP POLICY admin_read ON public.media_assets;

-- Bypass RLS only to classify a known asset without exposing attachment rows.
-- The caller must itself be an active editor; no arbitrary private-asset lookup.
CREATE FUNCTION public.editor_can_read_media(asset_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT public.has_role(ARRAY['editor']::public.admin_role[])
    AND NOT EXISTS (
      SELECT 1 FROM public.custom_request_images x WHERE x.media_id=asset_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p WHERE p.evidence_media_id=asset_id
    )
    AND (
      EXISTS (SELECT 1 FROM public.product_images i WHERE i.media_id=asset_id)
      OR EXISTS (SELECT 1 FROM public.category_images i WHERE i.media_id=asset_id)
      OR EXISTS (SELECT 1 FROM public.banners b WHERE b.media_id=asset_id)
      OR EXISTS (SELECT 1 FROM public.store_settings s WHERE s.logo_media_id=asset_id)
    );
$$;
REVOKE ALL ON FUNCTION public.editor_can_read_media(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editor_can_read_media(uuid) TO authenticated, service_role;
CREATE POLICY media_read_scoped ON public.media_assets
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY['proprietario']::public.admin_role[])
    OR public.editor_can_read_media(id)
  );
COMMIT;
