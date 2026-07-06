
ALTER TABLE public.sim_orders
  ADD COLUMN IF NOT EXISTS order_token_hash text UNIQUE,
  ADD COLUMN IF NOT EXISTS next_billing_date date,
  ADD COLUMN IF NOT EXISTS last_billed_period_end date,
  ADD COLUMN IF NOT EXISTS dd_intake_id uuid REFERENCES public.dd_intake_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dd_masked_last4 text,
  ADD COLUMN IF NOT EXISTS dd_masked_sort_last2 text,
  ADD COLUMN IF NOT EXISTS dd_bank_name text,
  ADD COLUMN IF NOT EXISTS dd_account_holder text,
  ADD COLUMN IF NOT EXISTS card_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

-- Duplicate protection: at most one SIM monthly invoice per period per order.
-- Uses notes text pattern already used by sim first payment; enforced via
-- a partial unique index on invoice_type + billing period + user + a marker.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sim_order_id uuid REFERENCES public.sim_orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_sim_period_unique
  ON public.invoices(sim_order_id, billing_period_start, billing_period_end, invoice_type)
  WHERE sim_order_id IS NOT NULL AND status <> 'cancelled';

-- Token-lookup view for order-success (no PII fields exposed).
CREATE OR REPLACE VIEW public.sim_orders_by_token AS
SELECT id, order_number, order_token_hash, plan_name_snapshot, sim_type,
       payment_method, status, first_payment_minor_snapshot,
       monthly_price_minor_snapshot, service_live_date, created_at
FROM public.sim_orders;

GRANT SELECT ON public.sim_orders_by_token TO anon, authenticated;

-- Ensure updated_at trigger exists (already added in previous migration, no-op if so)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sim_orders_touch'
  ) THEN
    CREATE TRIGGER sim_orders_touch BEFORE UPDATE ON public.sim_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
