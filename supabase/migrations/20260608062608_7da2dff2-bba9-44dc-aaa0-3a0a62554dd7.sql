
-- =========================================================
-- platform_settings (singleton)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,

  api_mode text NOT NULL DEFAULT 'manual' CHECK (api_mode IN ('manual','live')),
  sim_checkout_mode text NOT NULL DEFAULT 'quote' CHECK (sim_checkout_mode IN ('quote','instant')),
  manual_mode_message text NOT NULL DEFAULT 'We''ll check the best available OCCTA option for your address and confirm speed, price, installation and switching details before you pay.',

  rewards_enabled boolean NOT NULL DEFAULT false,
  rewards_unlock_rule text NOT NULL DEFAULT 'first_cleared_payment'
    CHECK (rewards_unlock_rule IN ('first_cleared_payment','second_cleared_payment','custom_rule')),
  rewards_custom_rule jsonb NOT NULL DEFAULT '{}'::jsonb,

  vat_number text,
  vat_effective_date date,
  vat_scheme text NOT NULL DEFAULT 'standard',
  vat_default_rate numeric NOT NULL DEFAULT 20,
  residential_vat_display text NOT NULL DEFAULT 'inclusive' CHECK (residential_vat_display IN ('inclusive','exclusive')),
  business_vat_display text NOT NULL DEFAULT 'dual' CHECK (business_vat_display IN ('exclusive','dual')),

  invoice_prefix text NOT NULL DEFAULT 'INV-',
  credit_note_prefix text NOT NULL DEFAULT 'CN-',

  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_public_read" ON public.platform_settings;
CREATE POLICY "platform_settings_public_read"
  ON public.platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_write"
  ON public.platform_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.platform_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- site_copy
-- =========================================================
CREATE TABLE IF NOT EXISTS public.site_copy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_copy TO anon, authenticated;
GRANT ALL ON public.site_copy TO service_role;

ALTER TABLE public.site_copy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_copy_public_read" ON public.site_copy;
CREATE POLICY "site_copy_public_read"
  ON public.site_copy FOR SELECT USING (true);

DROP POLICY IF EXISTS "site_copy_admin_write" ON public.site_copy;
CREATE POLICY "site_copy_admin_write"
  ON public.site_copy FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_site_copy_updated_at ON public.site_copy;
CREATE TRIGGER trg_site_copy_updated_at
  BEFORE UPDATE ON public.site_copy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_copy (key, value) VALUES
  ('claim.cancellation', '30-day rolling options available. Cancel with notice.'),
  ('claim.fees', 'All monthly and one-off charges shown before you order.'),
  ('claim.support', '24/7 AI support with human escalation when needed.'),
  ('claim.installation', 'Free standard installation where available and shown in your quote.'),
  ('claim.availability', 'Availability depends on your exact address.'),
  ('claim.credit_check', 'Checks or deposits may apply depending on product/supplier.'),
  ('hero.title', 'Broadband without the lock-in.'),
  ('hero.subtitle', 'Choose flexible 30-day rolling broadband, SIM and digital voice. Want to save more? Pick a Contract Saver plan.')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- activity_log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),

  actor_type text NOT NULL CHECK (actor_type IN ('customer','admin','system','ai','anon')),
  actor_id uuid,

  customer_id uuid,
  order_id uuid,
  invoice_id uuid,
  quote_id uuid,
  contract_summary_id uuid,
  ticket_id uuid,
  complaint_id uuid,

  event_type text NOT NULL,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  old_value jsonb,
  new_value jsonb,

  ip text,
  ua text,
  source_module text NOT NULL DEFAULT 'unknown',
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('debug','info','notice','warning','critical')),
  audit_locked boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS activity_log_ts_idx ON public.activity_log (ts DESC);
