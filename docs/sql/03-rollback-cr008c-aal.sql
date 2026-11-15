-- CRIATTO 3D — CR-009C.1 ROLLBACK ATÔMICO DA MIGRATION 0011
-- Pré-condição: snapshot criado por 01-precheck-capture-state.sql.
-- Desative o Custom Access Token Hook antes de executar.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $$ BEGIN
  IF to_regclass('private.cr009c1_snapshot_meta') IS NULL
     OR to_regclass('private.cr009c1_policy_snapshot') IS NULL
     OR to_regclass('private.cr009c1_table_grant_snapshot') IS NULL
     OR to_regclass('private.cr009c1_function_snapshot') IS NULL
     OR to_regclass('private.cr009c1_function_grant_snapshot') IS NULL THEN
    RAISE EXCEPTION 'CR-009C.1 snapshot incomplete; rollback aborted';
  END IF;
  IF (SELECT count(*) FROM private.cr009c1_snapshot_meta
       WHERE migration_version='20261114133000')<>1
     OR NOT EXISTS (SELECT 1 FROM private.cr009c1_policy_snapshot) THEN
    RAISE EXCEPTION 'CR-009C.1 snapshot invalid; rollback aborted';
  END IF;
END $$;

-- Policies dependem de require_aal2(), então são removidas primeiro.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM private.cr009c1_policy_snapshot
            ORDER BY schema_name,table_name,policy_name LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policy_name,r.schema_name,r.table_name);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.my_roles();
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);
DROP FUNCTION IF EXISTS public.require_aal2();

-- Se alguma função existia antes da 0011, sua definição e owner são restaurados.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM private.cr009c1_function_snapshot WHERE existed LOOP
    EXECUTE r.definition;
    EXECUTE format('ALTER FUNCTION %I.%I(%s) OWNER TO %I',
                   r.schema_name,r.function_name,r.identity_arguments,r.owner_name);
  END LOOP;
END $$;

-- Policies voltam com modo, comando, roles, USING e WITH CHECK originais.
DO $$
DECLARE r record; cmd text; roles_sql text; ddl text;
BEGIN
  FOR r IN SELECT * FROM private.cr009c1_policy_snapshot
            ORDER BY schema_name,table_name,policy_name LOOP
    cmd:=CASE r.command WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
         WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END;
    IF cmd IS NULL THEN RAISE EXCEPTION 'Unsupported policy command %',r.command; END IF;
    SELECT string_agg(CASE WHEN role_name='PUBLIC' THEN 'PUBLIC'
                           ELSE quote_ident(role_name) END,', ' ORDER BY role_name)
      INTO roles_sql FROM unnest(r.role_names) role_name;
    ddl:=format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policy_name,r.schema_name,r.table_name,
      CASE WHEN r.permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd,roles_sql);
    IF r.using_expression IS NOT NULL
      THEN ddl:=ddl||format(' USING (%s)',r.using_expression); END IF;
    IF r.check_expression IS NOT NULL
      THEN ddl:=ddl||format(' WITH CHECK (%s)',r.check_expression); END IF;
    EXECUTE ddl;
  END LOOP;
END $$;

-- A migration 0011 altera apenas ACLs de authenticated nas tabelas alvo.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT schema_name,table_name
             FROM private.cr009c1_policy_snapshot LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM authenticated',
                   r.schema_name,r.table_name);
  END LOOP;
  FOR r IN SELECT * FROM private.cr009c1_table_grant_snapshot
            ORDER BY schema_name,table_name,privilege_type LOOP
    EXECUTE format('GRANT %s ON TABLE %I.%I TO %I%s',
      r.privilege_type,r.schema_name,r.table_name,r.grantee,
      CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
END $$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM private.cr009c1_function_snapshot WHERE existed LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin',
                   r.schema_name,r.function_name,r.identity_arguments);
  END LOOP;
  FOR r IN SELECT * FROM private.cr009c1_function_grant_snapshot
            ORDER BY schema_name,function_name,identity_arguments,grantee LOOP
    EXECUTE format('GRANT %s ON FUNCTION %I.%I(%s) TO %s%s',
      r.privilege_type,r.schema_name,r.function_name,r.identity_arguments,
      CASE WHEN r.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r.grantee) END,
      CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
END $$;

-- Validação antes do COMMIT. Qualquer divergência aborta toda a transação.
DO $$
DECLARE expected integer; actual integer; mismatches integer;
BEGIN
  SELECT count(*) INTO expected FROM private.cr009c1_policy_snapshot;
  SELECT count(*) INTO actual
    FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN private.cr009c1_policy_snapshot s
      ON s.schema_name=n.nspname AND s.table_name=c.relname AND s.policy_name=p.polname;
  IF actual<>expected THEN
    RAISE EXCEPTION 'Policy count mismatch: expected %, got %',expected,actual;
  END IF;
  SELECT count(*) INTO mismatches
    FROM private.cr009c1_policy_snapshot s
    JOIN pg_namespace n ON n.nspname=s.schema_name
    JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=s.table_name
    JOIN pg_policy p ON p.polrelid=c.oid AND p.polname=s.policy_name
   WHERE p.polpermissive IS DISTINCT FROM s.permissive
      OR p.polcmd IS DISTINCT FROM s.command
      OR pg_get_expr(p.polqual,p.polrelid) IS DISTINCT FROM s.using_expression
      OR pg_get_expr(p.polwithcheck,p.polrelid) IS DISTINCT FROM s.check_expression
      OR (CASE WHEN p.polroles=ARRAY[0::oid] THEN ARRAY['PUBLIC']::name[]
               ELSE ARRAY(SELECT rolname::name FROM pg_roles
                          WHERE oid=ANY(p.polroles) ORDER BY rolname) END)
         IS DISTINCT FROM s.role_names;
  IF mismatches<>0 THEN RAISE EXCEPTION '% policies differ from snapshot',mismatches; END IF;
  IF EXISTS (
    SELECT 1 FROM private.cr009c1_function_snapshot s
     WHERE s.existed IS DISTINCT FROM
       (to_regprocedure(format('%I.%I(%s)',s.schema_name,s.function_name,
                               s.identity_arguments)) IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Function set differs from snapshot'; END IF;
END $$;
COMMIT;

SELECT 'rollback_complete' status,clock_timestamp() completed_at;

-- Histórico:
-- SQL Editor não registra a 0011. Se ela foi aplicada pelo Supabase CLI,
-- depois deste rollback execute, fora do SQL:
--   supabase migration repair 20261114133000 --status reverted --linked
-- Confirme o project ref antes. Não edite supabase_migrations manualmente.
