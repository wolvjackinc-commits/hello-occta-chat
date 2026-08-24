-- SECURITY ISSUE REMEDIATION 2026-08-24 (Part 2)
-- Revoking public/authenticated EXECUTE on more sensitive SECURITY DEFINER functions.

-- is_admin: helper, only needs to be called by authenticated users, but revoking public is standard
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;

-- is_two_doc_flow_enabled_for: helper
REVOKE EXECUTE ON FUNCTION public.is_two_doc_flow_enabled_for(uuid) FROM public, authenticated;

-- can_create_manual_fulfilment_for_order: business logic, only for staff
REVOKE EXECUTE ON FUNCTION public.can_create_manual_fulfilment_for_order(uuid) FROM public, authenticated;

-- generate_invoice_number: helper for backend
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM public, authenticated;

-- generate_account_number: helper for backend
REVOKE EXECUTE ON FUNCTION public.generate_account_number() FROM public, authenticated;

-- checkout_journey_after_write: trigger
REVOKE EXECUTE ON FUNCTION public.checkout_journey_after_write() FROM public, authenticated;
