-- CR-007B: explicit projections; transaction commands remain disabled pending approval.
BEGIN;
CREATE FUNCTION public.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'append-only relation: %', TG_TABLE_NAME USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION public.reject_mutation() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['order_items','order_status_history','payments','inventory_movements','custom_request_history','admin_audit_events'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_event BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_mutation()',t);
 -- TRUNCATE does not fire row triggers; protect it even from the trusted server role.
 EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.reject_mutation()',t);
 EXECUTE format('REVOKE UPDATE,DELETE,TRUNCATE ON public.%I FROM service_role, authenticated',t);
 END LOOP;
END $$;
CREATE FUNCTION public.touch_version() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at=clock_timestamp(); NEW.version=OLD.version+1; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.touch_version() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['admin_profiles','categories','products','media_assets','customers','orders','inventory','order_allocations','coupons','custom_requests','banners','store_settings'] LOOP
 EXECUTE format('CREATE TRIGGER version_stamp BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_version()',t);
 END LOOP;
END $$;
-- Deferrable validation allows editing a complete variant in a single transaction.
CREATE FUNCTION public.check_variant_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF EXISTS (
 SELECT 1 FROM public.product_variants v WHERE v.active AND (
 EXISTS(SELECT 1 FROM public.product_attribute_groups g WHERE g.product_id=v.product_id AND g.required AND NOT EXISTS(SELECT 1 FROM public.variant_option_values x WHERE x.variant_id=v.id AND x.group_id=g.id))
 OR EXISTS(SELECT 1 FROM public.variant_option_values x JOIN public.product_attribute_options o ON o.id=x.option_id WHERE x.variant_id=v.id AND NOT o.active)
 OR v.selection_key <> coalesce((SELECT string_agg(x.group_id::text||'='||x.option_id::text,',' ORDER BY x.group_id) FROM public.variant_option_values x WHERE x.variant_id=v.id),'base')
 )) THEN RAISE EXCEPTION 'invalid active variant selection' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.check_variant_integrity() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['product_variants','product_attribute_groups','product_attribute_options','variant_option_values'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER valid_variant AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_variant_integrity()',t);
 END LOOP;
END $$;
-- No self-service role mutation; bootstrap is an explicit trusted operation, never a seed.
CREATE FUNCTION public.protect_last_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF current_setting('transaction_isolation')='repeatable read' THEN
 RAISE EXCEPTION 'identity changes require read committed or serializable' USING ERRCODE='0A000'; END IF;
 PERFORM pg_advisory_xact_lock(7007,2);
 IF TG_TABLE_NAME='user_roles' THEN
  IF OLD.role<>'proprietario' THEN RETURN NULL; END IF;
 ELSE
  IF NOT OLD.active THEN RETURN NULL; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_profiles p JOIN public.user_roles r ON r.user_id=p.user_id WHERE p.active AND r.role='proprietario') THEN
 RAISE EXCEPTION 'cannot remove last active owner' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.protect_last_owner() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER last_profile_owner AFTER UPDATE OR DELETE ON public.admin_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();
CREATE CONSTRAINT TRIGGER last_role_owner AFTER UPDATE OR DELETE ON public.user_roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();
CREATE FUNCTION public.check_private_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.custom_request_images x JOIN public.media_assets m ON m.id=x.media_id WHERE m.state='published') OR EXISTS(SELECT 1 FROM public.payments p JOIN public.media_assets m ON m.id=p.evidence_media_id WHERE m.state='published') THEN
 RAISE EXCEPTION 'private attachment cannot be published' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.check_private_media() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['media_assets','custom_request_images','payments'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER private_attachment AFTER INSERT OR UPDATE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_private_media()',t);
 END LOOP;
END $$;
CREATE FUNCTION public.validate_social_links() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE k text; v jsonb;
BEGIN
 FOR k,v IN SELECT * FROM jsonb_each(NEW.social_links) LOOP
 IF k NOT IN ('instagram','facebook','youtube','tiktok') OR jsonb_typeof(v)<>'string' OR NOT public.safe_public_url(v #>> '{}') OR (v #>> '{}') !~ '^https://' OR length(v #>> '{}')>2000 OR
 (v #>> '{}') !~ ('^https://(www[.])?' || CASE k WHEN 'instagram' THEN 'instagram[.]com' WHEN 'facebook' THEN 'facebook[.]com' WHEN 'youtube' THEN 'youtube[.]com' WHEN 'tiktok' THEN 'tiktok[.]com' ELSE 'invalid[.]invalid' END || '/[^[:space:]]*$') THEN
 RAISE EXCEPTION 'invalid social link' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_social_links() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER settings_links BEFORE INSERT OR UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.validate_social_links();
-- Deliberately owner-executed security-barrier views: base tables have NO anon grants.
-- These are closed projections, no SELECT *, no user SQL and no private columns.
-- Keep their owner the migration owner; do not make them security_invoker without redesigning grants.
CREATE VIEW public.public_categories WITH (security_barrier=true) AS
 SELECT id,slug,name,description,display_order FROM public.categories WHERE active;
CREATE VIEW public.public_products WITH (security_barrier=true) AS
 SELECT p.id,p.category_id,p.slug,p.name,p.description,p.tags,p.regular_price_cents,p.promo_price_cents,p.effective_price_cents,p.production_mode,p.production_days,p.featured,p.badge
 FROM public.products p JOIN public.public_categories c ON c.id=p.category_id WHERE p.active AND p.archived_at IS NULL;
CREATE VIEW public.public_attribute_groups WITH (security_barrier=true) AS
 SELECT g.id,g.product_id,g.code,g.label,g.position,g.required FROM public.product_attribute_groups g JOIN public.public_products p ON p.id=g.product_id;
CREATE VIEW public.public_attribute_options WITH (security_barrier=true) AS
 SELECT o.id,o.group_id,o.code,o.label,o.position FROM public.product_attribute_options o JOIN public.public_attribute_groups g ON g.id=o.group_id WHERE o.active;
CREATE VIEW public.public_variants WITH (security_barrier=true) AS
 SELECT v.id,v.product_id,v.sku,v.selection_key FROM public.product_variants v JOIN public.public_products p ON p.id=v.product_id WHERE v.active;
CREATE VIEW public.public_variant_options WITH (security_barrier=true) AS
 SELECT x.variant_id,x.group_id,x.option_id FROM public.variant_option_values x JOIN public.public_variants v ON v.id=x.variant_id JOIN public.public_attribute_options o ON o.id=x.option_id;
CREATE VIEW public.public_product_images WITH (security_barrier=true) AS
 SELECT i.product_id,i.media_id,i.position,i.is_primary,m.alt,m.width,m.height
 FROM public.product_images i JOIN public.public_products p ON p.id=i.product_id JOIN public.media_assets m ON m.id=i.media_id WHERE m.state='published';
CREATE VIEW public.public_category_images WITH (security_barrier=true) AS
 SELECT i.category_id,i.media_id,m.alt,m.width,m.height FROM public.category_images i JOIN public.public_categories c ON c.id=i.category_id JOIN public.media_assets m ON m.id=i.media_id WHERE m.state='published';
CREATE VIEW public.public_banners WITH (security_barrier=true) AS
 SELECT b.id,b.title,b.highlight,b.subtitle,b.button_text,b.button_url,b.display_order,b.media_id
 FROM public.banners b LEFT JOIN public.media_assets m ON m.id=b.media_id WHERE b.active AND (b.media_id IS NULL OR m.state='published');
CREATE VIEW public.public_store_settings WITH (security_barrier=true) AS
 SELECT s.id,s.name,CASE WHEN m.state='published' THEN s.logo_media_id END AS logo_media_id,s.whatsapp_number,s.public_email,s.social_links,s.address,s.delivery_info,s.offers_national_shipping,s.service_message,s.canonical_origin,s.timezone
 FROM public.store_settings s LEFT JOIN public.media_assets m ON m.id=s.logo_media_id;
CREATE VIEW public.public_availability WITH (security_barrier=true) AS
 SELECT i.product_id,(i.on_hand>i.allocated) AS available FROM public.inventory i JOIN public.public_products p ON p.id=i.product_id;
CREATE VIEW public.finance_order_summary WITH (security_barrier=true) AS
 SELECT id,number,status,subtotal_cents,discount_cents,shipping_cents,total_cents,currency,confirmed_at
 FROM public.orders WHERE public.has_role(ARRAY['proprietario','financeiro']::public.admin_role[]);
REVOKE ALL ON public.finance_order_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.finance_order_summary TO authenticated;
DO $$ DECLARE v text; BEGIN
 FOREACH v IN ARRAY ARRAY['public_categories','public_products','public_attribute_groups','public_attribute_options','public_variants','public_variant_options','public_product_images','public_category_images','public_banners','public_store_settings','public_availability'] LOOP
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',v);
 EXECUTE format('GRANT SELECT ON public.%I TO anon,authenticated,service_role',v);
 END LOOP;
END $$;
CREATE POLICY own_profile ON public.admin_profiles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_roles ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TRIGGER no_profile_truncate BEFORE TRUNCATE ON public.admin_profiles FOR EACH STATEMENT EXECUTE FUNCTION public.reject_mutation();
CREATE TRIGGER no_role_truncate BEFORE TRUNCATE ON public.user_roles FOR EACH STATEMENT EXECUTE FUNCTION public.reject_mutation();
REVOKE TRUNCATE ON public.admin_profiles,public.user_roles FROM service_role;
-- No payment command is exposed. Even a trusted future writer must use a confirmed order.
CREATE FUNCTION public.check_payment_order() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE o public.orders;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=NEW.order_id FOR UPDATE;
 IF o.status NOT IN ('confirmado','em-producao','pronto-para-entrega','enviado','concluido') OR o.total_cents IS NULL THEN
 RAISE EXCEPTION 'payment requires confirmed order and final total' USING ERRCODE='23514'; END IF;
 IF NEW.related_payment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.payments WHERE id=NEW.related_payment_id AND order_id=NEW.order_id) THEN
 RAISE EXCEPTION 'related payment must belong to order' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.check_payment_order() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER payment_order BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.check_payment_order();
CREATE FUNCTION public.check_allocation() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.products p JOIN public.order_items i ON i.product_id=p.id WHERE i.id=NEW.order_item_id AND (p.production_mode='sob-demanda' OR NEW.quantity>i.quantity)) THEN
 RAISE EXCEPTION 'allocation requires ready stock and item quantity bound' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.check_allocation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER allocation_bounds BEFORE INSERT OR UPDATE ON public.order_allocations FOR EACH ROW EXECUTE FUNCTION public.check_allocation();

COMMIT;
