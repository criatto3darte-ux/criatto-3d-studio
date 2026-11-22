-- CR-019B: frete no checkout, calculado só pelo servidor.
--   * orders: forma de entrega, prazo e endereço de entrega (snapshot).
--   * shipping_options(cep, items): opções disponíveis (retirada, entrega
--     local pela faixa de CEP e "a combinar"), lidas de shipping_settings e
--     local_delivery_zones. Executável só pelo service_role (Edge Functions).
--   * create_checkout_order: recebe a forma escolhida, recalcula o frete pelo
--     mesmo cálculo e grava frete e total. Valores enviados pelo navegador são
--     ignorados. Payload sem "delivery" mantém o comportamento anterior
--     (frete a combinar), para abas abertas com a versão antiga do site.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN delivery_method varchar(20)
    CHECK (delivery_method IN ('retirada', 'entrega-local', 'a-combinar')),
  ADD COLUMN delivery_label varchar(120),
  ADD COLUMN delivery_days integer CHECK (delivery_days BETWEEN 0 AND 120),
  ADD COLUMN ship_cep char(8) CHECK (ship_cep ~ '^[0-9]{8}$'),
  ADD COLUMN ship_street varchar(200),
  ADD COLUMN ship_number varchar(20),
  ADD COLUMN ship_complement varchar(100),
  ADD COLUMN ship_district varchar(100),
  ADD COLUMN ship_city varchar(100),
  ADD COLUMN ship_state char(2) CHECK (ship_state ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT orders_delivery_address_check CHECK (
    delivery_method IS NULL OR delivery_method = 'retirada' OR
    num_nulls(ship_cep, ship_street, ship_number, ship_district, ship_city, ship_state) = 0
  ),
  ADD CONSTRAINT orders_delivery_label_check CHECK (
    (delivery_method IS NULL) = (delivery_label IS NULL)
  );

CREATE FUNCTION public.shipping_options(p_cep text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_settings public.shipping_settings%ROWTYPE;
  v_cep text := regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g');
  v_production integer := 0;
  v_zone record;
  v_options jsonb := '[]'::jsonb;
  v_detail text;
  v_has_settings boolean;
BEGIN
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    SELECT coalesce(max(p.production_days), 0) INTO v_production
      FROM public.products p
     WHERE p.production_mode = 'sob-demanda'
       AND p.id::text IN (
         SELECT value->>'productId' FROM jsonb_array_elements(p_items)
          WHERE jsonb_typeof(value) = 'object'
       );
  END IF;

  SELECT * INTO v_settings FROM public.shipping_settings WHERE id = 1;
  v_has_settings := FOUND;
  IF v_has_settings AND v_settings.pickup_enabled THEN
    v_detail := btrim(v_settings.pickup_address ||
      CASE WHEN btrim(v_settings.pickup_hours) <> '' THEN ' — ' || v_settings.pickup_hours ELSE '' END);
    v_options := v_options || jsonb_build_object(
      'method', 'retirada', 'label', 'Retirada', 'priceCents', 0,
      'days', v_production, 'detail', v_detail);
  END IF;

  IF v_has_settings AND v_settings.local_delivery_enabled AND v_cep ~ '^[0-9]{8}$' THEN
    SELECT z.name, z.price_cents, z.delivery_days INTO v_zone
      FROM public.local_delivery_zones z
     WHERE z.active AND z.cep_start <= v_cep AND v_cep <= z.cep_end
     ORDER BY z.display_order, z.cep_start
     LIMIT 1;
    IF FOUND THEN
      v_options := v_options || jsonb_build_object(
        'method', 'entrega-local', 'label', left('Entrega local — ' || v_zone.name, 120),
        'priceCents', v_zone.price_cents, 'days', v_zone.delivery_days + v_production,
        'detail', '');
    END IF;
  END IF;

  RETURN v_options || jsonb_build_object(
    'method', 'a-combinar', 'label', 'Envio a combinar pelo WhatsApp',
    'priceCents', NULL, 'days', NULL, 'detail', '');
END;
$$;
REVOKE ALL ON FUNCTION public.shipping_options(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shipping_options(text, jsonb) TO service_role;

-- The result row gains shipping fields, so the function is recreated.
DROP FUNCTION public.create_checkout_order(jsonb);
CREATE FUNCTION public.create_checkout_order(p_payload jsonb)
RETURNS TABLE(order_id uuid, order_number bigint, subtotal_cents bigint, replayed boolean,
              shipping_cents bigint, total_cents bigint, delivery_label text, delivery_days integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text := btrim(coalesce(p_payload->>'customerName',''));
  v_phone text := btrim(coalesce(p_payload->>'customerPhone',''));
  v_notes text := btrim(coalesce(p_payload->>'notes',''));
  v_key uuid;
  v_hash text;
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
  v_item_id uuid;
  v_attributes jsonb;
  v_sku text;
  v_allocated integer;
  v_delivery jsonb := p_payload->'delivery';
  v_method text;
  v_option jsonb;
  v_shipping bigint;
  v_total bigint;
  v_label text;
  v_days integer;
  v_cep text;
  v_street text;
  v_number_addr text;
  v_complement text;
  v_district text;
  v_city text;
  v_state text;
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

  -- Delivery choice: the server recomputes the price; only the method and
  -- the address come from the customer.
  IF v_delivery IS NOT NULL AND jsonb_typeof(v_delivery) <> 'null' THEN
    IF jsonb_typeof(v_delivery) <> 'object' THEN
      RAISE EXCEPTION 'invalid delivery' USING ERRCODE='22023';
    END IF;
    v_method := v_delivery->>'method';
    v_cep := regexp_replace(coalesce(v_delivery->>'cep',''), '[^0-9]', '', 'g');
    v_street := nullif(btrim(coalesce(v_delivery->>'street','')), '');
    v_number_addr := nullif(btrim(coalesce(v_delivery->>'number','')), '');
    v_complement := nullif(btrim(coalesce(v_delivery->>'complement','')), '');
    v_district := nullif(btrim(coalesce(v_delivery->>'district','')), '');
    v_city := nullif(btrim(coalesce(v_delivery->>'city','')), '');
    v_state := upper(nullif(btrim(coalesce(v_delivery->>'state','')), ''));
    IF v_method IS NULL OR v_method NOT IN ('retirada','entrega-local','a-combinar') THEN
      RAISE EXCEPTION 'invalid delivery method' USING ERRCODE='22023';
    END IF;
    IF v_method <> 'retirada' AND (
         v_cep !~ '^[0-9]{8}$'
         OR v_street IS NULL OR length(v_street) > 200
         OR v_number_addr IS NULL OR length(v_number_addr) > 20
         OR length(coalesce(v_complement,'')) > 100
         OR v_district IS NULL OR length(v_district) > 100
         OR v_city IS NULL OR length(v_city) > 100
         OR coalesce(v_state,'') !~ '^[A-Z]{2}$') THEN
      RAISE EXCEPTION 'invalid delivery address' USING ERRCODE='22023';
    END IF;
    SELECT value INTO v_option
      FROM jsonb_array_elements(public.shipping_options(v_cep, p_payload->'items'))
     WHERE value->>'method' = v_method
     LIMIT 1;
    IF v_option IS NULL THEN
      RAISE EXCEPTION 'delivery method unavailable' USING ERRCODE='23514';
    END IF;
    v_shipping := (v_option->>'priceCents')::bigint;
    v_label := v_option->>'label';
    v_days := (v_option->>'days')::integer;
    IF v_method = 'retirada' THEN
      v_cep := NULL; v_street := NULL; v_number_addr := NULL; v_complement := NULL;
      v_district := NULL; v_city := NULL; v_state := NULL;
    END IF;
  END IF;

  v_key := (p_payload->>'idempotencyKey')::uuid;
  v_hash := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_key::text, 10991));
  SELECT o.id,o.number,o.payload_hash,o.subtotal_cents,o.shipping_cents,o.total_cents,
         o.delivery_label,o.delivery_days
    INTO v_existing
  FROM public.orders o WHERE o.idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.payload_hash <> v_hash THEN
      RAISE EXCEPTION 'checkout key reused for different payload' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.number,v_existing.subtotal_cents,true,
      v_existing.shipping_cents,v_existing.total_cents,
      v_existing.delivery_label::text,v_existing.delivery_days;
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

  v_total := CASE WHEN v_shipping IS NULL THEN NULL ELSE v_subtotal + v_shipping END;

  INSERT INTO public.orders(
    customer_name_snapshot, customer_phone_snapshot,
    subtotal_cents, discount_cents, shipping_cents, total_cents, notes,
    idempotency_key, payload_hash, privacy_notice_version,
    delivery_method, delivery_label, delivery_days,
    ship_cep, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state
  ) VALUES (
    v_name,v_phone,v_subtotal,0,v_shipping,v_total,v_notes,
    v_key,v_hash,'checkout-homolog-v1',
    v_method, v_label, v_days,
    v_cep, v_street, v_number_addr, v_complement, v_district, v_city, v_state
  ) RETURNING id, number INTO v_order_id, v_number;

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
    ) RETURNING id INTO v_item_id;
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
      INSERT INTO public.order_allocations(order_item_id,product_id,quantity,state)
      VALUES(v_item_id,v_product.id,v_qty,'active');
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_order_id,v_number,v_subtotal,false,v_shipping,v_total,v_label,v_days;
END;
$$;
REVOKE ALL ON FUNCTION public.create_checkout_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(jsonb) TO service_role;

DO $validation$
BEGIN
  IF has_function_privilege('anon', 'public.shipping_options(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.shipping_options(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.create_checkout_order(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.create_checkout_order(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'CR-019B validation failed: checkout functions must stay service_role only';
  END IF;
END
$validation$;

COMMIT;
