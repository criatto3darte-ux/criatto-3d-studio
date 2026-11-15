-- =====================================================================
-- CRIATTO 3D — CR-009C PRÉ-APLICAÇÃO
-- Captura o estado ATUAL das policies RLS e grants antes de aplicar a
-- migration 0011 (cr008c_jwt_claims_and_aal). Execute no SQL Editor do
-- Supabase (conecta como postgres / service_role, i.e. bypassa RLS).
-- GUARDE O RESULTADO (Output em "Results" do SQL Editor) — ele serve de
-- referência para o rollback se algo sair errado.
--
-- Esta query é SOMENTE LEITURA — não altera nada no banco.
-- =====================================================================

\echo '=== 0. Confirmar identidade do projeto ==='
SELECT current_database() AS database,
       inet_server_addr() AS server_addr,
       version() AS server_version;

\echo '=== 1. Versões de migration aplicadas (deve conter 0001-0010, NÃO 0011) ==='
SELECT version, name
  FROM supabase_migrations.schema_migrations
 ORDER BY version;

\echo '=== 2. Funções públicas esperadas ANTES da 0011 (deve listar has_role e afins; NÃO deve listar my_roles, custom_access_token_hook, require_aal2) ==='
SELECT p.proname, p.prosecdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('has_role','my_roles','custom_access_token_hook','require_aal2',
                    'check_private_media','check_variant_integrity','editor_can_read_media',
                    'protect_last_owner','safe_public_url','validate_social_links','touch_version');

\echo '=== 3. Role supabase_auth_admin existe e tem acesso ao schema public? ==='
SELECT rolname, rolsuper, rolinherit, rolcreaterole
  FROM pg_roles
 WHERE rolname IN ('supabase_auth_admin','service_role','authenticated','anon');

\echo '=== 4. Backup da DDL das POLICIES que serão reescritas pela migration 0011 ==='
-- Copie TODA a coluna policy_ddl do resultado abaixo e salve em arquivo.
SELECT n.nspname  AS schema,
       c.relname  AS table,
       pol.polname AS policy,
       format('CREATE POLICY %I ON %I.%I FOR %s TO %s %s%s;',
         pol.polname,
         n.nspname, c.relname,
         CASE pol.polcmd
             WHEN 'r' THEN 'SELECT'
             WHEN 'a' THEN 'INSERT'
             WHEN 'w' THEN 'UPDATE'
             WHEN 'd' THEN 'DELETE'
             WHEN '*' THEN 'ALL'
         END,
         CASE WHEN pol.polroles = '{0}'::oid[] THEN 'PUBLIC'
              ELSE (SELECT string_agg(rolname,',') FROM pg_roles WHERE oid = ANY(pol.polroles))
         END,
         CASE WHEN pol.polqual IS NOT NULL
              THEN format('USING (%s)', pg_catalog.pg_get_expr(pol.polqual, pol.polrelid))
              ELSE ''
         END,
         CASE WHEN pol.polwithcheck IS NOT NULL
              THEN format(' WITH CHECK (%s)', pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid))
              ELSE ''
         END
       ) AS policy_ddl
  FROM pg_policy pol
  JOIN pg_class   c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN (
     'admin_profiles','user_roles',
     'categories','products','product_attribute_groups','product_attribute_options',
     'product_variants','variant_option_values',
     'media_assets','product_images','category_images',
     'customers','orders','order_items','order_status_history','payments',
     'inventory','inventory_movements','coupons','banners',
     'custom_requests','custom_request_images','store_settings')
   AND pol.polname IN ('admin_read','admin_write',
                       'coupon_rw','coupon_read_operador','coupon_editor',
                       'banner_rw','banner_editor',
                       'payments_owner','payments_finance','finance_read',
                       'settings_owner','own_profile','own_roles')
 ORDER BY c.relname, pol.polname;

\echo '=== 5. Auth config atual (site_url/uri_allow_list/jwt_exp/disable_signup/hooks) ==='
-- Exige acesso service_role (executado no SQL Editor do dashboard).
SELECT * FROM auth.config LIMIT 1;

\echo '=== 6. FIM DO PRECHECK. Guarde o output acima antes de aplicar a 0011. ==='
