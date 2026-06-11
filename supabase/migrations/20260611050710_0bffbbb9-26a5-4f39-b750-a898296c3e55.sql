-- Add RESTRICTIVE policies to permanently block authenticated non-admin SELECT
-- on sensitive tables. Customers/staff access these via SECURITY DEFINER RPCs
-- (get_customer_*) or masked views (dd_mandates_list, platform_settings_public).

-- dd_mandates: block direct reads from anyone except admins/service_role.
DROP POLICY IF EXISTS "dd_mandates_block_non_admin_select" ON public.dd_mandates;
CREATE POLICY "dd_mandates_block_non_admin_select"
  ON public.dd_mandates
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- platform_settings: block direct reads from non-admins (safe columns via view).
DROP POLICY IF EXISTS "platform_settings_block_non_admin_select" ON public.platform_settings;
CREATE POLICY "platform_settings_block_non_admin_select"
  ON public.platform_settings
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
