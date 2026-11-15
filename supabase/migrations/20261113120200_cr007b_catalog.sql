-- CR-007B: local foundation; no production seed or remote execution.
BEGIN;

CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), slug varchar(60) NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), name varchar(100) NOT NULL CHECK(length(name)>0), description varchar(5000) NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT false, display_order integer NOT NULL DEFAULT 0 CHECK(display_order>=0), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), category_id uuid NOT NULL REFERENCES public.categories(id), slug varchar(60) NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), name varchar(100) NOT NULL CHECK(length(name)>0), description varchar(10000) NOT NULL DEFAULT '', tags text[] NOT NULL DEFAULT '{}', regular_price_cents bigint NOT NULL CHECK(regular_price_cents BETWEEN 0 AND 9007199254740991), promo_price_cents bigint, effective_price_cents bigint GENERATED ALWAYS AS (coalesce(promo_price_cents,regular_price_cents)) STORED, production_mode public.production_mode NOT NULL, production_days integer CHECK(production_days>0), active boolean NOT NULL DEFAULT false, featured boolean NOT NULL DEFAULT false, badge varchar(30) CHECK(badge IN ('novo','destaque','promocao')), archived_at timestamptz, internal_notes varchar(5000) NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0), CHECK(regular_price_cents>0), CHECK(promo_price_cents IS NULL OR promo_price_cents>0 AND promo_price_cents<regular_price_cents), CHECK(production_mode<>'sob-demanda' OR production_days IS NOT NULL));
CREATE TABLE public.product_attribute_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), product_id uuid NOT NULL REFERENCES public.products(id), code varchar(60) NOT NULL CHECK(code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), label varchar(100) NOT NULL, position integer NOT NULL DEFAULT 0 CHECK(position>=0), required boolean NOT NULL DEFAULT true, UNIQUE(product_id,code), UNIQUE(id,product_id));
CREATE TABLE public.product_attribute_options (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), group_id uuid NOT NULL REFERENCES public.product_attribute_groups(id), code varchar(60) NOT NULL, label varchar(100) NOT NULL, active boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0 CHECK(position>=0), UNIQUE(group_id,code), UNIQUE(id,group_id));
CREATE TABLE public.product_variants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), product_id uuid NOT NULL REFERENCES public.products(id), sku varchar(100) NOT NULL UNIQUE, active boolean NOT NULL DEFAULT false, selection_key varchar(2000) NOT NULL, UNIQUE(product_id,selection_key), UNIQUE(id,product_id));
CREATE TABLE public.variant_option_values (variant_id uuid NOT NULL, group_id uuid NOT NULL, option_id uuid NOT NULL, product_id uuid NOT NULL, PRIMARY KEY(variant_id,group_id), FOREIGN KEY(variant_id,product_id) REFERENCES public.product_variants(id,product_id), FOREIGN KEY(group_id,product_id) REFERENCES public.product_attribute_groups(id,product_id), FOREIGN KEY(option_id,group_id) REFERENCES public.product_attribute_options(id,group_id));
CREATE INDEX categories_public_idx ON public.categories(active,display_order,id);
CREATE INDEX products_category_idx ON public.products(category_id,active,id);
CREATE INDEX products_price_idx ON public.products(effective_price_cents,id);
CREATE INDEX groups_product_idx ON public.product_attribute_groups(product_id,position);
CREATE INDEX options_group_idx ON public.product_attribute_options(group_id,active,position);
CREATE INDEX variants_product_idx ON public.product_variants(product_id,active);
CREATE INDEX variant_values_option_idx ON public.variant_option_values(option_id,group_id);
CREATE INDEX variant_values_group_idx ON public.variant_option_values(group_id,product_id);

REVOKE ALL ON TABLE public.categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.categories FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
CREATE POLICY admin_write ON public.categories FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

REVOKE ALL ON TABLE public.products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.products FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
CREATE POLICY admin_write ON public.products FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

REVOKE ALL ON TABLE public.product_attribute_groups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.product_attribute_groups TO authenticated;
GRANT ALL ON TABLE public.product_attribute_groups TO service_role;
ALTER TABLE public.product_attribute_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.product_attribute_groups FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.product_attribute_groups TO authenticated;
CREATE POLICY admin_write ON public.product_attribute_groups FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

REVOKE ALL ON TABLE public.product_attribute_options FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.product_attribute_options TO authenticated;
GRANT ALL ON TABLE public.product_attribute_options TO service_role;
ALTER TABLE public.product_attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_options FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.product_attribute_options FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.product_attribute_options TO authenticated;
CREATE POLICY admin_write ON public.product_attribute_options FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

REVOKE ALL ON TABLE public.product_variants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.product_variants TO authenticated;
GRANT ALL ON TABLE public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.product_variants FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
CREATE POLICY admin_write ON public.product_variants FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

REVOKE ALL ON TABLE public.variant_option_values FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.variant_option_values TO authenticated;
GRANT ALL ON TABLE public.variant_option_values TO service_role;
ALTER TABLE public.variant_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_option_values FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.variant_option_values FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.variant_option_values TO authenticated;
CREATE POLICY admin_write ON public.variant_option_values FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

COMMIT;
