
-- 1. Remove the overly-permissive authenticated SELECT policy on platform_settings
DROP POLICY IF EXISTS platform_settings_authenticated_read ON public.platform_settings;

-- 2. Add a narrower policy: authenticated users can SELECT the singleton row,
--    but column-level grants limit which columns they can actually read.
CREATE POLICY platform_settings_authenticated_read_safe
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (singleton = true);

-- 3. Lock down column access — revoke broad SELECT, then grant only safe columns.
REVOKE SELECT ON public.platform_settings FROM authenticated;
GRANT SELECT (
  id, singleton, api_mode, sim_checkout_mode, manual_mode_message,
  rewards_enabled, rewards_unlock_rule, rewards_custom_rule,
  vat_number, vat_effective_date, vat_scheme, vat_default_rate,
  residential_vat_display, business_vat_display,
  created_at, updated_at
) ON public.platform_settings TO authenticated;

-- 4. Make the public view run with the caller's permissions (security_invoker),
--    so column-level grants + RLS are enforced. The view only exposes safe columns.
ALTER VIEW public.platform_settings_public SET (security_invoker = true);
GRANT SELECT ON public.platform_settings_public TO authenticated;
