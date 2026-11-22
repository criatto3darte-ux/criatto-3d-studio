-- CR-019A: configuração de entrega editável no painel.
--   * shipping_settings (linha única): CEP de origem, retirada, entrega local,
--     chave liga/desliga do Melhor Envio e medidas padrão P/M/G.
--   * local_delivery_zones: regiões de entrega local por faixa de CEP.
--   * products: tamanho padrão (P/M/G) OU peso e medidas próprios.
-- Somente o proprietário com MFA (AAL2) lê e altera as configurações; o
-- checkout (CR-019B) lerá estes dados pelo servidor (service_role).
-- Nada é exposto ao visitante anônimo.
BEGIN;

CREATE TABLE public.shipping_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  origin_cep char(8) NOT NULL DEFAULT '25030058' CHECK (origin_cep ~ '^[0-9]{8}$'),
  pickup_enabled boolean NOT NULL DEFAULT false,
  pickup_address varchar(300) NOT NULL DEFAULT '',
  pickup_hours varchar(200) NOT NULL DEFAULT '',
  local_delivery_enabled boolean NOT NULL DEFAULT false,
  melhor_envio_enabled boolean NOT NULL DEFAULT false,
  size_p_weight_g integer CHECK (size_p_weight_g BETWEEN 1 AND 30000),
  size_p_height_cm integer CHECK (size_p_height_cm BETWEEN 1 AND 200),
  size_p_width_cm integer CHECK (size_p_width_cm BETWEEN 1 AND 200),
  size_p_length_cm integer CHECK (size_p_length_cm BETWEEN 1 AND 200),
  size_m_weight_g integer CHECK (size_m_weight_g BETWEEN 1 AND 30000),
  size_m_height_cm integer CHECK (size_m_height_cm BETWEEN 1 AND 200),
  size_m_width_cm integer CHECK (size_m_width_cm BETWEEN 1 AND 200),
  size_m_length_cm integer CHECK (size_m_length_cm BETWEEN 1 AND 200),
  size_g_weight_g integer CHECK (size_g_weight_g BETWEEN 1 AND 30000),
  size_g_height_cm integer CHECK (size_g_height_cm BETWEEN 1 AND 200),
  size_g_width_cm integer CHECK (size_g_width_cm BETWEEN 1 AND 200),
  size_g_length_cm integer CHECK (size_g_length_cm BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT shipping_pickup_address_check
    CHECK (NOT pickup_enabled OR length(btrim(pickup_address)) > 0),
  CONSTRAINT shipping_size_p_complete CHECK (num_nulls(size_p_weight_g, size_p_height_cm, size_p_width_cm, size_p_length_cm) IN (0, 4)),
  CONSTRAINT shipping_size_m_complete CHECK (num_nulls(size_m_weight_g, size_m_height_cm, size_m_width_cm, size_m_length_cm) IN (0, 4)),
  CONSTRAINT shipping_size_g_complete CHECK (num_nulls(size_g_weight_g, size_g_height_cm, size_g_width_cm, size_g_length_cm) IN (0, 4))
);
INSERT INTO public.shipping_settings (id) VALUES (1);

CREATE TABLE public.local_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL CHECK (length(btrim(name)) > 0),
  cep_start char(8) NOT NULL CHECK (cep_start ~ '^[0-9]{8}$'),
  cep_end char(8) NOT NULL CHECK (cep_end ~ '^[0-9]{8}$'),
  price_cents bigint NOT NULL CHECK (price_cents BETWEEN 0 AND 10000000),
  delivery_days integer NOT NULL DEFAULT 1 CHECK (delivery_days BETWEEN 0 AND 30),
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT local_delivery_zone_range CHECK (cep_start <= cep_end)
);
CREATE INDEX local_delivery_zones_lookup_idx
  ON public.local_delivery_zones (active, cep_start, cep_end);

ALTER TABLE public.products
  ADD COLUMN shipping_size char(1) CHECK (shipping_size IN ('P', 'M', 'G')),
  ADD COLUMN weight_g integer CHECK (weight_g BETWEEN 1 AND 30000),
  ADD COLUMN height_cm integer CHECK (height_cm BETWEEN 1 AND 200),
  ADD COLUMN width_cm integer CHECK (width_cm BETWEEN 1 AND 200),
  ADD COLUMN length_cm integer CHECK (length_cm BETWEEN 1 AND 200),
  ADD CONSTRAINT products_shipping_profile_check CHECK (
    num_nulls(weight_g, height_cm, width_cm, length_cm) IN (0, 4)
    AND (shipping_size IS NULL OR weight_g IS NULL)
  );

CREATE TRIGGER version_stamp BEFORE UPDATE ON public.shipping_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_version();
CREATE TRIGGER version_stamp BEFORE UPDATE ON public.local_delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.touch_version();

REVOKE ALL ON TABLE public.shipping_settings, public.local_delivery_zones
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shipping_settings, public.local_delivery_zones TO service_role;
GRANT SELECT, UPDATE ON TABLE public.shipping_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.local_delivery_zones TO authenticated;

ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.local_delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_delivery_zones FORCE ROW LEVEL SECURITY;

CREATE POLICY shipping_owner_read ON public.shipping_settings FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['proprietario']::public.admin_role[]) AND public.require_aal2());
CREATE POLICY shipping_owner_update ON public.shipping_settings FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['proprietario']::public.admin_role[]) AND public.require_aal2())
  WITH CHECK (public.has_role(ARRAY['proprietario']::public.admin_role[]) AND public.require_aal2());
CREATE POLICY zones_owner_all ON public.local_delivery_zones FOR ALL TO authenticated
  USING (public.has_role(ARRAY['proprietario']::public.admin_role[]) AND public.require_aal2())
  WITH CHECK (public.has_role(ARRAY['proprietario']::public.admin_role[]) AND public.require_aal2());

DO $validation$
BEGIN
  IF has_table_privilege('anon', 'public.shipping_settings', 'SELECT')
     OR has_table_privilege('anon', 'public.local_delivery_zones', 'SELECT') THEN
    RAISE EXCEPTION 'CR-019A validation failed: anon can read shipping configuration';
  END IF;
  IF has_table_privilege('authenticated', 'public.shipping_settings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.shipping_settings', 'DELETE') THEN
    RAISE EXCEPTION 'CR-019A validation failed: shipping_settings must stay a single row';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shipping_settings WHERE id = 1 AND origin_cep = '25030058') THEN
    RAISE EXCEPTION 'CR-019A validation failed: default shipping settings missing';
  END IF;
END
$validation$;

COMMIT;
