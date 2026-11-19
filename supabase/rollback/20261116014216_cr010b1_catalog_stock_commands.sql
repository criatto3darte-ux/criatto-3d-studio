-- CR-010B.1 specific rollback. Execute only in a reviewed maintenance window.
-- It deliberately refuses to discard configured non-default stock minimums.
-- No remote use is authorized by this file or by CR-010B.2.
BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.inventory') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='inventory'
          AND column_name='minimum_on_hand'
     ) THEN
    RAISE EXCEPTION 'rollback precondition failed: CR-010B.1 inventory column is absent';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventory WHERE minimum_on_hand <> 0) THEN
    RAISE EXCEPTION 'rollback blocked: non-default inventory minimums exist';
  END IF;
END;
$guard$;

DROP FUNCTION public.set_inventory_minimum(uuid,integer,integer);
DROP FUNCTION public.adjust_inventory(uuid,integer,text,text,integer);
DROP FUNCTION public.replace_product_variants(uuid,jsonb,jsonb);
DROP FUNCTION public.swap_category_order(uuid,integer,uuid,integer);
ALTER TABLE public.inventory DROP COLUMN minimum_on_hand;

COMMIT;
