-- 1. Fix the broken contract-signed admin notification trigger. It referenced
-- columns that do not exist on contract_acceptances (user_id, customer_name,
-- customer_email), which made every acceptance insert fail. It is now
-- column-correct AND fail-soft: a notification problem must never block a
-- customer signing their agreement.
CREATE OR REPLACE FUNCTION public.trg_contract_signed_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM public.notify_admin_event('contract_signed', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.accepted_by_user,
      'quote_id', NEW.quote_id,
      'contract_summary_id', NEW.contract_summary_id,
      'accepted_at', NEW.accepted_at,
      'customer_name', NEW.accepted_by_name,
      'customer_email', NEW.accepted_by_email
    ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'contract_signed notification failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 2. Fraud / identity-theft evidence captured at the moment of signing.
CREATE TABLE IF NOT EXISTS public.acceptance_risk_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_acceptance_id uuid REFERENCES public.contract_acceptances(id) ON DELETE SET NULL,
  contract_summary_id uuid,
  quote_id uuid,
  journey_id uuid,
  customer_id uuid,
  accepted_by_email text,
  ip text,
  ip_country text,
  ip_region text,
  ip_city text,
  ip_timezone text,
  forwarded_for text,
  user_agent text,
  accept_language text,
  browser_timezone text,
  browser_locale text,
  screen_signature text,
  platform text,
  device_memory text,
  hardware_concurrency integer,
  touch_points integer,
  cookies_enabled boolean,
  do_not_track text,
  webdriver_flag boolean,
  page_dwell_ms integer,
  geo_latitude numeric,
  geo_longitude numeric,
  geo_accuracy_m numeric,
  geo_permission text,
  device_fingerprint text,
  risk_score integer NOT NULL DEFAULT 0,
  risk_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ars_acceptance ON public.acceptance_risk_signals(contract_acceptance_id);
CREATE INDEX IF NOT EXISTS idx_ars_email ON public.acceptance_risk_signals(lower(accepted_by_email));
CREATE INDEX IF NOT EXISTS idx_ars_ip ON public.acceptance_risk_signals(ip);
CREATE INDEX IF NOT EXISTS idx_ars_fingerprint ON public.acceptance_risk_signals(device_fingerprint);

GRANT SELECT ON public.acceptance_risk_signals TO authenticated;
GRANT ALL ON public.acceptance_risk_signals TO service_role;

ALTER TABLE public.acceptance_risk_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read acceptance risk signals" ON public.acceptance_risk_signals;
CREATE POLICY "Admins read acceptance risk signals"
ON public.acceptance_risk_signals
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'compliance_admin')
);