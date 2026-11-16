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

COMMIT;
