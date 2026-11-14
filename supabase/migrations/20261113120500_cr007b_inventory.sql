-- CR-007B: local foundation; no production seed or remote execution.
BEGIN;

CREATE TABLE public.inventory (product_id uuid PRIMARY KEY REFERENCES public.products(id), on_hand integer NOT NULL DEFAULT 0 CHECK(on_hand>=0), allocated integer NOT NULL DEFAULT 0 CHECK(allocated>=0 AND allocated<=on_hand), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE public.inventory_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), product_id uuid NOT NULL REFERENCES public.products(id), order_id uuid REFERENCES public.orders(id), kind varchar(20) NOT NULL CHECK(kind IN ('adjust','allocate','release','consume','return')), quantity integer NOT NULL CHECK(quantity>0), delta_on_hand integer NOT NULL, delta_allocated integer NOT NULL, reason varchar(500) NOT NULL CHECK(length(reason)>0), actor_id uuid REFERENCES auth.users(id), operation_key varchar(100) NOT NULL, UNIQUE(operation_key,product_id,kind), CHECK((kind='adjust' AND abs(delta_on_hand::bigint)=quantity AND delta_allocated=0) OR (kind='allocate' AND delta_on_hand=0 AND delta_allocated=quantity) OR (kind='release' AND delta_on_hand=0 AND delta_allocated=-quantity) OR (kind='consume' AND delta_on_hand=-quantity AND delta_allocated=-quantity) OR (kind='return' AND delta_on_hand=quantity AND delta_allocated=0)));
CREATE TABLE public.order_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), order_item_id uuid NOT NULL UNIQUE, product_id uuid NOT NULL REFERENCES public.products(id), quantity integer NOT NULL CHECK(quantity>0), state varchar(20) NOT NULL DEFAULT 'active' CHECK(state IN ('active','released','consumed')), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0), FOREIGN KEY(order_item_id,product_id) REFERENCES public.order_items(id,product_id));
CREATE INDEX movements_product_idx ON public.inventory_movements(product_id,created_at);
CREATE INDEX movements_order_idx ON public.inventory_movements(order_id);
CREATE INDEX movements_actor_idx ON public.inventory_movements(actor_id);
CREATE INDEX allocations_product_idx ON public.order_allocations(product_id,state);
CREATE INDEX allocations_state_idx ON public.order_allocations(state,updated_at);

REVOKE ALL ON TABLE public.inventory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.inventory TO authenticated;
GRANT ALL ON TABLE public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.inventory FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.inventory_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.inventory_movements TO authenticated;
GRANT ALL ON TABLE public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.inventory_movements FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

REVOKE ALL ON TABLE public.order_allocations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_allocations TO authenticated;
GRANT ALL ON TABLE public.order_allocations TO service_role;
ALTER TABLE public.order_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_allocations FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.order_allocations FOR SELECT TO authenticated USING(public.has_role(ARRAY['proprietario','operador']::public.admin_role[]));

COMMIT;
