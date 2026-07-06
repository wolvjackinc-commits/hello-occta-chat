
REVOKE EXECUTE ON FUNCTION public.prevent_accepted_contract_summary_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_contract_acceptance_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_acceptance_certificate_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_accepted_cip_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_acceptance_audit_mutation() FROM PUBLIC, anon, authenticated;
