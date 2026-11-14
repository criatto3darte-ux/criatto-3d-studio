-- CR-008C: JWT claims e enforcement de AAL2 para o painel administrativo.
--
-- Correções da CR-007E.5:
--   1. O bootstrap insere a role em public.user_roles (NÃO em app_metadata).
--      O access_token JWT precisa carregar as roles do usuário para que o
--      client possa sincronizar UI/redirects, e para que as policies RLS
--      baseadas em auth.jwt() possam ser aplicadas de forma performática
--      (embora public.has_role() já faça isso com tabela, a claim evita
--      consulta extra em cada request em hot paths).
--   2. Sessões aal1 (após login com senha) NÃO podem acessar as tabelas
--      administrativas — forçamos erro de permissão até que MFA seja
--      verificado.
--
-- Esta migration é idempotente e segura para rodar a qualquer momento.
-- Depois de aplicada, convém um "refresh session" para que os tokens
-- existentes recebam as claims novas (um novo login é suficiente).

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. RPC para o client saber o papel efetivo do usuário.
--    Retorna text[] (roles do usuário autenticado) ou NULL se não houver
--    perfil ativo. Só precisa de SELECT (o RLS já protege a tabela).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    array_agg(r.role ORDER BY r.role) FILTER (WHERE p.active),
    ARRAY[]::text[]
  )
  FROM public.admin_profiles p
  JOIN public.user_roles r ON r.user_id = p.user_id
 WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Hook custom.access_token que injeta "roles" e "email_verified" no JWT.
--    Compatível com Supabase Auth Hook "Custom Access Token" (tipo "access_token").
--    Definir no Dashboard: Auth > Hooks > Custom Access Token → apontar para
--    a função public.custom_access_token_hook (tipo: auth hook) depois de aplicar
--    esta migration.
-- -----------------------------------------------------------------------------
-- Nota de implementação: o hook é em plpgsql e recebe o JSON do token via
-- current_setting('request.jwt.claims', true), ou (mais comum) como argumento
-- do hook quando o tipo é "pg". Em Supabase usamos a variável de sessão
-- 'request.jwt.claims' definida pelo GoTrue ao emitir o token.
--
-- Provisionamos a função; a ativação do hook é configurada no painel (não há
-- ALTER SYSTEM ou update automático).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  claims jsonb;
  uid uuid;
  roles text[];
  aal_lvl text;
BEGIN
  claims := COALESCE(event->'claims', '{}'::jsonb);
  uid := (claims->>'sub')::uuid;

  -- Roles efetivas. Se for proprietário/editor/operador/financeiro, listamos
  -- todas as roles ativas. Se não houver, retornamos array vazio.
  SELECT COALESCE(array_agg(r.role) FILTER (WHERE p.active), ARRAY[]::text[])
    INTO roles
    FROM public.admin_profiles p
    LEFT JOIN public.user_roles r ON r.user_id = p.user_id
   WHERE p.user_id = uid;

  -- AAL é decidido pelo GoTrue e colocado em claims.aal; preservamos.
  aal_lvl := claims->>'aal';

  -- Injetamos a claim "roles" (padrão Supabase) e garantimos "aal" presente.
  claims := claims
    || jsonb_build_object(
         'roles', to_jsonb(roles),
         'email_verified', COALESCE(claims->>'email_verified', claims->>'email_confirmed_at' IS NOT NULL)
       );

  IF aal_lvl IS NOT NULL THEN
    claims := claims || jsonb_build_object('aal', aal_lvl);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
-- O GoTrue invoca esta função com service_role; apenas service_role pode chamar.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO service_role, supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- 3. Helper RLS que exige AAL2 (MFA verificado) para qualquer acesso.
--    Usado em POLICYs nas tabelas administrativas quando não forem públicas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_aal2()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'aal', 'aal1') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.require_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_aal2() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Atualizar as POLICYs administrativas existentes para também exigir aal2.
--    Reescrevemos apenas as policies SELECT/admin; a checagem de role já está
--    em public.has_role() que consulta user_roles.
-- -----------------------------------------------------------------------------

-- Helper: aplica uma regra "AND public.require_aal2()" em todas as policies
-- admin_read/admin_write existentes, de forma idempotente.
--
-- Para manter o código pequeno e previsível, recriamos explicitamente as
-- policies das tabelas administrativas centrais, adicionando a exigência
-- de aal2. As policies das tabelas públicas (products/categories/etc)
-- possuem também uma policy "public_read" separada que não é afetada.

DO $$
DECLARE
  r record;
BEGIN
  -- Tabelas administrativas que devem exigir MFA (AAL2):
  --   admin_profiles, user_roles, categories, products, product_attribute_*,
  --   product_variants, variant_option_values, media_assets, product_images,
  --   category_images, customers, orders, order_items, order_status_history,
  --   payments, inventory, inventory_movements, coupons, banners,
  --   custom_requests, custom_request_images, store_settings.
  --
  -- As policies públicas (public_read) NÃO devem exigir aal2 — elas são
  -- para o catálogo aberto. Abaixo iteramos e DROP/RECREATE apenas as
  -- policies admin_*, coupon_*, banner_*, payments_*, finance_*.
  FOR r IN
    SELECT n.nspname AS schema, c.relname AS table, pol.polname AS policy,
           pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
           pol.polcmd AS cmd
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
         'custom_requests','custom_request_images','store_settings'
       )
       AND pol.polname IN ('admin_read','admin_write','coupon_rw','coupon_read_operador',
                           'banner_rw','payments_owner','payments_finance')
  LOOP
    -- Recreia cada policy adicionando AND public.require_aal2()
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policy, r.table);
    CASE r.cmd
      WHEN 'r' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((%s) AND public.require_aal2());',
          r.policy, r.table, r.qual);
      WHEN 'a' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((%s) AND public.require_aal2());',
          r.policy, r.table, r.with_check);
      WHEN 'w' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((%s) AND public.require_aal2()) WITH CHECK ((%s) AND public.require_aal2());',
          r.policy, r.table, r.qual, r.with_check);
      WHEN 'd' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((%s) AND public.require_aal2());',
          r.policy, r.table, r.qual);
      WHEN '*' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((%s) AND public.require_aal2()) WITH CHECK ((%s) AND public.require_aal2());',
          r.policy, r.table,
          COALESCE(r.qual, 'true'),
          COALESCE(r.with_check, 'true'));
    END CASE;
  END LOOP;
END $$;

-- Re-aplica grants (INSERT/UPDATE/DELETE) necessários.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attribute_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attribute_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variant_option_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_request_images TO authenticated;
-- admin_profiles / user_roles: SELECT já concedido via policies, sem INSERT/UPDATE/DELETE
-- por usuário comum (somente service_role/bootstrap); read é suficiente para auto-identidade.
GRANT SELECT ON public.admin_profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;

COMMIT;
