-- CR-010B.1 local-only additive commands. Review and validate in PG17 before
-- asking for approval to apply anywhere; this file is never applied remotely here.
BEGIN;

-- The pre-existing stock table had no per-product threshold. This additive
-- field records it without changing table identity or exposing it publicly.
ALTER TABLE public.inventory
  ADD COLUMN minimum_on_hand integer NOT NULL DEFAULT 0 CHECK(minimum_on_hand>=0);

-- Category swaps are one PostgREST transaction and optimistic on both rows.
CREATE FUNCTION public.swap_category_order(
  p_first_id uuid, p_first_version integer,
  p_second_id uuid, p_second_version integer
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  first_order integer;
  second_order integer;
  first_version integer;
  second_version integer;
BEGIN
  IF NOT public.require_aal2()
     OR NOT public.has_role(ARRAY['proprietario','editor']::public.admin_role[]) THEN
    RAISE EXCEPTION 'AAL2 editor authorization required' USING ERRCODE='42501';
  END IF;
  IF p_first_id IS NULL OR p_second_id IS NULL OR p_first_id = p_second_id THEN
    RAISE EXCEPTION 'two distinct categories are required' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(7007, 101);
  SELECT display_order, version INTO first_order, first_version
    FROM public.categories WHERE id=p_first_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'category changed; refresh' USING ERRCODE='40001'; END IF;
  SELECT display_order, version INTO second_order, second_version
    FROM public.categories WHERE id=p_second_id FOR UPDATE;
  IF NOT FOUND OR first_version <> p_first_version OR second_version <> p_second_version THEN
    RAISE EXCEPTION 'category changed; refresh' USING ERRCODE='40001';
  END IF;
  UPDATE public.categories SET display_order=second_order WHERE id=p_first_id;
  UPDATE public.categories SET display_order=first_order WHERE id=p_second_id;
END;
$$;
REVOKE ALL ON FUNCTION public.swap_category_order(uuid,integer,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_category_order(uuid,integer,uuid,integer) TO authenticated;

-- Replace a product's full attribute/variant graph atomically. Input shape:
-- groups: [{code,label,position,required,options:[{code,label,position,active}]}]
-- variants: [{sku,active,selections:{group_code: option_code}}]
CREATE FUNCTION public.replace_product_variants(
  p_product_id uuid, p_groups jsonb, p_variants jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  g jsonb;
  o jsonb;
  v jsonb;
  selection jsonb;
  group_id uuid;
  option_id uuid;
  variant_id uuid;
  group_ids jsonb := '{}'::jsonb;
  option_ids jsonb := '{}'::jsonb;
  selection_key text;
  pair_count integer;
  code text;
  option_code text;
BEGIN
  IF NOT public.require_aal2()
     OR NOT public.has_role(ARRAY['proprietario','editor']::public.admin_role[]) THEN
    RAISE EXCEPTION 'AAL2 editor authorization required' USING ERRCODE='42501';
  END IF;
  IF p_product_id IS NULL OR jsonb_typeof(p_groups) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_variants) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_groups)>20 OR jsonb_array_length(p_variants)>500 THEN
    RAISE EXCEPTION 'invalid variant payload' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_product_id::text, 7101));
  PERFORM 1 FROM public.products WHERE id=p_product_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found or archived' USING ERRCODE='23503'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.product_variants pv ON pv.id=oi.variant_id
    WHERE pv.product_id=p_product_id
  ) THEN
    RAISE EXCEPTION 'variant history is referenced by an order and cannot be replaced' USING ERRCODE='23503';
  END IF;

  -- Remove the old graph in FK-safe order. Deferred integrity triggers verify
  -- the final graph at transaction commit, not these intermediate statements.
  DELETE FROM public.variant_option_values WHERE product_id=p_product_id;
  DELETE FROM public.product_variants WHERE product_id=p_product_id;
  DELETE FROM public.product_attribute_options o USING public.product_attribute_groups g
    WHERE o.group_id=g.id AND g.product_id=p_product_id;
  DELETE FROM public.product_attribute_groups WHERE product_id=p_product_id;

  FOR g IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
    code := g->>'code';
    IF code IS NULL OR code !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       OR length(coalesce(g->>'label','')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid attribute group' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.product_attribute_groups(product_id,code,label,position,required)
    VALUES(p_product_id,code,g->>'label',coalesce((g->>'position')::integer,0),coalesce((g->>'required')::boolean,true))
    RETURNING id INTO group_id;
    group_ids := group_ids || jsonb_build_object(code,group_id::text);
    IF jsonb_typeof(g->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(g->'options')>200 THEN
      RAISE EXCEPTION 'invalid attribute options' USING ERRCODE='22023';
    END IF;
    FOR o IN SELECT value FROM jsonb_array_elements(g->'options') LOOP
      option_code := o->>'code';
      IF option_code IS NULL OR option_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
         OR length(coalesce(o->>'label','')) NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'invalid attribute option' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.product_attribute_options(group_id,code,label,position,active)
      VALUES(group_id,option_code,o->>'label',coalesce((o->>'position')::integer,0),coalesce((o->>'active')::boolean,true))
      RETURNING id INTO option_id;
      option_ids := option_ids || jsonb_build_object(code||':'||option_code,option_id::text);
    END LOOP;
  END LOOP;

  FOR v IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
    IF length(btrim(coalesce(v->>'sku',''))) NOT BETWEEN 1 AND 100
       OR jsonb_typeof(coalesce(v->'selections','{}'::jsonb))<>'object' THEN
      RAISE EXCEPTION 'invalid variant SKU or selection' USING ERRCODE='22023';
    END IF;
    selection := coalesce(v->'selections','{}'::jsonb);
    selection_key := 'base';
    pair_count := 0;
    FOR code, option_code IN SELECT key,value #>> '{}' FROM jsonb_each(selection) LOOP
      group_id := (group_ids->>code)::uuid;
      option_id := (option_ids->>(code||':'||option_code))::uuid;
      IF group_id IS NULL OR option_id IS NULL THEN
        RAISE EXCEPTION 'variant selection references unknown option' USING ERRCODE='23514';
      END IF;
      IF pair_count=0 THEN
        selection_key := group_id::text||'='||option_id::text;
      ELSE
        selection_key := selection_key||','||group_id::text||'='||option_id::text;
      END IF;
      pair_count := pair_count+1;
    END LOOP;
    SELECT coalesce(string_agg(
      (group_ids->>item.key)::uuid::text||'='||
      (option_ids->>(item.key||':'||(item.value #>> '{}')))::uuid::text,
      ',' ORDER BY (group_ids->>item.key)::uuid
    ),'base') INTO selection_key
    FROM jsonb_each(selection) AS item;
    INSERT INTO public.product_variants(product_id,sku,active,selection_key)
    VALUES(p_product_id,btrim(v->>'sku'),coalesce((v->>'active')::boolean,true),selection_key)
    RETURNING id INTO variant_id;
    FOR code, option_code IN SELECT key,value #>> '{}' FROM jsonb_each(selection) LOOP
      group_id := (group_ids->>code)::uuid;
      option_id := (option_ids->>(code||':'||option_code))::uuid;
      INSERT INTO public.variant_option_values(variant_id,group_id,option_id,product_id)
      VALUES(variant_id,group_id,option_id,p_product_id);
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_product_variants(uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_product_variants(uuid,jsonb,jsonb) TO authenticated;

-- A signed delta and append-only movement are committed with the versioned
-- balance under a row lock. operation_key makes retries idempotent.
CREATE FUNCTION public.adjust_inventory(
  p_product_id uuid, p_delta integer, p_reason text,
  p_operation_key text, p_expected_version integer
) RETURNS TABLE(on_hand integer, allocated integer, version integer, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_on_hand integer;
  current_allocated integer;
  current_version integer;
  old_quantity integer;
  old_delta integer;
  old_reason text;
  new_on_hand integer;
  inserted_rows integer;
BEGIN
  IF NOT public.require_aal2()
     OR NOT public.has_role(ARRAY['proprietario','operador']::public.admin_role[]) THEN
    RAISE EXCEPTION 'AAL2 inventory authorization required' USING ERRCODE='42501';
  END IF;
  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta=0
     OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500
     OR p_operation_key IS NULL OR length(p_operation_key) NOT BETWEEN 1 AND 100
     OR p_expected_version IS NULL OR p_expected_version<0 THEN
    RAISE EXCEPTION 'invalid inventory adjustment' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=p_product_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'product not found or archived' USING ERRCODE='23503';
  END IF;

  INSERT INTO public.inventory(product_id,on_hand,allocated)
  VALUES(p_product_id,0,0) ON CONFLICT(product_id) DO NOTHING;
  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  SELECT i.on_hand,i.allocated,i.version INTO current_on_hand,current_allocated,current_version
    FROM public.inventory i WHERE i.product_id=p_product_id FOR UPDATE;

  SELECT m.quantity,m.delta_on_hand,m.reason INTO old_quantity,old_delta,old_reason
    FROM public.inventory_movements m
   WHERE m.operation_key=p_operation_key AND m.product_id=p_product_id AND m.kind='adjust';
  IF FOUND THEN
    IF old_quantity<>abs(p_delta) OR old_delta<>p_delta OR old_reason<>trim(p_reason) THEN
      RAISE EXCEPTION 'operation key was already used for a different adjustment' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT current_on_hand,current_allocated,current_version,true;
    RETURN;
  END IF;
  IF (inserted_rows=1 AND p_expected_version<>0)
     OR (inserted_rows=0 AND current_version<>p_expected_version) THEN
    RAISE EXCEPTION 'inventory changed; refresh and retry' USING ERRCODE='40001';
  END IF;
  new_on_hand := current_on_hand+p_delta;
  IF new_on_hand<current_allocated OR new_on_hand<0 THEN
    RAISE EXCEPTION 'adjustment would reduce stock below allocated quantity' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.inventory_movements(product_id,kind,quantity,delta_on_hand,delta_allocated,reason,actor_id,operation_key)
  VALUES(p_product_id,'adjust',abs(p_delta),p_delta,0,trim(p_reason),auth.uid(),p_operation_key);
  UPDATE public.inventory SET on_hand=new_on_hand WHERE product_id=p_product_id;
  RETURN QUERY SELECT i.on_hand,i.allocated,i.version,false FROM public.inventory i WHERE i.product_id=p_product_id;
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_inventory(uuid,integer,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid,integer,text,text,integer) TO authenticated;

CREATE FUNCTION public.set_inventory_minimum(
  p_product_id uuid, p_minimum_on_hand integer, p_expected_version integer
) RETURNS TABLE(minimum_on_hand integer, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_version integer;
  inserted_rows integer;
BEGIN
  IF NOT public.require_aal2()
     OR NOT public.has_role(ARRAY['proprietario','operador']::public.admin_role[]) THEN
    RAISE EXCEPTION 'AAL2 inventory authorization required' USING ERRCODE='42501';
  END IF;
  IF p_product_id IS NULL OR p_minimum_on_hand IS NULL OR p_minimum_on_hand<0
     OR p_expected_version IS NULL OR p_expected_version<0 THEN
    RAISE EXCEPTION 'invalid inventory minimum' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=p_product_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'product not found or archived' USING ERRCODE='23503';
  END IF;
  INSERT INTO public.inventory(product_id,on_hand,allocated)
  VALUES(p_product_id,0,0) ON CONFLICT(product_id) DO NOTHING;
  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  SELECT i.version INTO current_version FROM public.inventory i
    WHERE i.product_id=p_product_id FOR UPDATE;
  IF (inserted_rows=1 AND p_expected_version<>0)
     OR (inserted_rows=0 AND current_version<>p_expected_version) THEN
    RAISE EXCEPTION 'inventory changed; refresh and retry' USING ERRCODE='40001';
  END IF;
  UPDATE public.inventory SET minimum_on_hand=p_minimum_on_hand WHERE product_id=p_product_id;
  RETURN QUERY SELECT i.minimum_on_hand,i.version FROM public.inventory i WHERE i.product_id=p_product_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_inventory_minimum(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_inventory_minimum(uuid,integer,integer) TO authenticated;
COMMIT;
