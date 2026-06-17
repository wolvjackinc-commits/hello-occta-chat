
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS occta_order_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS contract_summary_id uuid,
  ADD COLUMN IF NOT EXISTS contract_acceptance_id uuid,
  ADD COLUMN IF NOT EXISTS payment_method_id uuid,
  ADD COLUMN IF NOT EXISTS guest_order_id uuid,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS giacom_reference text,
  ADD COLUMN IF NOT EXISTS giacom_product_ref text,
  ADD COLUMN IF NOT EXISTS entered_in_giacom_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_activation_date date,
  ADD COLUMN IF NOT EXISTS actual_activation_date date,
  ADD COLUMN IF NOT EXISTS router_reference text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS minimum_term_end_date date,
  ADD COLUMN IF NOT EXISTS etf_policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cease_date date,
  ADD COLUMN IF NOT EXISTS cancellation_preview jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS orders_journey_id_unique
  ON public.orders (journey_id) WHERE journey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_lifecycle_status_idx ON public.orders (lifecycle_status);
CREATE INDEX IF NOT EXISTS orders_contract_summary_id_idx ON public.orders (contract_summary_id);
CREATE INDEX IF NOT EXISTS orders_guest_order_id_idx ON public.orders (guest_order_id);

ALTER TABLE public.guest_orders
  ADD COLUMN IF NOT EXISTS linked_order_id uuid;

ALTER TABLE public.order_journeys
  ADD COLUMN IF NOT EXISTS order_id uuid;
CREATE INDEX IF NOT EXISTS order_journeys_order_id_idx ON public.order_journeys (order_id);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS contract_summary_id uuid,
  ADD COLUMN IF NOT EXISTS minimum_term_months integer,
  ADD COLUMN IF NOT EXISTS minimum_term_end_date date,
  ADD COLUMN IF NOT EXISTS etf_policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS notice_period_days integer,
  ADD COLUMN IF NOT EXISTS service_address text,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS selected_addons jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS services_order_id_unique
  ON public.services (order_id) WHERE order_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION public.generate_occta_order_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq bigint;
BEGIN
  v_seq := nextval('public.order_number_seq');
  RETURN 'OCC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_seq::text, 5, '0');
END; $$;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  customer_note text,
  internal_note text,
  source text NOT NULL DEFAULT 'admin',
  giacom_reference text,
  expected_activation_date date,
  actual_activation_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx
  ON public.order_status_history (order_id, changed_at DESC);

GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read order status history" ON public.order_status_history;
CREATE POLICY "Staff can read order status history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.order_status_history_block_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'order_status_history is append-only'; END; $$;

DROP TRIGGER IF EXISTS osh_no_update ON public.order_status_history;
CREATE TRIGGER osh_no_update BEFORE UPDATE OR DELETE ON public.order_status_history
  FOR EACH ROW EXECUTE FUNCTION public.order_status_history_block_mutation();

CREATE TABLE IF NOT EXISTS public.admin_reconciliation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'normal',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text
);
CREATE INDEX IF NOT EXISTS arc_status_idx
  ON public.admin_reconciliation_tasks (status, severity, created_at DESC);

GRANT SELECT, UPDATE ON public.admin_reconciliation_tasks TO authenticated;
GRANT ALL ON public.admin_reconciliation_tasks TO service_role;
ALTER TABLE public.admin_reconciliation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read reconciliation tasks" ON public.admin_reconciliation_tasks;
CREATE POLICY "Staff can read reconciliation tasks"
  ON public.admin_reconciliation_tasks FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can resolve reconciliation tasks" ON public.admin_reconciliation_tasks;
CREATE POLICY "Admins can resolve reconciliation tasks"
  ON public.admin_reconciliation_tasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

-- Backfill customer_id from user_id on existing orders
UPDATE public.orders
   SET customer_id = user_id
 WHERE customer_id IS NULL AND user_id IS NOT NULL;

-- Backfill lifecycle_status using the actual order_status enum values
UPDATE public.orders
   SET lifecycle_status = CASE status::text
     WHEN 'active'    THEN 'live'
     WHEN 'cancelled' THEN 'cancelled'
     WHEN 'confirmed' THEN 'ordered'
     WHEN 'pending'   THEN 'order_received'
     ELSE 'order_received'
   END
 WHERE lifecycle_status IS NULL;
