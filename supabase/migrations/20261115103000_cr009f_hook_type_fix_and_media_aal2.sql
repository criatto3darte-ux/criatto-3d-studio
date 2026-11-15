-- CR-009F: fix custom_access_token_hook COALESCE type mismatch + add require_aal2()
-- to media_read_scoped policy (omitted from 0011's ALTER loop).
--
-- Bugs corrigidos:
--   1. Na 0011, o hook usava COALESCE(claims->>'email_verified' (text),
--      claims->>'email_confirmed_at' IS NOT NULL (boolean)), causando erro
--      42804 "COALESCE types text and boolean cannot be matched" quando o
--      hook era invocado pelo GoTrue. Normalizamos para boolean.
--   2. A policy media_read_scoped de media_assets não estava na lista alvo
--      da 0011 (nome diferente de admin_*/coupon_*/banner_*/payments_*),
--      então não recebeu AND require_aal2(). Editor/proprietário em AAL1
--      conseguia consultar mídia editorial indevidamente.
--
-- Esta migration é idempotente e pode ser aplicada a qualquer momento após a
-- 0011 (no estado atual, já foi aplicada manualmente em homologação durante
-- a CR-009F para corrigir o bug antes de ativar o hook).

BEGIN;

-- 1. Corrige o hook com a versão estavelmente tipada.
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
  ev boolean;
BEGIN
  claims := COALESCE(event->'claims', '{}'::jsonb);
  uid := (claims->>'sub')::uuid;

  SELECT COALESCE(array_agg(r.role::text) FILTER (WHERE p.active), ARRAY[]::text[])
    INTO roles
    FROM public.admin_profiles p
    LEFT JOIN public.user_roles r ON r.user_id = p.user_id
   WHERE p.user_id = uid;

  aal_lvl := claims->>'aal';

  IF jsonb_typeof(claims->'email_verified') = 'boolean' THEN
    ev := (claims->>'email_verified')::boolean;
  ELSIF claims->>'email_confirmed_at' IS NOT NULL THEN
    ev := true;
  ELSE
    ev := false;
  END IF;

  claims := claims
    || jsonb_build_object(
         'roles', to_jsonb(roles),
         'email_verified', ev
       );

  IF aal_lvl IS NOT NULL THEN
    claims := claims || jsonb_build_object('aal', aal_lvl);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO service_role, supabase_auth_admin;

-- 2. Garante que media_read_scoped exija AAL2 (idempotente).
--    A policy atual pode ou não já ter require_aal2(); recriamos incondicionalmente.
DROP POLICY IF EXISTS media_read_scoped ON public.media_assets;
CREATE POLICY media_read_scoped ON public.media_assets
  FOR SELECT TO authenticated
  USING ((has_role(ARRAY['proprietario'::admin_role]) OR editor_can_read_media(id))
         AND public.require_aal2());

COMMIT;
