
DO $$ BEGIN
  ALTER TYPE public.quote_request_status ADD VALUE IF NOT EXISTS 'in_review';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.quote_request_status ADD VALUE IF NOT EXISTS 'needs_info';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.quote_request_status ADD VALUE IF NOT EXISTS 'draft_quote_created';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.quote_request_status ADD VALUE IF NOT EXISTS 'final_quote_ready';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.quote_request_status ADD VALUE IF NOT EXISTS 'closed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.quote_status_kind ADD VALUE IF NOT EXISTS 'approved';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS customer_facing_message text,
  ADD COLUMN IF NOT EXISTS final_quote_id uuid REFERENCES public.quotes(id);

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS bucket_override_reason text,
  ADD COLUMN IF NOT EXISTS final_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.quotes_block_update_if_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status::text = 'approved' AND NEW.status::text = 'approved' THEN
    IF (NEW.plan_name, NEW.monthly_net, NEW.monthly_gross, NEW.setup_net, NEW.setup_gross,
        NEW.router_net, NEW.router_gross, NEW.installation_net, NEW.installation_gross,
        NEW.contract_length_months, NEW.supplier_product_id, NEW.supplier_name,
        NEW.customer_id, NEW.quote_request_id, NEW.expires_at, NEW.final_snapshot)
       IS DISTINCT FROM
       (OLD.plan_name, OLD.monthly_net, OLD.monthly_gross, OLD.setup_net, OLD.setup_gross,
        OLD.router_net, OLD.router_gross, OLD.installation_net, OLD.installation_gross,
        OLD.contract_length_months, OLD.supplier_product_id, OLD.supplier_name,
        OLD.customer_id, OLD.quote_request_id, OLD.expires_at, OLD.final_snapshot)
    THEN
      RAISE EXCEPTION 'Approved quote core fields are immutable. Create a new quote to change pricing or product.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_block_update_if_approved_t ON public.quotes;
CREATE TRIGGER quotes_block_update_if_approved_t
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.quotes_block_update_if_approved();

DROP POLICY IF EXISTS q_customer_select_own ON public.quotes;
