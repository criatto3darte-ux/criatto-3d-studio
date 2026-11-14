-- CR-007B: local foundation; no production seed or remote execution.
BEGIN;

CREATE TABLE public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), name varchar(100) NOT NULL CHECK(length(name)>0), phone_e164 varchar(16) NOT NULL CHECK(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'), notes varchar(5000) NOT NULL DEFAULT '', anonymized_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), number bigint GENERATED ALWAYS AS IDENTITY UNIQUE, customer_id uuid REFERENCES public.customers(id), customer_name_snapshot varchar(100) NOT NULL, customer_phone_snapshot varchar(16) NOT NULL CHECK(customer_phone_snapshot ~ '^\+[1-9][0-9]{7,14}$'), status public.order_status NOT NULL DEFAULT 'aguardando-contato', subtotal_cents bigint NOT NULL CHECK(subtotal_cents BETWEEN 0 AND 9007199254740991), discount_cents bigint NOT NULL CHECK(discount_cents BETWEEN 0 AND 9007199254740991), shipping_cents bigint CHECK(shipping_cents BETWEEN 0 AND 9007199254740991), total_cents bigint CHECK(total_cents BETWEEN 0 AND 9007199254740991), notes varchar(500) NOT NULL DEFAULT '', currency char(3) NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'), idempotency_key uuid NOT NULL UNIQUE, payload_hash varchar(64) NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), confirmed_at timestamptz, privacy_notice_version varchar(100) NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0), CHECK(discount_cents<=subtotal_cents), CHECK((shipping_cents IS NULL AND total_cents IS NULL) OR (shipping_cents IS NOT NULL AND total_cents IS NOT NULL AND total_cents=subtotal_cents-discount_cents+shipping_cents)));
CREATE TABLE public.order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), order_id uuid NOT NULL REFERENCES public.orders(id), product_id uuid REFERENCES public.products(id), variant_id uuid, product_name_snapshot varchar(100) NOT NULL, sku_snapshot varchar(100), attributes_snapshot jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(attributes_snapshot)='object'), unit_price_cents bigint NOT NULL CHECK(unit_price_cents BETWEEN 0 AND 9007199254740991), quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 999), line_discount_cents bigint NOT NULL CHECK(line_discount_cents BETWEEN 0 AND 9007199254740991), CHECK(unit_price_cents>0), CHECK(line_discount_cents<=unit_price_cents::numeric*quantity), CHECK(variant_id IS NULL OR product_id IS NOT NULL), FOREIGN KEY(variant_id,product_id) REFERENCES public.product_variants(id,product_id), UNIQUE(id,product_id));
CREATE TABLE public.order_status_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), order_id uuid NOT NULL REFERENCES public.orders(id), from_status public.order_status, to_status public.order_status NOT NULL, actor_id uuid REFERENCES auth.users(id), occurred_at timestamptz NOT NULL DEFAULT now(), note varchar(500) NOT NULL DEFAULT '', operation_key varchar(100) NOT NULL, UNIQUE(order_id,operation_key));
CREATE TABLE public.payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), order_id uuid NOT NULL REFERENCES public.orders(id), amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 9007199254740991), kind varchar(20) NOT NULL CHECK(kind IN ('receipt','refund','correction')), method varchar(100) NOT NULL, reference varchar(200), evidence_media_id uuid REFERENCES public.media_assets(id), confirmed_by uuid NOT NULL REFERENCES auth.users(id), confirmed_at timestamptz NOT NULL DEFAULT now(), operation_key uuid NOT NULL UNIQUE, related_payment_id uuid REFERENCES public.payments(id), CHECK(amount_cents>0));
CREATE INDEX customers_phone_idx ON public.customers(phone_e164);
CREATE INDEX orders_status_idx ON public.orders(status,created_at,id);
CREATE INDEX orders_customer_idx ON public.orders(customer_id,created_at);
CREATE INDEX orders_confirmed_idx ON public.orders(confirmed_at);
CREATE INDEX items_order_idx ON public.order_items(order_id);
CREATE INDEX items_product_idx ON public.order_items(product_id);
CREATE INDEX items_variant_idx ON public.order_items(variant_id,product_id);
CREATE INDEX history_order_idx ON public.order_status_history(order_id,occurred_at,id);
CREATE INDEX history_actor_idx ON public.order_status_history(actor_id);
CREATE INDEX payments_order_idx ON public.payments(order_id,confirmed_at);
CREATE INDEX payments_evidence_idx ON public.payments(evidence_media_id);
CREATE INDEX payments_actor_idx ON public.payments(confirmed_by);
CREATE INDEX payments_related_idx ON public.payments(related_payment_id);

REVOKE ALL ON TABLE public.customers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.customers FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.orders FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.order_items FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.order_status_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_status_history TO authenticated;
GRANT ALL ON TABLE public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.order_status_history FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.payments FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

CREATE POLICY finance_read ON public.payments FOR SELECT TO authenticated USING(public.has_role(ARRAY['financeiro']::public.admin_role[]));
GRANT USAGE ON SEQUENCE public.orders_number_seq TO service_role;
REVOKE ALL ON SEQUENCE public.orders_number_seq FROM PUBLIC, anon, authenticated;
COMMIT;
