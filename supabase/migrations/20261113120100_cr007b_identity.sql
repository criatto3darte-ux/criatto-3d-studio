-- CR-007B: local foundation; no production seed or remote execution.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

CREATE TYPE public.admin_role AS ENUM ('proprietario','editor','operador','financeiro');
CREATE TYPE public.production_mode AS ENUM ('pronta-entrega','sob-demanda');
CREATE TYPE public.order_status AS ENUM ('aguardando-contato','em-atendimento','confirmado','em-producao','pronto-para-entrega','enviado','concluido','cancelado');
CREATE TYPE public.request_status AS ENUM ('recebida','em-analise','orcamento-enviado','aprovado','em-producao','concluido','cancelado');
CREATE TABLE public.admin_profiles (user_id uuid PRIMARY KEY REFERENCES auth.users(id), display_name varchar(100) NOT NULL CHECK(length(display_name)>0), active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), user_id uuid NOT NULL REFERENCES auth.users(id), role public.admin_role NOT NULL, granted_by uuid REFERENCES auth.users(id), UNIQUE(user_id,role));
CREATE INDEX user_roles_granted_by_idx ON public.user_roles(granted_by);
CREATE INDEX user_roles_role_user_idx ON public.user_roles(role,user_id);
CREATE FUNCTION public.has_role(allowed public.admin_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT EXISTS (SELECT 1 FROM public.admin_profiles p JOIN public.user_roles r ON r.user_id=p.user_id WHERE p.user_id=auth.uid() AND p.active AND r.role=ANY(allowed));
$$;
REVOKE ALL ON FUNCTION public.has_role(public.admin_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(public.admin_role[]) TO authenticated, service_role;
-- Ownership must remain with the migration owner (BYPASSRLS), never authenticated.

REVOKE ALL ON TABLE public.admin_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_profiles TO authenticated;
GRANT ALL ON TABLE public.admin_profiles TO service_role;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.admin_profiles FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario']::public.admin_role[]));

REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.user_roles FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario']::public.admin_role[]));

COMMIT;
