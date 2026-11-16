-- CR-010B.10 — Public editorial banner projection.
-- Code prepared for PG17 CI; do not apply remotely until validated.
BEGIN;

CREATE VIEW public.public_site_banners
WITH (security_barrier = true) AS
SELECT b.id, b.title, b.highlight, b.subtitle, b.button_text,
       b.button_url, b.display_order,
       CASE WHEN ma.bucket = 'catalog-images'
                  AND ma.state = 'published'
                  AND ma.object_key LIKE 'banners/%'
            THEN ma.object_key
            ELSE NULL
       END AS image_key,
       CASE WHEN ma.bucket = 'catalog-images'
                  AND ma.state = 'published'
            THEN ma.alt ELSE NULL
       END AS image_alt
FROM public.banners AS b
LEFT JOIN public.media_assets AS ma ON ma.id = b.media_id
WHERE b.active = true;

REVOKE ALL ON public.public_site_banners FROM PUBLIC;
GRANT SELECT ON public.public_site_banners TO anon, authenticated;

COMMIT;
