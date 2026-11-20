-- CR-018: o banner escolhe como o destaque da página inicial aparece:
-- 'texto' (título/destaque/subtítulo, como antes) ou 'logo' (logotipo grande
-- da loja no lugar do texto). Coluna nova com default: registros existentes
-- continuam exibindo o texto.
BEGIN;

ALTER TABLE public.banners
  ADD COLUMN hero_style text NOT NULL DEFAULT 'texto'
  CONSTRAINT banners_hero_style_check CHECK (hero_style IN ('texto', 'logo'));

-- Mesma projeção de CR-010B.10, com hero_style ao final (CREATE OR REPLACE
-- mantém os GRANTs; security_barrier repetido porque o WITH substitui opções).
CREATE OR REPLACE VIEW public.public_site_banners
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
       END AS image_alt,
       b.hero_style
FROM public.banners AS b
LEFT JOIN public.media_assets AS ma ON ma.id = b.media_id
WHERE b.active = true;

DO $validation$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'public_site_banners'
       AND c.reloptions @> ARRAY['security_barrier=true']
  ) THEN
    RAISE EXCEPTION 'CR-018 validation failed: public_site_banners lost security_barrier';
  END IF;
  IF has_table_privilege('anon', 'public.public_site_banners', 'INSERT')
     OR has_table_privilege('anon', 'public.public_site_banners', 'UPDATE')
     OR has_table_privilege('anon', 'public.public_site_banners', 'DELETE')
     OR NOT has_table_privilege('anon', 'public.public_site_banners', 'SELECT') THEN
    RAISE EXCEPTION 'CR-018 validation failed: public_site_banners privileges changed';
  END IF;
END
$validation$;

COMMIT;
