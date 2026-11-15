-- =====================================================================
-- CRIATTO 3D — ROLLBACK da migration 0011 (cr008c_jwt_claims_and_aal).
--
-- Use SOMENTE se a aplicação da migration causar problemas (ex. nenhum
-- login funciona, erro 500 em todas as queries, etc.).
--
-- PASSOS:
--   1. DESATIVE o Custom Access Token Hook no painel (Auth → Hooks →
--      Custom Access Token → Disable) ANTES de rodar este script, para
--      que o GoTrue não tente chamar uma função que será removida.
--   2. Execute este script no SQL Editor do Supabase (service_role).
--   3. Reaplique as políticas administrativas originais (capturadas no
--      01-precheck-capture-state.sql) colando cada CREATE POLICY do output
--      da etapa 4 do precheck.
--
-- Este script:
--   - Remove as 3 funções criadas pela 0011 (my_roles,
--     custom_access_token_hook, require_aal2).
--   - Remove o grant extra de escrita em tabelas administrativas dado
--     pela migration (os grants para SELECT já existiam antes e são
--     mantidos; removemos apenas INSERT/UPDATE/DELETE adicionados).
--   - DROPa todas as policies reescritas pela 0011 para que você possa
--     recriar as originais a partir do snapshot capturado no precheck.
-- =====================================================================

-- 0. Garantir que o hook já foi desativado no painel antes.
-- Se você não desativou, PARE agora.

BEGIN;

-- 1. Dropar as funções da 0011.
DROP FUNCTION IF EXISTS public.my_roles();
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);
DROP FUNCTION IF EXISTS public.require_aal2();

-- 2. Revoga os grants INSERT/UPDATE/DELETE extra dados pela 0011 a authenticated.
-- (SELECT para tabelas de leitura admin como admin_profiles/user_roles/payments/
-- order_items/order_status_history/inventory_movements já existia antes;
-- não tocamos neles para não quebrar a matriz de permissões anterior.)
REVOKE INSERT, UPDATE, DELETE ON public.banners                 FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.coupons                 FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.categories              FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products                FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_attribute_groups FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_attribute_options FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_variants        FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.variant_option_values   FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.media_assets            FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_images          FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.category_images         FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.customers               FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orders                  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory               FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.store_settings          FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.custom_requests         FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.custom_request_images   FROM authenticated;

-- 3. Apaga as policies que foram reescritas pela 0011 (elas contêm
--    require_aal2() em USING / WITH CHECK). Depois você vai recriar as
--    políticas originais colando o DDL capturado no precheck.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pol.polname AS policy, c.relname AS tbl
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
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
       AND (pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%require_aal2%'
            OR pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%require_aal2%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policy, r.tbl);
    RAISE NOTICE 'Dropped policy %.%', r.tbl, r.policy;
  END LOOP;
END $$;

-- 4. Neste ponto o banco está com as policies REMOVIDAS para as tabelas
--    administrativas — nenhum usuário autenticado consegue ler ou escrever
--    nelas, o que é um modo seguro (fail-closed).
--    AGORA cole o DDL das policies originais capturadas no passo 4 do
--    precheck (cada CREATE POLICY ...; do output). Depois COMMIT.

COMMIT;

-- 5. Verificação final: após recriar as policies originais, confira:
SELECT c.relname AS table_name, pol.polname AS policy_name,
       pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) AS qual
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname='public'
   AND pol.polname IN ('admin_read','payments_owner','payments_finance','coupon_rw','banner_rw')
 ORDER BY c.relname, pol.polname;
-- Esperado: as policies listadas NÃO devem conter 'require_aal2' no qual.

-- 6. Teste rápido: um usuário autenticado com role proprietário consegue
-- SELECT em admin_profiles (como antes da 0011), mesmo com JWT aal1
-- (comportamento anterior à CR-008C).
