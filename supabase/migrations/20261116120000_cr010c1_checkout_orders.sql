-- CR-010C.1 — Server-owned WhatsApp checkout and bounded abuse control.
-- PREPARED ONLY. Do not apply to remote Supabase before PG17 + security checks.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE private.checkout_rate_limits (
  fingerprint text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkout_rate_fingerprint_check CHECK (fingerprint ~ '^[a-f0-9]{64}$')
);
REVOKE ALL ON private.checkout_rate_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.check_checkout_rate_limit(p_fingerprint text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE allowed boolean;
BEGIN
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid rate limit key' USING ERRCODE='22023';
  END IF;
  INSERT INTO private.checkout_rate_limits(fingerprint,window_started_at,attempt_count)
  VALUES (p_fingerprint,now(),1)
  ON CONFLICT (fingerprint) DO UPDATE
  SET attempt_count = CASE
    WHEN private.checkout_rate_limits.window_started_at < now() - interval '1 hour'
      THEN 1 ELSE private.checkout_rate_limits.attempt_count + 1 END,
    window_started_at = CASE
      WHEN private.checkout_rate_limits.window_started_at < now() - interval '1 hour'
      THEN now() ELSE private.checkout_rate_limits.window_started_at END,
    last_attempt_at = now()
  RETURNING attempt_count <= 10 INTO allowed;
  RETURN allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.check_checkout_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_checkout_rate_limit(text) TO service_role;

CREATE FUNCTION public.create_checkout_order(p_payload jsonb)
RETURNS TABLE(order_id uuid, order_number bigint, subtotal_cents bigint, replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text := btrim(coalesce(p_payload->>'customerName',''));
  v_phone text := btrim(coalesce(p_payload->>'customerPhone',''));
  v_notes text := btrim(coalesce(p_payload->>'notes',''));
  v_key uuid;
  v_hash text;
  v_count integer;
  v_existing record;
  v_order_id uuid;
  v_number bigint;
  v_subtotal bigint := 0;
  v_line jsonb;
  v_product record;
  v_variant record;
  v_qty integer;
  v_unit_price bigint;
  v_variant_id uuid;
  v_attributes jsonb;
  v_sku text;
  v_kind text;
  v_allocated integer;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid checkout payload' USING ERRCODE='22023';
  END IF;
  IF length(v_name) NOT BETWEEN 3 AND 120
     OR v_phone !~ '^\+55[1-9][0-9]{9,10}$'
     OR length(v_notes) > 500
     OR (p_payload->>'privacyAccepted') IS DISTINCT FROM 'true'
     OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 20
     OR coalesce(p_payload->>'idempotencyKey','') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  THEN
    RAISE EXCEPTION 'invalid checkout fields' USING ERRCODE='22023';
  END IF;
  v_key := (p_payload->>'idempotencyKey')::uuid;
  v_hash := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_key::text, 10991));
  SELECT id,number,payload_hash,subtotal_cents INTO v_existing
  FROM public.orders WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.payload_hash <> v_hash THEN
      RAISE EXCEPTION 'checkout key reused for different payload' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.number,v_existing.subtotal_cents,true;
    RETURN;
  END IF;

  -- All entries are processed in stable UUID order for deterministic row locks.
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items')
                ORDER BY value->>'productId', value->>'sku' LOOP
    IF jsonb_typeof(v_line) <> 'object' OR
       coalesce(v_line->>'productId','') !~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
       OR coalesce(v_line->>'quantity','') !~ '^[1-9][0-9]?$'
       OR (v_line->>'quantity')::integer > 10 THEN
      RAISE EXCEPTION 'invalid checkout line' USING ERRCODE='22023';
    END IF;
    v_qty := (v_line->>'quantity')::integer;
    SELECT p.id,p.name,p.production_mode,p.effective_price_cents
      INTO v_product FROM public.products p
      JOIN public.categories c ON c.id=p.category_id
      WHERE p.id=(v_line->>'productId')::uuid
        AND p.active AND p.archived_at IS NULL AND c.active
      FOR SHARE OF p;
    IF NOT FOUND OR v_product.effective_price_cents IS NULL
       OR v_product.effective_price_cents <= 0 THEN
      RAISE EXCEPTION 'product unavailable' USING ERRCODE='23514';
    END IF;

    v_variant_id := NULL;
    IF EXISTS (SELECT 1 FROM public.product_attribute_groups g WHERE g.product_id=v_product.id)
       AND NOT EXISTS (SELECT 1 FROM public.product_variants v
                       WHERE v.product_id=v_product.id AND v.active) THEN
      RAISE EXCEPTION 'product variants not configured' USING ERRCODE='23514';
    END IF;
    v_sku := nullif(btrim(coalesce(v_line->>'sku','')),'');
    IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id=v_product.id AND v.active) THEN
      IF v_sku IS NULL THEN
        RAISE EXCEPTION 'variant required' USING ERRCODE='23514';
      END IF;
      SELECT id,sku INTO v_variant FROM public.product_variants
      WHERE product_id=v_product.id AND sku=v_sku AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'variant unavailable' USING ERRCODE='23514'; END IF;
      v_variant_id := v_variant.id;
    ELSIF v_sku IS NOT NULL THEN
      RAISE EXCEPTION 'unexpected variant' USING ERRCODE='23514';
    END IF;
    v_unit_price := v_product.effective_price_cents;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    IF v_subtotal > 200000000 THEN
      RAISE EXCEPTION 'order value limit exceeded' USING ERRCODE='22023';
    END IF;
  END LOOP;

  v_number := nextval('public.orders_number_seq');
  INSERT INTO public.orders(
    number, customer_name_snapshot, customer_phone_snapshot,
    subtotal_cents, discount_cents, shipping_cents, total_cents, notes,
    idempotency_key, payload_hash, privacy_notice_version
  ) VALUES (
    v_number,v_name,v_phone,v_subtotal,0,NULL,NULL,v_notes,
    v_key,v_hash,'checkout-homolog-v1'
  ) RETURNING id INTO v_order_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'items')
                ORDER BY value->>'productId', value->>'sku' LOOP
    v_qty := (v_line->>'quantity')::integer;
    SELECT p.id,p.name,p.production_mode,p.effective_price_cents INTO v_product
    FROM public.products p WHERE p.id=(v_line->>'productId')::uuid;
    v_sku := nullif(btrim(coalesce(v_line->>'sku','')),'');
    v_variant_id := NULL;
    v_attributes := '{}'::jsonb;
    IF v_sku IS NOT NULL THEN
      SELECT id INTO v_variant_id FROM public.product_variants
      WHERE product_id=v_product.id AND sku=v_sku AND active;
      SELECT coalesce(jsonb_object_agg(g.label,o.label),'{}'::jsonb)
        INTO v_attributes
      FROM public.variant_option_values ov
      JOIN public.product_attribute_groups g ON g.id=ov.group_id
      JOIN public.product_attribute_options o ON o.id=ov.option_id
      WHERE ov.variant_id=v_variant_id;
    END IF;
    INSERT INTO public.order_items(
      order_id,product_id,variant_id,product_name_snapshot,sku_snapshot,
      attributes_snapshot,unit_price_cents,quantity,line_discount_cents
    ) VALUES(
      v_order_id,v_product.id,v_variant_id,v_product.name,v_sku,
      v_attributes,
      v_product.effective_price_cents,v_qty,0
    );
    IF v_product.production_mode = 'pronta-entrega' THEN
      UPDATE public.inventory SET allocated=allocated+v_qty
      WHERE product_id=v_product.id AND (on_hand-allocated)>=v_qty
      RETURNING allocated INTO v_allocated;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient inventory' USING ERRCODE='23514';
      END IF;
      INSERT INTO public.inventory_movements(
        product_id,order_id,kind,quantity,delta_on_hand,delta_allocated,
        reason,actor_id,operation_key
      ) VALUES (
        v_product.id,v_order_id,'allocate',v_qty,0,v_qty,
        'Reserva para checkout WhatsApp',NULL,
        v_order_id::text||':'||v_product.id::text||':'||coalesce(v_sku,'base')
      );
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_order_id,v_number,v_subtotal,false;
END;
$$;
REVOKE ALL ON FUNCTION public.create_checkout_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(jsonb) TO service_role;


