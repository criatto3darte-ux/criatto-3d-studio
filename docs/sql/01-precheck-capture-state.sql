-- CRIATTO 3D — CR-009C.1 PRECHECK E SNAPSHOT TRANSACIONAL
-- Execute antes da migration 0011. O snapshot persistente no schema private
-- permite rollback automático em outra sessão.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$ BEGIN
  IF to_regclass('private.cr009c1_snapshot_meta') IS NOT NULL THEN
    RAISE EXCEPTION 'CR-009C.1 snapshot already exists; preserve it until activation is accepted';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.cr009c1_snapshot_meta (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  migration_version text NOT NULL,
  database_name name NOT NULL,
  server_version text NOT NULL
);
CREATE TABLE private.cr009c1_policy_snapshot (
  schema_name name NOT NULL, table_name name NOT NULL, policy_name name NOT NULL,
  permissive boolean NOT NULL, role_names name[] NOT NULL, command "char" NOT NULL,
  using_expression text, check_expression text,
  PRIMARY KEY (schema_name, table_name, policy_name)
);
CREATE TABLE private.cr009c1_table_grant_snapshot (
  schema_name name NOT NULL, table_name name NOT NULL, grantee name NOT NULL,
  privilege_type text NOT NULL, is_grantable boolean NOT NULL,
  PRIMARY KEY (schema_name, table_name, grantee, privilege_type)
);
CREATE TABLE private.cr009c1_function_snapshot (
  schema_name name NOT NULL, function_name name NOT NULL,
  identity_arguments text NOT NULL, existed boolean NOT NULL,
  owner_name name, definition text,
  PRIMARY KEY (schema_name, function_name, identity_arguments)
);
CREATE TABLE private.cr009c1_function_grant_snapshot (
  schema_name name NOT NULL, function_name name NOT NULL,
  identity_arguments text NOT NULL, grantee name NOT NULL,
  privilege_type text NOT NULL, is_grantable boolean NOT NULL,
  PRIMARY KEY (schema_name, function_name, identity_arguments, grantee, privilege_type)
);
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;

INSERT INTO private.cr009c1_snapshot_meta
  (migration_version, database_name, server_version)
VALUES ('20261114133000', current_database(), version());

WITH target_tables(table_name) AS (VALUES
 ('admin_profiles'),('user_roles'),('categories'),('products'),
 ('product_attribute_groups'),('product_attribute_options'),('product_variants'),
 ('variant_option_values'),('media_assets'),('product_images'),('category_images'),
 ('customers'),('orders'),('order_items'),('order_status_history'),('payments'),
 ('inventory'),('inventory_movements'),('coupons'),('banners'),('custom_requests'),
 ('custom_request_images'),('store_settings')
), target_policies(policy_name) AS (VALUES
 ('admin_read'),('admin_write'),('coupon_rw'),('coupon_read_operador'),
 ('coupon_editor'),('banner_rw'),('banner_editor'),('payments_owner'),
 ('payments_finance'),('finance_read'),('settings_owner'),('own_profile'),('own_roles')
)
INSERT INTO private.cr009c1_policy_snapshot
SELECT n.nspname, c.relname, p.polname, p.polpermissive,
       CASE WHEN p.polroles=ARRAY[0::oid] THEN ARRAY['PUBLIC']::name[]
            ELSE ARRAY(SELECT rolname::name FROM pg_roles
                       WHERE oid=ANY(p.polroles) ORDER BY rolname) END,
       p.polcmd, pg_get_expr(p.polqual,p.polrelid),
       pg_get_expr(p.polwithcheck,p.polrelid)
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN target_tables tt ON tt.table_name=c.relname
  JOIN target_policies tp ON tp.policy_name=p.polname
 WHERE n.nspname='public';

WITH target_tables(table_name) AS (VALUES
 ('admin_profiles'),('user_roles'),('categories'),('products'),
 ('product_attribute_groups'),('product_attribute_options'),('product_variants'),
 ('variant_option_values'),('media_assets'),('product_images'),('category_images'),
 ('customers'),('orders'),('order_items'),('order_status_history'),('payments'),
 ('inventory'),('inventory_movements'),('coupons'),('banners'),('custom_requests'),
 ('custom_request_images'),('store_settings')
)
INSERT INTO private.cr009c1_table_grant_snapshot
SELECT n.nspname,c.relname,'authenticated'::name,x.privilege_type,x.is_grantable
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN target_tables tt ON tt.table_name=c.relname
 CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) x
 WHERE n.nspname='public'
   AND x.grantee=(SELECT oid FROM pg_roles WHERE rolname='authenticated');

INSERT INTO private.cr009c1_function_snapshot
SELECT w.schema_name,w.function_name,w.identity_arguments,p.oid IS NOT NULL,
       CASE WHEN p.oid IS NULL THEN NULL ELSE pg_get_userbyid(p.proowner)::name END,
       CASE WHEN p.oid IS NULL THEN NULL ELSE pg_get_functiondef(p.oid) END
  FROM (VALUES ('public'::name,'my_roles'::name,''::text),
               ('public'::name,'custom_access_token_hook'::name,'event jsonb'::text),
               ('public'::name,'require_aal2'::name,''::text))
       w(schema_name,function_name,identity_arguments)
  LEFT JOIN pg_namespace n ON n.nspname=w.schema_name
  LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=w.function_name
                     AND pg_get_function_identity_arguments(p.oid)=w.identity_arguments;

INSERT INTO private.cr009c1_function_grant_snapshot
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
       CASE WHEN x.grantee=0 THEN 'PUBLIC'::name ELSE r.rolname::name END,
       x.privilege_type,x.is_grantable
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) x
  LEFT JOIN pg_roles r ON r.oid=x.grantee
 WHERE n.nspname='public'
   AND (p.proname,pg_get_function_identity_arguments(p.oid)) IN
       (('my_roles',''),('custom_access_token_hook','event jsonb'),('require_aal2',''))
   AND (x.grantee=0 OR r.rolname IN
       ('anon','authenticated','service_role','supabase_auth_admin'));

DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM private.cr009c1_policy_snapshot;
  IF n=0 THEN RAISE EXCEPTION 'No target policies captured'; END IF;
END $$;
COMMIT;

SELECT 'snapshot_ready' status,captured_at,migration_version
  FROM private.cr009c1_snapshot_meta;
SELECT count(*) captured_policies FROM private.cr009c1_policy_snapshot;
