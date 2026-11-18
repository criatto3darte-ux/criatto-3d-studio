-- CR-014: finance_order_summary bypasses orders RLS (owner-executed view) but
-- did not require MFA. Align it with every other admin read: role + AAL2.
CREATE OR REPLACE VIEW public.finance_order_summary
WITH (security_barrier = true) AS
SELECT id, number, status, subtotal_cents, discount_cents, shipping_cents,
       total_cents, currency, confirmed_at
  FROM public.orders
 WHERE public.has_role(ARRAY['proprietario','financeiro']::public.admin_role[])
   AND public.require_aal2();

REVOKE ALL ON TABLE public.finance_order_summary FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.finance_order_summary TO authenticated, service_role;

COMMENT ON VIEW public.finance_order_summary IS
  'Intentional owner-executed view (CR-013/CR-014): role proprietario/financeiro + AAL2 required.';

DO $v$
BEGIN
  IF pg_get_viewdef('public.finance_order_summary'::regclass) NOT LIKE '%require_aal2()%' THEN
    RAISE EXCEPTION 'CR-014 validation failed: AAL2 check missing';
  END IF;
  IF has_table_privilege('anon', 'public.finance_order_summary', 'SELECT') THEN
    RAISE EXCEPTION 'CR-014 validation failed: anon can read finance_order_summary';
  END IF;
END
$v$;
