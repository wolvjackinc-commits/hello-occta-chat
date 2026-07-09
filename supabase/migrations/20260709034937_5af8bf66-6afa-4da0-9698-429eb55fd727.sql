
-- Safety trigger: guarantees orders.actual_service_live_at_utc is populated
-- whenever an order becomes live, regardless of code path.
CREATE OR REPLACE FUNCTION public.orders_stamp_live_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lifecycle_status = 'live'
     AND NEW.actual_service_live_at_utc IS NULL
  THEN
    NEW.actual_service_live_at_utc :=
      COALESCE(
        (NEW.actual_activation_date)::timestamptz,
        now()
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_stamp_live_at ON public.orders;
CREATE TRIGGER trg_orders_stamp_live_at
BEFORE INSERT OR UPDATE OF lifecycle_status, actual_activation_date
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_stamp_live_at();

-- Backfill: any order that is already live/active but missing the timestamp,
-- using the confirmed service activation date as source of truth.
UPDATE public.orders o
SET actual_service_live_at_utc = COALESCE(
      s.activation_confirmed_at,
      (s.actual_activation_date)::timestamptz,
      (o.actual_activation_date)::timestamptz
    )
FROM public.services s
WHERE s.order_id = o.id
  AND o.actual_service_live_at_utc IS NULL
  AND (o.lifecycle_status = 'live' OR o.status = 'active')
  AND s.billing_enabled = true
  AND s.activation_confirmed_at IS NOT NULL;

-- Reset failed first-billing jobs whose only failure was the old gate bug.
-- They will be picked up on the next process-first-billing tick.
UPDATE public.first_billing_jobs
SET status = 'pending',
    last_error = NULL,
    attempts = 0,
    next_attempt_at = now()
WHERE status = 'failed'
  AND last_error LIKE 'billing_gate_blocked:order-not-found%';
