-- =============================================
-- Payment Requests System Tables
-- =============================================

-- Create payment_requests table
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  user_id uuid REFERENCES public.profiles(id),
  account_number text,
  type text NOT NULL CHECK (type IN ('card_payment', 'dd_setup')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'opened', 'completed', 'failed', 'cancelled')),
  amount numeric,
  currency text NOT NULL DEFAULT 'GBP',
  invoice_id uuid REFERENCES public.invoices(id),
  due_date date,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  notes text,
  token_hash text UNIQUE,
  expires_at timestamptz,
  last_opened_at timestamptz,
  completed_at timestamptz,
  provider text,
  provider_reference text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create payment_request_events table
CREATE TABLE public.payment_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_payment_requests_user_id_created ON public.payment_requests(user_id, created_at DESC);
CREATE INDEX idx_payment_requests_status_created ON public.payment_requests(status, created_at DESC);
CREATE INDEX idx_payment_requests_account_number ON public.payment_requests(account_number);
CREATE INDEX idx_payment_requests_expires_at ON public.payment_requests(expires_at);
CREATE INDEX idx_payment_requests_token_hash ON public.payment_requests(token_hash);
CREATE INDEX idx_payment_request_events_request_id ON public.payment_request_events(request_id);

-- Enable RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_request_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_requests (admin only)
CREATE POLICY "payment_requests_admin_all"
ON public.payment_requests FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for payment_request_events (admin only)
CREATE POLICY "payment_request_events_admin_all"
ON public.payment_request_events FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Extend dd_mandates with full bank details
-- =============================================

-- Add new columns to dd_mandates for full bank details storage
ALTER TABLE public.dd_mandates 
ADD COLUMN IF NOT EXISTS account_holder_name text,
ADD COLUMN IF NOT EXISTS sort_code text,
ADD COLUMN IF NOT EXISTS account_number_full text,
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS consent_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS consent_ip text,
ADD COLUMN IF NOT EXISTS consent_user_agent text,
ADD COLUMN IF NOT EXISTS signature_name text,
ADD COLUMN IF NOT EXISTS payment_request_id uuid REFERENCES public.payment_requests(id);

-- Drop existing status check constraint if it exists and add new one with more values
ALTER TABLE public.dd_mandates DROP CONSTRAINT IF EXISTS dd_mandates_status_check;
ALTER TABLE public.dd_mandates ADD CONSTRAINT dd_mandates_status_check 
CHECK (status IN ('pending', 'verified', 'submitted_to_provider', 'active', 'failed', 'cancelled'));

-- Create index for payment_request_id lookup
CREATE INDEX IF NOT EXISTS idx_dd_mandates_payment_request_id ON public.dd_mandates(payment_request_id);

-- Trigger for updated_at on payment_requests
CREATE OR REPLACE FUNCTION public.update_payment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_requests_updated_at();