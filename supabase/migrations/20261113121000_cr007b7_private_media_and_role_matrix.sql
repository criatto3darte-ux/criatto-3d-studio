-- CR-007B.7 (incremental): tighten private-media trigger and align role matrix.
-- Preserves migrations 0001–0009; no rewrite. Applies on top of 0009.
BEGIN;

-- =============================================================================
-- M-1 fix: replace global private-media scan with a per-row check.
-- The previous trigger scanned the entire media_assets / payments /
-- custom_request_images tables on every INSERT/UPDATE, causing two problems:
--   1. Self-DoS: any later INSERT/UPDATE could fail because of ONE pre-existing
--      offending row, with no indication of which row was invalid.
--   2. Non-local failure: INSERT into an unrelated banner/media could fail even
--      when the statement did not touch private attachments.
-- The new check fires only for rows whose change COULD introduce a violation:
--   * media_assets: only rows transitioning state -> 'published'
--   * custom_request_images: only rows linking a request to an asset that is
--     currently (or is becoming) 'published'
--   * payments: only rows with evidence_media_id that is (or becomes) 'published'
-- It inspects only the affected rows and the direct join partner; no whole-table
-- predicates. Concurrency between link and publish is handled by a
-- transaction-level advisory lock keyed by the media_id, serializing the two
-- conflicting actions without taking a table-wide lock.
-- =============================================================================

DROP TRIGGER IF EXISTS private_attachment ON public.media_assets;
DROP TRIGGER IF EXISTS private_attachment ON public.custom_request_images;
DROP TRIGGER IF EXISTS private_attachment ON public.payments;

CREATE OR REPLACE FUNCTION public.check_private_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  target_media uuid;
  new_state   text;
  has_private_link boolean;
BEGIN
  -- Identify which media row this change can affect and whether it is becoming
  -- (or is attaching to) a 'published' asset.
  IF TG_TABLE_NAME = 'media_assets' THEN
    target_media := NEW.id;
    new_state   := NEW.state;
    -- Only publish-state transitions are capable of creating a violation.
    IF new_state IS DISTINCT FROM 'published' THEN
      RETURN NEW;
    END IF;
    -- Serialize against concurrent linking of THIS media to a private
    -- attachment. A lock per media id keeps unrelated publishes independent.
    PERFORM pg_advisory_xact_lock(7007, target_media::bigint);
  ELSIF TG_TABLE_NAME = 'custom_request_images' THEN
    target_media := NEW.media_id;
    -- Lock the same key so a concurrent UPDATE media_assets SET state='published'
    -- for this asset cannot slip past us between our read and commit.
    PERFORM pg_advisory_xact_lock(7007, target_media::bigint);
    SELECT m.state INTO new_state FROM public.media_assets m WHERE m.id = target_media;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    target_media := NEW.evidence_media_id;
    IF target_media IS NULL THEN
      RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(7007, target_media::bigint);
    SELECT m.state INTO new_state FROM public.media_assets m WHERE m.id = target_media;
  END IF;

  IF new_state IS DISTINCT FROM 'published' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.custom_request_images x WHERE x.media_id = target_media
  ) OR EXISTS (
    SELECT 1 FROM public.payments p WHERE p.evidence_media_id = target_media
  ) INTO has_private_link;

  IF has_private_link THEN
    RAISE EXCEPTION 'private attachment cannot be published (media_id=%)', target_media
      USING ERRCODE = '23514', DETAIL = 'Media is linked to a custom request or payment evidence.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_private_media() FROM PUBLIC, anon, authenticated;

-- AFTER INSERT/UPDATE triggers run after row constraints but before commit,
-- which is the right point to see the new row values and to detect conflict
-- with concurrent transactions that hold the same per-media advisory lock.
CREATE TRIGGER private_attachment
  AFTER INSERT OR UPDATE OF state, object_key, bucket ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.check_private_media();

CREATE TRIGGER private_attachment
  AFTER INSERT OR UPDATE OF media_id ON public.custom_request_images
  FOR EACH ROW EXECUTE FUNCTION public.check_private_media();

CREATE TRIGGER private_attachment
  AFTER INSERT OR UPDATE OF evidence_media_id ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.check_private_media();

-- =============================================================================
-- M-3: role matrix alignment.
-- Approved matrix:
--   proprietario: full administration
--   editor:        catalog, editorial media, banners, coupons
--   operador:      orders, customers, inventory, custom requests
--   financeiro:    payments + financial reports (no unnecessary PII)
-- =============================================================================

-- (a) Coupons: editor needs read AND write. Existing coupon_editor ALL policy
--     already covers write, but the SELECT-only admin_read restricted to
--     proprietario+operador blocked editor list/view.
DROP POLICY IF EXISTS admin_read ON public.coupons;
DROP POLICY IF EXISTS coupon_editor ON public.coupons;
CREATE POLICY coupon_rw ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(ARRAY['proprietario','editor']::public.admin_role[]))
  WITH CHECK (public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
-- Operador does not manage coupons but needs read for order-discount context.
CREATE POLICY coupon_read_operador ON public.coupons FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['operador']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.coupons TO authenticated;

-- (b) Banners: editor needs read + write. The previous admin_read only allowed
--     proprietario; banner_editor covered write but SELECT was split.
DROP POLICY IF EXISTS admin_read ON public.banners;
DROP POLICY IF EXISTS banner_editor ON public.banners;
CREATE POLICY banner_rw ON public.banners FOR ALL TO authenticated
  USING (public.has_role(ARRAY['proprietario','editor']::public.admin_role[]))
  WITH CHECK (public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;

-- (c) Payments: operador must NOT see payment evidence/amounts (finance role).
--     Financeiro must be able to read payments (the finance_read policy already
--     exists but admin_read leaked to operador). Keep proprietario access for
--     ownership/audit.
DROP POLICY IF EXISTS admin_read ON public.payments;
DROP POLICY IF EXISTS finance_read ON public.payments;
CREATE POLICY payments_owner ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['proprietario']::public.admin_role[]));
CREATE POLICY payments_finance ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['financeiro']::public.admin_role[]));
-- NOTE: payments remain append-only via reject_mutation(); INSERT is reserved
-- to service_role (no GRANT INSERT to authenticated). The payments_owner policy
-- is for audit/debug visibility only; finance role handles reconciliation.

-- (d) Coupon redemptions: operador needs read for order reconciliation; editor
--     does not need it. Existing admin_read already grants proprietario,operador
--     — that matches the matrix. No change.

COMMIT;
