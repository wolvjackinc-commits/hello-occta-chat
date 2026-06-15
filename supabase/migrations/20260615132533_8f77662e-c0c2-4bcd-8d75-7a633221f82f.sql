
-- Enum for tracker status
DO $$ BEGIN
  CREATE TYPE public.manual_fulfilment_status AS ENUM (
    'ready_for_manual_order',
    'order_entered_in_supplier_portal',
    'supplier_acknowledged',
    'installation_pending',
    'active',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Eligibility guard
CREATE OR REPLACE FUNCTION public.can_create_manual_fulfilment(_payment_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payment_requests pr
    JOIN public.contract_summaries cs ON cs.id = pr.contract_summary_id
    WHERE pr.id = _payment_request_id
      AND pr.status = 'paid'
      AND pr.webhook_verified = true
      AND pr.paid_at IS NOT NULL
      AND cs.accepted_at IS NOT NULL
      AND cs.pdf_url IS NOT NULL
  );
$$;

-- Table
CREATE TABLE public.manual_fulfilment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.profiles(id),
  account_number text,
  payment_request_id uuid NOT NULL REFERENCES public.payment_requests(id),
  contract_summary_id uuid NOT NULL REFERENCES public.contract_summaries(id),
  selected_product_label text,
  supplier_name text,
  supplier_product_ref text,
  supplier_portal_reference text,
  notes text,
  status public.manual_fulfilment_status NOT NULL DEFAULT 'ready_for_manual_order',
  readiness_confirmed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (payment_request_id)
);

CREATE INDEX idx_mfo_customer ON public.manual_fulfilment_orders(customer_id);
CREATE INDEX idx_mfo_status ON public.manual_fulfilment_orders(status, created_at DESC);
CREATE INDEX idx_mfo_cs ON public.manual_fulfilment_orders(contract_summary_id);

-- GRANTs (admin-only via RLS; we still need base grant for authenticated to satisfy policy checks)
GRANT SELECT, INSERT, UPDATE ON public.manual_fulfilment_orders TO authenticated;
GRANT ALL ON public.manual_fulfilment_orders TO service_role;

-- RLS
ALTER TABLE public.manual_fulfilment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read manual fulfilment"
  ON public.manual_fulfilment_orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert manual fulfilment"
  ON public.manual_fulfilment_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update manual fulfilment"
  ON public.manual_fulfilment_orders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Eligibility trigger
CREATE OR REPLACE FUNCTION public.enforce_manual_fulfilment_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_create_manual_fulfilment(NEW.payment_request_id) THEN
    RAISE EXCEPTION 'Manual fulfilment tracker requires a paid, webhook-verified payment request linked to an accepted Contract Summary with a stored PDF.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mfo_eligibility
  BEFORE INSERT ON public.manual_fulfilment_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_manual_fulfilment_eligibility();

-- updated_at + activated_at/cancelled_at maintenance
CREATE OR REPLACE FUNCTION public.touch_manual_fulfilment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    NEW.activated_at = COALESCE(NEW.activated_at, now());
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    NEW.cancelled_at = COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mfo_touch
  BEFORE UPDATE ON public.manual_fulfilment_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_manual_fulfilment();
