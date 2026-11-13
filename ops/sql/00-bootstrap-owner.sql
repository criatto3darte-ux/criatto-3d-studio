-- CR-007B.7 — BOOTSTRAP DO PRIMEIRO PROPRIETÁRIO (homologação).
-- Executar SOMENTE com privilégio de postgres/service_role, após aplicadas as
-- migrations 0001–0010. NÃO executar por Edge Function, RPC ou aplicação.
--
-- Uso (recomendado):
--   1. Obter o UUID do usuário em auth.users (já com email verificado).
--   2. Editar os dois valores abaixo (target_user_id e actor_display_name).
--   3. Executar uma única vez no SQL Editor da dashboard ou via
--      supabase db execute --db-url "$DB_URL" -f ops/sql/00-bootstrap-owner.sql
--
-- Idempotência: se já existir um proprietário ativo, falha com
-- 'refusing bootstrap: an active proprietario already exists' e NÃO altera nada.

BEGIN;

-- -------- Valores de operação (substituir antes de rodar) --------------------
SET LOCAL cr007b.target_user_id     = '00000000-0000-0000-0000-000000000000';
SET LOCAL cr007b.actor_display_name = 'Nome do responsável pelo bootstrap';
-- -----------------------------------------------------------------------------

-- Advisory lock (7007,2) é o mesmo usado pelo trigger protect_last_owner;
-- previne corrida com outra execução concorrente do bootstrap/recover.
SELECT pg_advisory_xact_lock(7007, 2);

DO $$
DECLARE
  target      uuid;
  actor_name  text;
  existing    bigint;
  new_role_id uuid;
BEGIN
  target     := current_setting('cr007b.target_user_id', true)::uuid;
  actor_name := nullif(btrim(current_setting('cr007b.actor_display_name', true)), '');

  IF target IS NULL OR target = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'cr007b.target_user_id must be set to the auth.users id of the new owner'
      USING ERRCODE = '23514';
  END IF;
  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'cr007b.actor_display_name must be a non-empty human name'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target) THEN
    RAISE EXCEPTION 'target user % not found in auth.users; create/invite the user first', target
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO existing
    FROM public.admin_profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
   WHERE p.active AND r.role = 'proprietario';

  IF existing > 0 THEN
    RAISE EXCEPTION 'refusing bootstrap: an active proprietario already exists (count=%)', existing
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.admin_profiles(user_id, display_name, active)
  VALUES (target, actor_name, true)
  ON CONFLICT (user_id) DO UPDATE SET active = true, display_name = EXCLUDED.display_name;

  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (target, 'proprietario', NULL)
  ON CONFLICT (user_id, role) DO NOTHING
  RETURNING id INTO new_role_id;

  INSERT INTO public.admin_audit_events(
      id, actor_id, action, entity_type, entity_id,
      request_id, operation_key, occurred_at, safe_before, safe_after, reason)
  VALUES (
      gen_random_uuid(), NULL, 'bootstrap.owner', 'admin_profile', target,
      gen_random_uuid(),
      'bootstrap-owner-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-US'),
      clock_timestamp(), NULL,
      jsonb_build_object('role', 'proprietario', 'display_name', actor_name),
      'initial owner provisioning executed per docs/CR-007B-OWNER-BOOTSTRAP.md');
END $$;

-- Retorno para anexar ao runbook.
SELECT p.user_id       AS profile_id,
       r.id            AS role_id,
       r.role,
       p.display_name,
       p.active,
       p.created_at
  FROM public.admin_profiles p
  JOIN public.user_roles   r ON r.user_id = p.user_id
 WHERE p.user_id = current_setting('cr007b.target_user_id', true)::uuid
   AND r.role   = 'proprietario';

COMMIT;
