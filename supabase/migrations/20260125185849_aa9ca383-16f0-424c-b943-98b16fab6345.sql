-- Fix SECURITY DEFINER view issue by recreating with security_invoker
DROP VIEW IF EXISTS dd_mandates_list;

-- Recreate with security_invoker to use the querying user's permissions
CREATE VIEW dd_mandates_list
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  status,
  mandate_reference,
  bank_last4, -- Already masked (last 4 digits only)
  account_holder, -- Account holder name is safe to show
  -- Computed masked fields for display
  CASE WHEN sort_code IS NOT NULL THEN '**-**-' || RIGHT(sort_code, 2) ELSE NULL END AS sort_code_masked,
  CASE WHEN account_number_full IS NOT NULL THEN '****' || RIGHT(account_number_full, 4) ELSE NULL END AS account_number_masked,
  -- Indicate if bank details are present (for UI logic)
  (sort_code IS NOT NULL AND account_number_full IS NOT NULL) AS has_bank_details,
  consent_timestamp,
  payment_request_id,
  created_at,
  updated_at
FROM dd_mandates;

COMMENT ON VIEW dd_mandates_list IS 'Secure view of DD mandates with masked bank details for admin list views. Uses security_invoker for RLS.';