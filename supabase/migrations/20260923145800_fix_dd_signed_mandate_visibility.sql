-- Fix Direct Debit signed-mandate visibility in admin and customer portals.
-- A prior hardening migration switched dd_mandates_list to security_invoker=true
-- while authenticated users intentionally have no SELECT privilege on the raw
-- dd_mandates table. That made the masked view unreadable in the UI.
--
-- Keep the raw table protected. This view is SECURITY DEFINER but exposes only
-- masked/non-secret fields and explicitly restricts rows to the signed-in
-- customer or authorised staff roles.

CREATE OR REPLACE VIEW public.dd_mandates_list
WITH (security_invoker = off) AS
SELECT
  id,
  user_id,
  status,
  mandate_reference,
  bank_last4,
  account_holder,
  provider_code,
  provider_reference,
  submitted_to_provider_at,
  is_test,
  CASE
    WHEN masked_sort_last2 IS NOT NULL THEN '**-**-' || masked_sort_last2
    WHEN sort_code IS NOT NULL AND length(sort_code) >= 2 THEN '**-**-' || right(sort_code, 2)
    ELSE NULL
  END AS sort_code_masked,
  CASE
    WHEN masked_account_last4 IS NOT NULL THEN '****' || masked_account_last4
    WHEN account_number_full IS NOT NULL AND length(account_number_full) >= 4 THEN '****' || right(account_number_full, 4)
    ELSE NULL
  END AS account_number_masked,
  (bank_details_ciphertext IS NOT NULL OR account_number_full IS NOT NULL) AS has_bank_details,
  consent_timestamp,
  payment_request_id,
  created_at,
  updated_at,
  signature_name
FROM public.dd_mandates
WHERE auth.uid() = user_id
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'finance_admin'::app_role)
   OR has_role(auth.uid(), 'compliance_admin'::app_role);

REVOKE ALL ON public.dd_mandates_list FROM anon;
REVOKE ALL ON public.dd_mandates_list FROM authenticated;
GRANT SELECT ON public.dd_mandates_list TO authenticated;
GRANT SELECT ON public.dd_mandates_list TO service_role;
