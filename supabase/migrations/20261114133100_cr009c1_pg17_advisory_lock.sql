-- CR-009C.1: repair PostgreSQL 17 advisory-lock signature introduced in 0010.
-- The two-argument overload accepts (integer, integer), while
-- public._media_lock_key(uuid) returns bigint. Keep migration 0010 immutable
-- because it is already recorded remotely and replace only the trigger function.
BEGIN;

CREATE OR REPLACE FUNCTION public.check_private_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_media uuid;
  new_state text;
  has_private_link boolean;
  lock_key integer;
BEGIN
  IF TG_TABLE_NAME = 'media_assets' THEN
    target_media := NEW.id;
    new_state := NEW.state;
    IF new_state IS DISTINCT FROM 'published' THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'custom_request_images' THEN
    target_media := NEW.media_id;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    target_media := NEW.evidence_media_id;
    IF target_media IS NULL THEN RETURN NEW; END IF;
  ELSE
    RAISE EXCEPTION 'unsupported private-media trigger table: %', TG_TABLE_NAME
      USING ERRCODE = '0A000';
  END IF;

  -- 7007 is the namespace. Masking preserves a deterministic int4 key.
  lock_key := (public._media_lock_key(target_media) & 2147483647)::integer;
  PERFORM pg_advisory_xact_lock(7007, lock_key);

  IF TG_TABLE_NAME <> 'media_assets' THEN
    SELECT m.state INTO new_state
      FROM public.media_assets m
     WHERE m.id = target_media;
  END IF;
  IF new_state IS DISTINCT FROM 'published' THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.custom_request_images x WHERE x.media_id = target_media
  ) OR EXISTS (
    SELECT 1 FROM public.payments p WHERE p.evidence_media_id = target_media
  ) INTO has_private_link;

  IF has_private_link THEN
    RAISE EXCEPTION 'private attachment cannot be published (media_id=%)', target_media
      USING ERRCODE = '23514',
            DETAIL = 'Media is linked to a custom request or payment evidence.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_private_media() FROM PUBLIC, anon, authenticated;
COMMIT;
