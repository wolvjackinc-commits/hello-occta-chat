-- Tighten dd_provider_config SELECT: previously any authenticated user could read it,
-- exposing BACS service_user_number to customers. Restrict to staff only.
DROP POLICY IF EXISTS "Anyone authed reads dd config (non-sensitive)" ON public.dd_provider_config;

CREATE POLICY "Staff read dd config"
  ON public.dd_provider_config
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));