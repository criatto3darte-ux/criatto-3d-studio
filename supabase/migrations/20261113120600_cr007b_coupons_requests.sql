-- CR-007B: local foundation; no production seed or remote execution.
BEGIN;

CREATE TABLE public.coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), code varchar(20) NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9]{3,20}$'), kind varchar(20) NOT NULL CHECK(kind IN ('percentual','fixo')), value bigint NOT NULL CHECK(value BETWEEN 1 AND 9007199254740991), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT false, usage_limit integer CHECK(usage_limit>0), min_subtotal_cents bigint CHECK(min_subtotal_cents BETWEEN 0 AND 9007199254740991), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0), CHECK(ends_at>=starts_at), CHECK(kind<>'percentual' OR value<=100));
CREATE TABLE public.coupon_redemptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), coupon_id uuid NOT NULL REFERENCES public.coupons(id), order_id uuid NOT NULL REFERENCES public.orders(id), discount_cents bigint NOT NULL CHECK(discount_cents BETWEEN 0 AND 9007199254740991), state varchar(20) NOT NULL CHECK(state IN ('held','consumed','released')), expires_at timestamptz, UNIQUE(coupon_id,order_id));
CREATE TABLE public.custom_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), customer_id uuid REFERENCES public.customers(id), customer_name_snapshot varchar(100) NOT NULL, customer_phone_snapshot varchar(16) NOT NULL CHECK(customer_phone_snapshot ~ '^\+[1-9][0-9]{7,14}$'), description varchar(1000) NOT NULL, dimensions jsonb, colors varchar(120) NOT NULL DEFAULT '', quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 999), notes varchar(500) NOT NULL DEFAULT '', status public.request_status NOT NULL DEFAULT 'recebida', quote_cents bigint CHECK(quote_cents BETWEEN 1 AND 9007199254740991), quote_version integer NOT NULL DEFAULT 1 CHECK(quote_version>0), idempotency_key uuid NOT NULL UNIQUE, payload_hash varchar(64) NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE public.custom_request_images (request_id uuid NOT NULL REFERENCES public.custom_requests(id), media_id uuid NOT NULL REFERENCES public.media_assets(id), position integer NOT NULL CHECK(position>=0), PRIMARY KEY(request_id,media_id), UNIQUE(request_id,position));
CREATE TABLE public.custom_request_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), request_id uuid NOT NULL REFERENCES public.custom_requests(id), from_status public.request_status, to_status public.request_status NOT NULL, quote_cents bigint CHECK(quote_cents BETWEEN 1 AND 9007199254740991), actor_id uuid REFERENCES auth.users(id), occurred_at timestamptz NOT NULL DEFAULT now(), note varchar(500) NOT NULL DEFAULT '', operation_key varchar(100) NOT NULL, UNIQUE(request_id,operation_key));
CREATE INDEX coupons_window_idx ON public.coupons(code,active,starts_at,ends_at);
CREATE INDEX redemptions_coupon_idx ON public.coupon_redemptions(coupon_id,state);
CREATE INDEX redemptions_order_idx ON public.coupon_redemptions(order_id);
CREATE INDEX redemptions_expiry_idx ON public.coupon_redemptions(state,expires_at);
CREATE INDEX requests_customer_idx ON public.custom_requests(customer_id);
CREATE INDEX requests_status_idx ON public.custom_requests(status,created_at,id);
CREATE INDEX request_images_media_idx ON public.custom_request_images(media_id);
CREATE INDEX request_history_idx ON public.custom_request_history(request_id,occurred_at);
CREATE INDEX request_history_actor_idx ON public.custom_request_history(actor_id);

REVOKE ALL ON TABLE public.coupons FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.coupons TO authenticated;
GRANT ALL ON TABLE public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.coupons FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.coupon_redemptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.coupon_redemptions TO authenticated;
GRANT ALL ON TABLE public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.coupon_redemptions FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.custom_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.custom_requests TO authenticated;
GRANT ALL ON TABLE public.custom_requests TO service_role;
ALTER TABLE public.custom_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.custom_requests FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.custom_request_images FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.custom_request_images TO authenticated;
GRANT ALL ON TABLE public.custom_request_images TO service_role;
ALTER TABLE public.custom_request_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_request_images FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.custom_request_images FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.custom_request_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.custom_request_history TO authenticated;
GRANT ALL ON TABLE public.custom_request_history TO service_role;
ALTER TABLE public.custom_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_request_history FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.custom_request_history FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

GRANT INSERT,UPDATE,DELETE ON public.coupons TO authenticated;
CREATE POLICY coupon_editor ON public.coupons FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
COMMIT;
