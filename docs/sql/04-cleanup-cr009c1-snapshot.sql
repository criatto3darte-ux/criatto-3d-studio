-- CRIATTO 3D — CR-009D.2: limpeza ESPECÍFICA do snapshot de rollback
--
-- Remove APENAS os objetos criados por 01-precheck-capture-state.sql
-- (tabelas private.cr009c1_*). NÃO faz DROP SCHEMA private CASCADE;
-- preserva qualquer outra tabela/função/event trigger que já exista
-- no schema private.
--
-- Uso: execute SOMENTE após uma das duas situações:
--   (a) ativação 0011+0012 foi confirmada e o snapshot não é mais necessário;
--   (b) rollback 03 foi executado com sucesso e o snapshot não é mais necessário.
-- NÃO execute antes de concluir a ativação ou antes de um rollback confirmado.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  objs text[];
  tbl text;
  sc text;
BEGIN
  -- (1) Verifica que não estamos em uma transação de ativação/rollback ainda aberta
  --     (garante que o snapshot não é mais referenciado).
  IF EXISTS (
    SELECT 1 FROM pg_locks l
    JOIN pg_class c ON c.oid = l.relation
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private'
      AND c.relname LIKE 'cr009c1\_%' ESCAPE '\'
      AND l.mode = 'AccessExclusiveLock'
  ) THEN
    RAISE EXCEPTION 'cr009c1 tables are locked; cleanup aborted (activation/rollback still in progress?)';
  END IF;

  -- (2) Verifica que os objetos esperados existem (evita limpeza duplicada silenciosa).
  SELECT array_agg(c.relname ORDER BY c.relname) INTO objs
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'private'
     AND c.relkind = 'r'
     AND c.relname LIKE 'cr009c1\_%' ESCAPE '\';

  IF objs IS NULL OR array_length(objs,1) IS NULL OR array_length(objs,1) = 0 THEN
    RAISE EXCEPTION 'No cr009c1_* tables found in schema private; nothing to clean up.';
  END IF;

  RAISE NOTICE 'Preparing to drop cr009c1 snapshot objects: %', objs;

  -- (3) Ordem de DROP respeitando dependências de FK (não há FKs entre essas
  --     tabelas no script 01-precheck, mas garantimos ordem defensiva):
  --       function_grant_snapshot -> function_snapshot
  --       table_grant_snapshot, policy_snapshot -> independents
  --       snapshot_meta -> por último
  FOREACH tbl IN ARRAY ARRAY[
    'cr009c1_function_grant_snapshot',
    'cr009c1_function_snapshot',
    'cr009c1_table_grant_snapshot',
    'cr009c1_policy_snapshot',
    'cr009c1_snapshot_meta'
  ] LOOP
    IF to_regclass(('private.' || tbl)::regclass) IS NOT NULL THEN
      EXECUTE format('DROP TABLE private.%I', tbl);
      RAISE NOTICE 'Dropped private.%', tbl;
    END IF;
  END LOOP;

  -- (4) NÃO dropar o schema private. Não dropar outras tabelas.
  -- (5) Validação final.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='private' AND c.relname LIKE 'cr009c1\_%' ESCAPE '\'
  ) THEN
    RAISE EXCEPTION 'Cleanup incomplete: some cr009c1_* tables remain.';
  END IF;
END $$;
COMMIT;

SELECT 'cr009c1_snapshot_cleanup_complete' AS status, clock_timestamp() AS completed_at;
