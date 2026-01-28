-- Enable RLS on dd_mandates_list view
-- Note: This is a view, so we need to ensure it uses security_invoker 
-- and the underlying table (dd_mandates) has proper RLS

-- First, drop and recreate the view with security_invoker enabled
DROP VIEW IF EXISTS public.dd_mandates_list;

CREATE VIEW public.dd_mandates_list
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  status,
  mandate_reference,
  bank_last4,
  account_holder,
  -- Mask sort_code: show only last 2 digits
  CASE 
    WHEN sort_code IS NOT NULL AND length(sort_code) >= 2 
    THEN '**-**-' || right(sort_code, 2)
    ELSE NULL 
  END AS sort_code_masked,
  -- Mask account_number: show only last 4 digits  
  CASE 
    WHEN account_number_full IS NOT NULL AND length(account_number_full) >= 4 
    THEN '****' || right(account_number_full, 4)
    ELSE NULL 
  END AS account_number_masked,
  -- Boolean flag indicating if bank details exist
  (account_number_full IS NOT NULL) AS has_bank_details,
  consent_timestamp,
  payment_request_id,
  created_at,
  updated_at
FROM public.dd_mandates;

-- Add comment explaining security
COMMENT ON VIEW public.dd_mandates_list IS 'Secure view of DD mandates with masked bank details. Uses security_invoker to inherit RLS from dd_mandates table.';