-- AAL2-only order transitions atomically release or consume reserved stock.
CREATE FUNCTION public.transition_checkout_order(
  p_order_id uuid, p_expected_version integer, p_new_status public.order_status,
  p_reason text DEFAULT ''
)
RETURNS TABLE(order_id uuid, status public.order_status, version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  current_status public.order_status;
  current_version integer;
  row_item record;
BEGIN
  IF NOT public.require_aal2()
     OR NOT public.has_role(ARRAY['proprietario','operador']::public.admin_role[]) THEN
    RAISE EXCEPTION 'AAL2 order authorization required' USING ERRCODE='42501';
  END IF;
  IF p_order_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
     OR p_new_status IS NULL OR length(coalesce(p_reason,'')) > 500 THEN
    RAISE EXCEPTION 'invalid status transition input' USING ERRCODE='22023';
  END IF;
  SELECT o.status,o.version INTO current_status,current_version
  FROM public.orders o WHERE o.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING ERRCODE='23503'; END IF;
  IF current_version <> p_expected_version THEN
    RAISE EXCEPTION 'order version changed' USING ERRCODE='40001';
  END IF;
  IF NOT (
    (current_status='aguardando-contato' AND p_new_status IN ('em-atendimento','cancelado')) OR
    (current_status='em-atendimento' AND p_new_status IN ('confirmado','cancelado')) OR
    (current_status='confirmado' AND p_new_status IN ('em-producao','pronto-para-entrega','cancelado')) OR
    (current_status='em-producao' AND p_new_status IN ('pronto-para-entrega','cancelado')) OR
    (current_status='pronto-para-entrega' AND p_new_status IN ('enviado','concluido','cancelado')) OR
    (current_status='enviado' AND p_new_status='concluido')
  ) THEN
    RAISE EXCEPTION 'invalid order status transition' USING ERRCODE='23514';
  END IF;
  IF p_new_status IN ('cancelado','concluido') THEN
    FOR row_item IN
      SELECT product_id,SUM(quantity)::integer AS quantity
      FROM public.order_items oi
      JOIN public.products p ON p.id=oi.product_id
      WHERE oi.order_id=p_order_id AND p.production_mode='pronta-entrega'
      GROUP BY product_id ORDER BY product_id
    LOOP
      IF p_new_status='cancelado' THEN
        UPDATE public.inventory SET allocated=allocated-row_item.quantity
        WHERE product_id=row_item.product_id AND allocated>=row_item.quantity;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'inventory reservation not found' USING ERRCODE='23514';
        END IF;
        INSERT INTO public.inventory_movements(
          product_id,order_id,kind,quantity,delta_on_hand,delta_allocated,
          reason,actor_id,operation_key
        ) VALUES (
          row_item.product_id,p_order_id,'release',row_item.quantity,0,
          -row_item.quantity,'Pedido cancelado',auth.uid(),
          p_order_id::text||':'||row_item.product_id::text||':cancel'
        );
      ELSE
        UPDATE public.inventory SET on_hand=on_hand-row_item.quantity,
          allocated=allocated-row_item.quantity
        WHERE product_id=row_item.product_id
          AND allocated>=row_item.quantity AND on_hand>=row_item.quantity;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'inventory cannot be consumed' USING ERRCODE='23514';
        END IF;
        INSERT INTO public.inventory_movements(
          product_id,order_id,kind,quantity,delta_on_hand,delta_allocated,
          reason,actor_id,operation_key
        ) VALUES (
          row_item.product_id,p_order_id,'consume',row_item.quantity,
          -row_item.quantity,-row_item.quantity,
          'Pedido concluido',auth.uid(),
          p_order_id::text||':'||row_item.product_id::text||':complete'
        );
      END IF;
    END LOOP;
  END IF;
  UPDATE public.orders o SET status=p_new_status,
    confirmed_at=CASE WHEN p_new_status='confirmado' THEN now() ELSE confirmed_at END
  WHERE o.id=p_order_id RETURNING o.version INTO current_version;
  INSERT INTO public.order_status_history(
    order_id,from_status,to_status,actor_id,note,operation_key
  ) VALUES(
    p_order_id,current_status,p_new_status,auth.uid(),
    left(coalesce(p_reason,''),500),
    p_order_id::text||':status:'||current_version::text
  );
  RETURN QUERY SELECT p_order_id,p_new_status,current_version;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_checkout_order(uuid,integer,public.order_status,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_checkout_order(uuid,integer,public.order_status,text)
  TO authenticated;

COMMIT;
