-- =====================================================
-- RLS UPDATES FOR PAYMENT REQUESTS
-- Add billing role type and update policies
-- =====================================================

-- First, update the app_role enum to include 'billing' and 'support' roles if not already present
-- Note: We can't directly add to enum, so we use a different approach with functions

-- Create helper functions for role checking
CREATE OR REPLACE FUNCTION public.has_billing_access()
RETURNS boolean AS $$
BEGIN
  RETURN has_role(auth.uid(), 'admin'::app_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- UPDATE payment_requests RLS policies
-- =====================================================
-- Drop existing policy
DROP POLICY IF EXISTS "payment_requests_admin_all" ON public.payment_requests;

-- Admin full access
CREATE POLICY "payment_requests_admin_full"
  ON public.payment_requests
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- UPDATE payment_request_events RLS policies
-- =====================================================
-- Drop existing policy
DROP POLICY IF EXISTS "payment_request_events_admin_all" ON public.payment_request_events;

-- Admin full access
CREATE POLICY "payment_request_events_admin_full"
  ON public.payment_request_events
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- DD MANDATES - Restrict bank field access
-- Create a view that masks sensitive bank fields
-- =====================================================
-- First, ensure only admins can see raw bank fields in dd_mandates
-- The existing RLS already restricts to admins, but we add an extra layer

-- Create a public-facing view that masks bank details
CREATE OR REPLACE VIEW public.dd_mandates_list
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  status,
  mandate_reference,
  bank_last4,  -- Only last 4 digits shown
  account_holder,  -- Name is okay to show
  consent_timestamp,
  payment_request_id,
  created_at,
  updated_at,
  -- Mask the sensitive fields
  CASE WHEN sort_code IS NOT NULL THEN '**-**-**' ELSE NULL END as sort_code_masked,
  CASE WHEN account_number_full IS NOT NULL THEN '****' || COALESCE(bank_last4, '****') ELSE NULL END as account_number_masked,
  -- Include a flag indicating if bank details exist
  (sort_code IS NOT NULL AND account_number_full IS NOT NULL) as has_bank_details
FROM public.dd_mandates;

-- Add index for performance on token validation queries
CREATE INDEX IF NOT EXISTS idx_payment_requests_token_expires 
  ON public.payment_requests (token_hash, expires_at, status);

-- Add index for rate limiting lookups  
CREATE INDEX IF NOT EXISTS idx_rate_limits_action_identifier
  ON public.rate_limits (action, identifier, window_start);

-- =====================================================
-- Add phone_payment to audit action types (conceptual)
-- =====================================================
-- Note: audit_logs already accepts any text for action field