-- =====================================================================
-- CRIATTO 3D — CR-009C PÓS-APLICAÇÃO (verificação)
-- Executar no SQL Editor DEPOIS de aplicar a migration 0011 e ANTES de
-- ativar o hook no painel.
-- Todas as queries aqui são SOMENTE LEITURA.
-- =====================================================================

\echo '=== 1. Funções criadas pela 0011 existem e têm os grants corretos ==='
SELECT p.proname,
       p.prosecdef AS security_definer,
       n.nspname AS schema,
       has_function_privilege('anon',                 p.oid,'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated',        p.oid,'EXECUTE') AS authn_exec,
       has_function_privilege('service_role',         p.oid,'EXECUTE') AS svc_exec,
       has_function_privilege('supabase_auth_admin',  p.oid,'EXECUTE') AS auth_admin_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public'
   AND p.proname IN ('my_roles','custom_access_token_hook','require_aal2')
 ORDER BY p.proname;

-- Esperado:
--   my_roles:                  secdef=T, anon=F, authn=T, svc=T, auth_admin=F
--   custom_access_token_hook:  secdef=T, anon=F, authn=F, svc=T, auth_admin=T
--   require_aal2:              secdef=F, anon=F, authn=T, svc=T, auth_admin=F

\echo '=== 2. Policies administrativas AGORA exigem require_aal2() ==='
SELECT c.relname AS table_name,
       pol.polname AS policy_name,
       pol.polcmd AS cmd,
       pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) AS qual,
       (pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%require_aal2%') AS qual_mentions_aal2
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('orders','payments','customers','admin_profiles','user_roles','products','coupons','media_assets','store_settings')
 ORDER BY c.relname, pol.polname;

\echo '=== 3. Testes simulados (SET LOCAL ROLE + request.jwt.claims) ==='
-- Obs.: como o hook ainda não foi ativado, o JWT real do GoTrue NÃO terá
-- a claim 'roles' nesta etapa. Estes testes simulam o cenário final
-- SETando a variável de sessão como se o hook tivesse preenchido a claim.

-- Owner AAL1 deve ver 0 orders
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","aal":"aal1","roles":["proprietario"]}';
SELECT current_setting('request.jwt.claims',true)::jsonb->>'aal' AS aal,
       public.require_aal2() AS require_aal2_result;
-- expect: aal=aal1, require_aal2_result=false
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","aal":"aal2","roles":["proprietario"]}';
SELECT public.require_aal2() AS aal2,
       public.has_role(ARRAY['proprietario']::public.admin_role[]) AS has_role;
-- expect: aal2=t, has_role=f (usuário não existe em admin_profiles/user_roles, mas a função roda)
ROLLBACK;

\echo '=== 4. Nenhuma tabela foi apagada (espera 27 tabelas public com RLS+FORCE) ==='
SELECT count(*) AS rls_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname='public'
   AND c.relkind='r'
   AND c.relrowsecurity AND c.relforcerowsecurity;
-- expect: 27

\echo '=== 5. Fim da verificação pós-migration. Prossiga para ativação do hook e testes de JWT real. ==='
