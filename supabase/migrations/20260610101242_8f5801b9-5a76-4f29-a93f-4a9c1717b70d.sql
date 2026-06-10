
-- 1) Restrict dd_mandates direct SELECT to admins; route customers through a SECURITY DEFINER-style view
DROP POLICY IF EXISTS dd_mandates_select_own ON public.dd_mandates;
CREATE POLICY dd_mandates_admin_select ON public.dd_mandates
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate masked view that runs with definer rights and explicit access control
DROP VIEW IF EXISTS public.dd_mandates_list;
CREATE VIEW public.dd_mandates_list
WITH (security_invoker=off) AS
SELECT
  id,
  user_id,
  status,
  mandate_reference,
  bank_last4,
  account_holder,
  CASE WHEN sort_code IS NOT NULL AND length(sort_code) >= 2
       THEN '**-**-' || right(sort_code, 2) ELSE NULL END AS sort_code_masked,
  CASE WHEN account_number_full IS NOT NULL AND length(account_number_full) >= 4
       THEN '****' || right(account_number_full, 4) ELSE NULL END AS account_number_masked,
  account_number_full IS NOT NULL AS has_bank_details,
  consent_timestamp,
  payment_request_id,
  created_at,
  updated_at
FROM public.dd_mandates
WHERE auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.dd_mandates_list TO authenticated;
GRANT SELECT ON public.dd_mandates_list TO service_role;

-- 2) Lock platform_settings: drop public-readable policy, restrict to authenticated; expose safe subset via public view
DROP POLICY IF EXISTS platform_settings_public_read ON public.platform_settings;

CREATE POLICY platform_settings_authenticated_read ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

-- Public view: excludes internal pricing buffers/floors (fair_pricing), updated_by, invoice/credit_note prefixes
CREATE OR REPLACE VIEW public.platform_settings_public
WITH (security_invoker=off) AS
SELECT
  id,
  singleton,
  api_mode,
  sim_checkout_mode,
  manual_mode_message,
  rewards_enabled,
  rewards_unlock_rule,
  rewards_custom_rule,
  vat_number,
  vat_effective_date,
  vat_scheme,
  vat_default_rate,
  residential_vat_display,
  business_vat_display,
  created_at,
  updated_at
FROM public.platform_settings
WHERE singleton = true;

GRANT SELECT ON public.platform_settings_public TO anon, authenticated;

-- 3) Fix mutable search_path on ca_block_mutations
CREATE OR REPLACE FUNCTION public.ca_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  RAISE EXCEPTION 'contract_acceptances is append-only';
END;
$function$;