CREATE INDEX IF NOT EXISTS activity_log_customer_idx ON public.activity_log (customer_id);
CREATE INDEX IF NOT EXISTS activity_log_event_type_idx ON public.activity_log (event_type);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON public.activity_log (actor_id);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_admin_read" ON public.activity_log;
CREATE POLICY "activity_log_admin_read"
  ON public.activity_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "activity_log_customer_own_read" ON public.activity_log;
CREATE POLICY "activity_log_customer_own_read"
  ON public.activity_log FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND customer_id = auth.uid()
    AND severity IN ('info','notice')
  );

-- =========================================================
-- Helper functions (SECURITY DEFINER), with restricted EXECUTE
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_platform_settings()
RETURNS public.platform_settings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.platform_settings WHERE singleton = true LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.is_vat_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_settings
    WHERE singleton = true
      AND vat_number IS NOT NULL
      AND length(trim(vat_number)) > 0
      AND vat_effective_date IS NOT NULL
      AND vat_effective_date <= CURRENT_DATE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','finance_admin','support_agent','sales_agent','compliance_admin','marketing_admin','auditor')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin','finance_admin'));
$$;

CREATE OR REPLACE FUNCTION public.has_compliance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin','compliance_admin'));
$$;

CREATE OR REPLACE FUNCTION public.has_marketing_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin','marketing_admin'));
$$;

-- Server-side safe log writer. Strips obvious sensitive keys before persisting.
CREATE OR REPLACE FUNCTION public.log_event(
  _actor_type text,
  _event_type text,
  _title text,
  _details jsonb DEFAULT '{}'::jsonb,
  _customer_id uuid DEFAULT NULL,
  _order_id uuid DEFAULT NULL,
  _invoice_id uuid DEFAULT NULL,
  _quote_id uuid DEFAULT NULL,
  _contract_summary_id uuid DEFAULT NULL,
  _ticket_id uuid DEFAULT NULL,
  _complaint_id uuid DEFAULT NULL,
  _old_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL,
  _ip text DEFAULT NULL,
  _ua text DEFAULT NULL,
  _source_module text DEFAULT 'unknown',
  _severity text DEFAULT 'info'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid;
  _safe jsonb := COALESCE(_details, '{}'::jsonb);
BEGIN
  IF _safe ? 'password' THEN _safe := _safe - 'password'; END IF;
  IF _safe ? 'card_number' THEN _safe := _safe - 'card_number'; END IF;
  IF _safe ? 'cvv' THEN _safe := _safe - 'cvv'; END IF;
  IF _safe ? 'token' THEN _safe := _safe - 'token'; END IF;
  IF _safe ? 'access_token' THEN _safe := _safe - 'access_token'; END IF;
  IF _safe ? 'refresh_token' THEN _safe := _safe - 'refresh_token'; END IF;
  IF _safe ? 'sort_code' THEN _safe := _safe - 'sort_code'; END IF;
  IF _safe ? 'account_number_full' THEN _safe := _safe - 'account_number_full'; END IF;

  INSERT INTO public.activity_log (
    actor_type, actor_id,
    customer_id, order_id, invoice_id, quote_id, contract_summary_id, ticket_id, complaint_id,
    event_type, title, details, old_value, new_value,
    ip, ua, source_module, severity
  )
  VALUES (
    _actor_type, auth.uid(),
    _customer_id, _order_id, _invoice_id, _quote_id, _contract_summary_id, _ticket_id, _complaint_id,
    _event_type, _title, _safe, _old_value, _new_value,
    _ip, _ua, _source_module, _severity
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- Restrict EXECUTE so new SECURITY DEFINER fns aren't broadly callable from PostgREST
REVOKE ALL ON FUNCTION public.get_platform_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_settings() TO service_role;

REVOKE ALL ON FUNCTION public.is_vat_active() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_vat_active() TO service_role;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.has_finance_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_finance_access(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.has_compliance_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_compliance_access(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.has_marketing_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_marketing_access(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.log_event(
  text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_event(
  text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, text, text, text, text
) TO service_role;
