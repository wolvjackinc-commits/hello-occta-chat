-- SECURITY ISSUE REMEDIATION 2026-08-24
-- 1. Fix SECURITY DEFINER views to be SECURITY INVOKER where possible.
-- 2. Revoke public/authenticated EXECUTE on sensitive SECURITY DEFINER functions.
-- 3. Add missing RLS policies for tracking tables.

-- 1. VIEWS AUDIT & FIX
ALTER VIEW public.customer_profile SET (security_invoker = true);
ALTER VIEW public.customer_guest_orders SET (security_invoker = true);
ALTER VIEW public.customer_orders SET (security_invoker = true);
ALTER VIEW public.customer_order_journeys SET (security_invoker = true);
ALTER VIEW public.customer_contract_summaries SET (security_invoker = true);
ALTER VIEW public.customer_contract_acceptances SET (security_invoker = true);
ALTER VIEW public.dd_mandates_list SET (security_invoker = true);
ALTER VIEW public.dd_provider_config SET (security_invoker = true);
ALTER VIEW public.installation_slots_public SET (security_invoker = true);
ALTER VIEW public.sim_orders_by_token SET (security_invoker = true);
ALTER VIEW public.sim_plans_public SET (security_invoker = true);

-- 2. FUNCTIONS AUDIT & FIX
REVOKE EXECUTE ON FUNCTION public.acceptance_certificates_before_insert() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.acceptance_certificates_block_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_archive_customer(uuid, text, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_checkout_session_list(integer) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_checkout_timeline(text, uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_link_quote_request(uuid, uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_override_quote_floor(uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reject_quote_request(uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_tasks_audit() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_tasks_set_updated_at() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_acceptance_certificate_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM public, authenticated;

-- 3. FIX TABLES WITH RLS BUT NO POLICIES
DROP POLICY IF EXISTS "Admins can view checkout_reminders" ON public.checkout_reminders;
CREATE POLICY "Admins can view checkout_reminders" ON public.checkout_reminders
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can view checkout_tracking_events" ON public.checkout_tracking_events;
CREATE POLICY "Admins can view checkout_tracking_events" ON public.checkout_tracking_events
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can view checkout_tracking_sessions" ON public.checkout_tracking_sessions;
CREATE POLICY "Admins can view checkout_tracking_sessions" ON public.checkout_tracking_sessions
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can view journey2_test_dd_intake" ON public.journey2_test_dd_intake;
CREATE POLICY "Admins can view journey2_test_dd_intake" ON public.journey2_test_dd_intake
FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
