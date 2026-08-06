-- 1. Journey control settings (additive)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS customer_journey_v1_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_journey_default text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS customer_journey_v2_kill_switch boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_test_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_rollout_percentage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_abandoned_resume_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_resume_delay_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_session_expiry_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_assumed_availability boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_last_preflight_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS customer_journey_v2_last_preflight_result jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_journey_default_chk') THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_journey_default_chk
      CHECK (customer_journey_default IN ('v1','v2'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_journey_rollout_chk') THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_journey_rollout_chk
      CHECK (customer_journey_v2_rollout_percentage BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_journey_resume_delay_chk') THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_journey_resume_delay_chk
      CHECK (customer_journey_v2_resume_delay_minutes > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_journey_expiry_chk') THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_journey_expiry_chk
      CHECK (customer_journey_v2_session_expiry_days BETWEEN 1 AND 90);
  END IF;
END $$;

-- 2. Journey 2 checkout sessions
CREATE TABLE IF NOT EXISTS public.customer_journey_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_version text NOT NULL DEFAULT 'v2',
  public_token_hash text UNIQUE NOT NULL,
  anonymous_session_id_hash text NULL,
  status text NOT NULL DEFAULT 'active',
  current_step text NOT NULL DEFAULT 'address',
  last_completed_step text NULL,
  test_session boolean NOT NULL DEFAULT false,
  postcode text NULL,
  service_address jsonb NULL,
  speed_bucket text NULL,
  plan_term text NULL,
  router_option jsonb NULL,
  setup_option jsonb NULL,
  selected_addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_details jsonb NULL,
  price_snapshot jsonb NULL,
  pricing_version text NULL,
  customer_id uuid NULL,
  quote_request_id uuid NULL,
  quote_id uuid NULL,
  quote_public_token_hash text NULL,
  order_journey_id uuid NULL,
  contract_summary_id uuid NULL,
  contract_acceptance_id uuid NULL,
  payment_method_id uuid NULL,
  order_id uuid NULL,
  guest_order_id uuid NULL,
  idempotency_key uuid NULL,
  manual_review_reason text NULL,
  journey_assigned_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  completed_at timestamptz NULL,
  abandoned_at timestamptz NULL,
  resume_email_sent_at timestamptz NULL,
  ip text NULL,
  user_agent text NULL,
  utm_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cjs_version_chk CHECK (journey_version IN ('v1','v2')),
  CONSTRAINT cjs_status_chk CHECK (status IN ('active','contract_prepared','contract_accepted','order_submitted','completed','cancelled','expired','manual_review')),
  CONSTRAINT cjs_step_chk CHECK (current_step IN ('address','plan','router','extras','details','start_date','billing','contract','review','complete'))
);

GRANT SELECT ON public.customer_journey_sessions TO authenticated;
GRANT ALL ON public.customer_journey_sessions TO service_role;

ALTER TABLE public.customer_journey_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view journey sessions"
  ON public.customer_journey_sessions
  FOR SELECT
  TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE INDEX IF NOT EXISTS cjs_status_idx ON public.customer_journey_sessions (status);
CREATE INDEX IF NOT EXISTS cjs_last_activity_idx ON public.customer_journey_sessions (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS cjs_expires_idx ON public.customer_journey_sessions (expires_at);
CREATE INDEX IF NOT EXISTS cjs_anon_idx ON public.customer_journey_sessions (anonymous_session_id_hash);
CREATE INDEX IF NOT EXISTS cjs_quote_idx ON public.customer_journey_sessions (quote_id);
CREATE INDEX IF NOT EXISTS cjs_order_idx ON public.customer_journey_sessions (order_id);

CREATE OR REPLACE FUNCTION public.cjs_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cjs_updated_at ON public.customer_journey_sessions;
CREATE TRIGGER cjs_updated_at
  BEFORE UPDATE ON public.customer_journey_sessions
  FOR EACH ROW EXECUTE FUNCTION public.cjs_set_updated_at();

-- 3. Journey version traceability on existing records
ALTER TABLE public.order_journeys
  ADD COLUMN IF NOT EXISTS journey_version text NOT NULL DEFAULT 'v1';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS journey_version text NOT NULL DEFAULT 'v1';

-- 4. Retention housekeeping
CREATE OR REPLACE FUNCTION public.expire_customer_journey_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.customer_journey_sessions
     SET status = 'expired'
   WHERE expires_at < now()
     AND status IN ('active','contract_prepared');
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.customer_journey_sessions
     SET abandoned_at = now()
   WHERE abandoned_at IS NULL
     AND completed_at IS NULL
     AND status IN ('active','contract_prepared')
     AND last_activity_at < now() - interval '24 hours';

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_customer_journey_sessions() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_customer_journey_sessions() TO service_role;