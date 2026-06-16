-- Phase F prep: tighten dd_mandates customer access and protect final submission idempotency.

-- 1) Security fix: remove direct customer SELECT on raw dd_mandates table.
--    Customers must read masked data via the dd_mandates_list view (memory: PII Data Leak Prevention).
DROP POLICY IF EXISTS dd_mandates_owner_select ON public.dd_mandates;

-- 2) Make sure no two completed/submitted journeys collide for the same quote.
CREATE UNIQUE INDEX IF NOT EXISTS order_journeys_quote_submitted_unique
  ON public.order_journeys (quote_id)
  WHERE submitted_at IS NOT NULL;
