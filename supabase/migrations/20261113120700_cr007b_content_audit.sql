-- CR-007B: local foundation; no production seed or remote execution.
BEGIN;

CREATE FUNCTION public.safe_public_url(value text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$ SELECT value IS NOT NULL AND value !~ '%' AND value !~ '[[:space:]\\]' AND (value ~ '^/[^/\\]' OR value='/' OR value ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?(/|$)') $$;
REVOKE ALL ON FUNCTION public.safe_public_url(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.safe_public_url(text) TO authenticated,service_role;
CREATE TABLE public.banners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), title varchar(80) NOT NULL, highlight varchar(80) NOT NULL DEFAULT '', subtitle varchar(160) NOT NULL DEFAULT '', media_id uuid REFERENCES public.media_assets(id), button_text varchar(100) NOT NULL, button_url varchar(2000) NOT NULL CHECK(public.safe_public_url(button_url)), display_order integer NOT NULL DEFAULT 0 CHECK(display_order>=0), active boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0), CHECK(length(title)+length(highlight)<=80));
CREATE TABLE public.store_settings (id smallint PRIMARY KEY CHECK(id=1), name varchar(100) NOT NULL, logo_media_id uuid REFERENCES public.media_assets(id), whatsapp_number varchar(20) NOT NULL CHECK(whatsapp_number ~ '^55[1-9]{2}9?[0-9]{8}$'), public_email varchar(254) CHECK(public_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'), social_links jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(social_links)='object'), address varchar(500), delivery_info varchar(500) NOT NULL DEFAULT '', offers_national_shipping boolean NOT NULL DEFAULT false, service_message varchar(500) NOT NULL DEFAULT '', canonical_origin varchar(500) CHECK(canonical_origin ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$'), privacy_notice_version varchar(100) NOT NULL, timezone varchar(100) NOT NULL DEFAULT 'America/Sao_Paulo', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE public.admin_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), actor_id uuid REFERENCES auth.users(id), action varchar(100) NOT NULL, entity_type varchar(100) NOT NULL, entity_id uuid, request_id uuid NOT NULL, operation_key varchar(100), occurred_at timestamptz NOT NULL DEFAULT now(), safe_before jsonb, safe_after jsonb, reason varchar(500) NOT NULL);
CREATE INDEX banners_public_idx ON public.banners(active,display_order,id);
CREATE INDEX banners_media_idx ON public.banners(media_id);
CREATE INDEX settings_logo_idx ON public.store_settings(logo_media_id);
CREATE INDEX audit_entity_idx ON public.admin_audit_events(entity_type,entity_id,occurred_at);
CREATE INDEX audit_actor_idx ON public.admin_audit_events(actor_id,occurred_at);
CREATE INDEX audit_request_idx ON public.admin_audit_events(request_id);

REVOKE ALL ON TABLE public.banners FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.banners TO authenticated;
GRANT ALL ON TABLE public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.banners FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario']::public.admin_role[]));

REVOKE ALL ON TABLE public.store_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.store_settings TO authenticated;
GRANT ALL ON TABLE public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.store_settings FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario']::public.admin_role[]));

REVOKE ALL ON TABLE public.admin_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_audit_events TO authenticated;
GRANT ALL ON TABLE public.admin_audit_events TO service_role;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.admin_audit_events FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario']::public.admin_role[]));

GRANT INSERT,UPDATE,DELETE ON public.banners,public.store_settings TO authenticated;
CREATE POLICY banner_editor ON public.banners FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario','editor']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario','editor']::public.admin_role[]));
CREATE POLICY settings_owner ON public.store_settings FOR ALL TO authenticated USING(public.has_role(ARRAY['proprietario']::public.admin_role[])) WITH CHECK(public.has_role(ARRAY['proprietario']::public.admin_role[]));
COMMIT;
