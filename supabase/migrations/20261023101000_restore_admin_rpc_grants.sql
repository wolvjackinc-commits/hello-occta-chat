-- The 2026-08-24 hardening revoked EXECUTE from `authenticated` on two admin
-- RPCs, which broke the admin "Cancel & archive / Suspend / Resume" actions and
-- the quote unified opt-in toggle ("permission denied for function ...").
-- Both are SECURITY DEFINER and check the caller's admin role themselves, so
-- signed-in users may call them; the anonymous key never needs to.

GRANT EXECUTE ON FUNCTION public.admin_archive_customer(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_archive_customer(uuid, text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_set_quote_unified_opt_in(uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_quote_unified_opt_in(uuid, boolean) FROM anon;
