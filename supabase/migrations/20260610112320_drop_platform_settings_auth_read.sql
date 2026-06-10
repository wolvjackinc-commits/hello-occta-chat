-- Remove broad authenticated SELECT on platform_settings (would expose sensitive columns like fair_pricing).
-- Authenticated reads must go through the curated platform_settings_public view instead.
DROP POLICY IF EXISTS platform_settings_authenticated_read_safe ON public.platform_settings;
REVOKE SELECT ON public.platform_settings FROM authenticated;
