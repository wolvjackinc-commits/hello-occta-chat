
REVOKE EXECUTE ON FUNCTION public.can_create_manual_fulfilment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_manual_fulfilment_eligibility() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_manual_fulfilment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_manual_fulfilment(uuid) TO authenticated, service_role;
