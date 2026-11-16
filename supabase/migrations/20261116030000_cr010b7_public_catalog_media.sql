-- CR-010B.7: public image projection for published catalog media only.
-- PREPARED, NOT APPLIED. Requires explicit authorization and a catalog-images bucket.
BEGIN;

CREATE VIEW public.public_catalog_images WITH (security_barrier=true) AS
SELECT pi.product_id, pi.media_id, pi.position, pi.is_primary,
       ma.object_key, ma.alt, ma.width, ma.height
FROM public.product_images pi
JOIN public.public_products pp ON pp.id = pi.product_id
JOIN public.media_assets ma ON ma.id = pi.media_id
WHERE ma.bucket = 'catalog-images' AND ma.state = 'published';

REVOKE ALL ON public.public_catalog_images FROM PUBLIC;
GRANT SELECT ON public.public_catalog_images TO anon, authenticated;


-- The media service uses this transaction to switch the primary image without
-- violating the existing unique partial index or leaving multiple primaries.
CREATE FUNCTION public.set_catalog_primary_media(p_product_id uuid, p_media_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.product_images
    WHERE product_id = p_product_id AND media_id = p_media_id
  ) THEN
    RAISE EXCEPTION 'image does not belong to product' USING ERRCODE='23503';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_product_id::text, 7217));
  UPDATE public.product_images SET is_primary = false
    WHERE product_id = p_product_id AND is_primary;
  UPDATE public.product_images SET is_primary = true
    WHERE product_id = p_product_id AND media_id = p_media_id;
END;
$body$;
REVOKE ALL ON FUNCTION public.set_catalog_primary_media(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_catalog_primary_media(uuid,uuid) TO service_role;

COMMIT;
