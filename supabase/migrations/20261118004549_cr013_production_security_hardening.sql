BEGIN;

-- CR-013: normalize every public projection to the minimum privileges it needs.
-- These views intentionally remain owner-executed security-barrier views. The
-- underlying tables have no anonymous grants and public_availability hides the
-- exact inventory balance; changing the views to security_invoker would either
-- break the storefront or require exposing those base tables.

REVOKE ALL ON TABLE
  public.public_categories,
  public.public_products,
  public.public_attribute_groups,
  public.public_attribute_options,
  public.public_variants,
  public.public_variant_options,
  public.public_product_images,
  public.public_category_images,
  public.public_banners,
  public.public_store_settings,
  public.public_availability,
  public.public_catalog_images,
  public.public_site_banners
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE
  public.public_categories,
  public.public_products,
  public.public_attribute_groups,
  public.public_attribute_options,
  public.public_variants,
  public.public_variant_options,
  public.public_product_images,
  public.public_category_images,
  public.public_banners,
  public.public_store_settings,
  public.public_availability,
  public.public_catalog_images,
  public.public_site_banners
TO anon, authenticated, service_role;

REVOKE ALL ON TABLE public.finance_order_summary
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.finance_order_summary
TO authenticated, service_role;

DO $validation$
DECLARE
  public_views constant text[] := ARRAY[
    'public_categories', 'public_products', 'public_attribute_groups',
    'public_attribute_options', 'public_variants', 'public_variant_options',
    'public_product_images', 'public_category_images', 'public_banners',
    'public_store_settings', 'public_availability', 'public_catalog_images',
    'public_site_banners'
  ];
  view_name text;
  role_name text;
BEGIN
  FOREACH view_name IN ARRAY public_views LOOP
    IF to_regclass(format('public.%I', view_name)) IS NULL THEN
      RAISE EXCEPTION 'CR-013 validation failed: missing view public.%', view_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = view_name
         AND c.relkind = 'v'
         AND c.reloptions @> ARRAY['security_barrier=true']
    ) THEN
      RAISE EXCEPTION 'CR-013 validation failed: public.% is not a security-barrier view', view_name;
    END IF;

    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF NOT has_table_privilege(role_name, format('public.%I', view_name), 'SELECT') THEN
        RAISE EXCEPTION 'CR-013 validation failed: % lacks SELECT on public.%', role_name, view_name;
      END IF;
      IF EXISTS (
        SELECT 1
          FROM information_schema.role_table_grants
         WHERE table_schema = 'public'
           AND table_name = view_name
           AND grantee = role_name
           AND privilege_type <> 'SELECT'
      ) THEN
        RAISE EXCEPTION 'CR-013 validation failed: % has excessive privilege on public.%', role_name, view_name;
      END IF;
    END LOOP;
  END LOOP;

  IF has_table_privilege('anon', 'public.finance_order_summary', 'SELECT') THEN
    RAISE EXCEPTION 'CR-013 validation failed: anon can read finance_order_summary';
  END IF;

  FOREACH role_name IN ARRAY ARRAY['authenticated', 'service_role'] LOOP
    IF NOT has_table_privilege(role_name, 'public.finance_order_summary', 'SELECT') THEN
      RAISE EXCEPTION 'CR-013 validation failed: % lacks SELECT on finance_order_summary', role_name;
    END IF;
    IF EXISTS (
      SELECT 1
        FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND table_name = 'finance_order_summary'
         AND grantee = role_name
         AND privilege_type <> 'SELECT'
    ) THEN
      RAISE EXCEPTION 'CR-013 validation failed: % has excessive privilege on finance_order_summary', role_name;
    END IF;
  END LOOP;
END
$validation$;

COMMIT;
