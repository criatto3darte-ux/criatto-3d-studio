-- CR-007B: local foundation; no production seed or remote execution.
BEGIN;

CREATE TABLE public.media_assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), bucket varchar(100) NOT NULL, object_key varchar(1000) NOT NULL, mime varchar(100) NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp','image/avif')), byte_size bigint NOT NULL CHECK(byte_size>0), width integer NOT NULL CHECK(width>0), height integer NOT NULL CHECK(height>0), checksum varchar(128) NOT NULL, alt varchar(200) NOT NULL DEFAULT '', state varchar(20) NOT NULL DEFAULT 'staging' CHECK(state IN ('staging','verified','published','delete-pending')), created_by uuid REFERENCES auth.users(id), derivatives jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0), UNIQUE(bucket,object_key));
CREATE TABLE public.product_images (product_id uuid NOT NULL REFERENCES public.products(id), media_id uuid NOT NULL REFERENCES public.media_assets(id), position integer NOT NULL CHECK(position>=0), is_primary boolean NOT NULL DEFAULT false, PRIMARY KEY(product_id,media_id), UNIQUE(product_id,position));
CREATE UNIQUE INDEX product_primary_idx ON public.product_images(product_id) WHERE is_primary;
CREATE INDEX product_images_media_idx ON public.product_images(media_id);
CREATE TABLE public.category_images (category_id uuid PRIMARY KEY REFERENCES public.categories(id), media_id uuid NOT NULL REFERENCES public.media_assets(id));
CREATE INDEX category_images_media_idx ON public.category_images(media_id);
CREATE INDEX media_state_idx ON public.media_assets(state,created_at,id);
CREATE INDEX media_creator_idx ON public.media_assets(created_by);

REVOKE ALL ON TABLE public.media_assets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.media_assets TO authenticated;
GRANT ALL ON TABLE public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.media_assets FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
CREATE POLICY admin_write ON public.media_assets FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

REVOKE ALL ON TABLE public.product_images FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.product_images TO authenticated;
GRANT ALL ON TABLE public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.product_images FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
CREATE POLICY admin_write ON public.product_images FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

REVOKE ALL ON TABLE public.category_images FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.category_images TO authenticated;
GRANT ALL ON TABLE public.category_images TO service_role;
ALTER TABLE public.category_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_images FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.category_images FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
GRANT INSERT, UPDATE, DELETE ON public.category_images TO authenticated;
CREATE POLICY admin_write ON public.category_images FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));

COMMIT;
