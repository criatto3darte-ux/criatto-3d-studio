-- CR-007B.7 — RECUPERAÇÃO DE ACESSO DO PROPRIETÁRIO.
-- Use SOMENTE se o último proprietário ativo foi perdido (conta desativada,
-- email inacessível, etc). Executar como postgres/service_role. NUNCA expor
-- este script por RPC/Edge Function.
--
-- 1. Crie/convide o usuário substituto via Supabase Auth e confirme o email.
-- 2. Preencha target_user_id, actor_display_name e reason.
-- 3. Execute uma única vez. Registre o evento em admin_audit_events.
--
-- Diferente do bootstrap, este script NÃO REQUER ausência de proprietário;
-- ao contrário, ele deve ser usado quando o(s) proprietário(s) existente(s)
-- estão inacessíveis. Se o novo usuário já for proprietário ativo, é no-op.

BEGIN;

SET LOCAL cr007b.target_user_id       = '00000000-0000-0000-0000-000000000000';
SET LOCAL cr007b.actor_display_name   = 'Operador de recuperação';
SET LOCAL cr007b.reason               = '';

SELECT pg_advisory_xact_lock(7007, 2);

DO $$
DECLARE
  target     uuid;
  actor_name text;
  reason     text;
  new_role_id uuid;
BEGIN
  target     := current_setting('cr007b.target_user_id', true)::uuid;
  actor_name := nullif(btrim(current_setting('cr007b.actor_display_name', true)), '');
  reason     := nullif(btrim(current_setting('cr007b.reason', true)), '');

  IF target IS NULL OR target = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'cr007b.target_user_id required';
  END IF;
  IF actor_name IS NULL THEN RAISE EXCEPTION 'cr007b.actor_display_name required'; END IF;
  IF reason IS NULL THEN
    RAISE EXCEPTION 'cr007b.reason is required (audit record, e.g. incident ticket)'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target) THEN
    RAISE EXCEPTION 'target user % not found in auth.users', target;
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
      gen_random_uuid(), NULL, 'recover.owner', 'admin_profile', target,
      gen_random_uuid(),
      'recover-owner-' || to_char(clock_timestamp(),'YYYYMMDD-HH24MISS-US'),
      clock_timestamp(), NULL,
      jsonb_build_object('role','proprietario','display_name',actor_name),
      'access recovery: ' || reason);
END $$;

SELECT p.user_id, r.id AS role_id, r.role, p.display_name, p.active, p.created_at
  FROM public.admin_profiles p
  JOIN public.user_roles r ON r.user_id = p.user_id
 WHERE p.user_id = current_setting('cr007b.target_user_id', true)::uuid
   AND r.role   = 'proprietario';

COMMIT;
