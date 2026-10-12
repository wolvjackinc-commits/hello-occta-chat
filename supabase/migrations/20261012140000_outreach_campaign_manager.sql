-- Outreach campaign manager: compliant B2B prospect email campaigns.
--
-- Separate from the customer `campaigns` tables (which email existing
-- profiles) because prospects are not users and carry a lawful-basis record.
--
-- PECR reg. 22: unsolicited marketing email without consent may only go to
-- corporate subscribers (Ltd / LLP / PLC / public bodies). `eligible` below
-- encodes that rule and is the only gate the sender uses.

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_outreach_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid
       AND role::text IN ('admin', 'super_admin')
  );
$$;
REVOKE ALL ON FUNCTION public.is_outreach_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_outreach_staff(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sending_enabled boolean NOT NULL DEFAULT false,
  from_name text NOT NULL DEFAULT 'OCCTA Business',
  from_email text,
  reply_to text NOT NULL DEFAULT 'business@occta.co.uk',
  daily_cap integer NOT NULL DEFAULT 30 CHECK (daily_cap BETWEEN 0 AND 5000),
  hourly_cap integer NOT NULL DEFAULT 15 CHECK (hourly_cap BETWEEN 0 AND 1000),
  window_start_hour smallint NOT NULL DEFAULT 9 CHECK (window_start_hour BETWEEN 0 AND 23),
  window_end_hour smallint NOT NULL DEFAULT 17 CHECK (window_end_hour BETWEEN 1 AND 24),
  weekdays_only boolean NOT NULL DEFAULT true,
  recontact_cooldown_days integer NOT NULL DEFAULT 30 CHECK (recontact_cooldown_days BETWEEN 0 AND 365),
  postal_address text NOT NULL DEFAULT 'OCCTA Limited, 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom',
  last_worker_run_at timestamptz,
  last_worker_result jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT outreach_settings_window_chk CHECK (window_end_hour > window_start_hour),
  CONSTRAINT outreach_settings_from_email_chk CHECK (from_email IS NULL OR from_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT outreach_settings_reply_to_chk CHECK (reply_to ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
INSERT INTO public.outreach_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Contacts (prospects)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL CHECK (length(btrim(business_name)) BETWEEN 1 AND 300),
  email text NOT NULL,
  email_type text NOT NULL DEFAULT 'unknown' CHECK (email_type IN ('role', 'personal', 'unknown')),
  category text,
  subcategory text,
  address text,
  postcode text,
  area text,
  district text,
  phone text,
  website text,
  legal_form text NOT NULL DEFAULT 'unknown' CHECK (legal_form IN (
    'limited_company', 'llp', 'plc', 'public_body', 'company_other',
    'sole_trader', 'partnership', 'charity_unincorporated', 'unknown'
  )),
  companies_house_number text,
  companies_house_verified boolean NOT NULL DEFAULT false,
  companies_house_match_basis text,
  lawful_basis text NOT NULL DEFAULT 'none' CHECK (lawful_basis IN ('corporate_subscriber', 'consent', 'none')),
  consent_evidence text,
  priority text CHECK (priority IN ('A', 'B', 'C')),
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  source_urls text,
  why_good_fit text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained', 'do_not_contact')),
  import_batch text,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  eligible boolean GENERATED ALWAYS AS (
    status = 'active'
    AND (
      (
        lawful_basis = 'corporate_subscriber'
        AND companies_house_verified
        AND companies_house_number IS NOT NULL
        AND legal_form IN ('limited_company', 'llp', 'plc', 'public_body', 'company_other')
        AND email_type = 'role'
      )
      OR (lawful_basis = 'consent' AND consent_evidence IS NOT NULL AND length(btrim(consent_evidence)) > 0)
    )
  ) STORED,
  CONSTRAINT outreach_contacts_email_lower_chk CHECK (email = lower(btrim(email))),
  CONSTRAINT outreach_contacts_email_format_chk CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT outreach_contacts_email_key UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_eligible ON public.outreach_contacts (eligible) WHERE eligible;
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_category ON public.outreach_contacts (category);

-- ---------------------------------------------------------------------------
-- Suppression list (never email again)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('unsubscribed', 'hard_bounce', 'complaint', 'manual', 'invalid')),
  source text,
  campaign_id uuid,
  message_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT outreach_suppressions_email_lower_chk CHECK (email = lower(btrim(email)))
);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE CHECK (template_key ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name text NOT NULL,
  flyer_ref text CHECK (flyer_ref IS NULL OR flyer_ref ~ '^[A-Z0-9-]{3,24}$'),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  preheader text,
  body_html text NOT NULL,
  body_text text NOT NULL,
  cta_label text NOT NULL DEFAULT 'Book a free line check',
  cta_path text NOT NULL DEFAULT '/business/contact-sales' CHECK (cta_path ~ '^/[A-Za-z0-9/_-]*$'),
  hero_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled')),
  template_id uuid REFERENCES public.outreach_templates(id) ON DELETE SET NULL,
  -- Content snapshot taken at launch; the template can change afterwards.
  subject text,
  preheader text,
  body_html text,
  body_text text,
  cta_label text,
  cta_path text,
  hero_image_url text,
  flyer_ref text,
  template_key text,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_recipients integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  launched_at timestamptz,
  launched_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  paused_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON public.outreach_campaigns (status);

-- ---------------------------------------------------------------------------
-- Messages (one per campaign recipient)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.outreach_contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  business_name text,
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'suppressed', 'cancelled'
  )),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  unsubscribed_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  replied_at timestamptz,
  converted_at timestamptz,
  converted_lead_id uuid,
  converted_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_messages_campaign_email_key UNIQUE (campaign_id, email),
  CONSTRAINT outreach_messages_email_lower_chk CHECK (email = lower(btrim(email)))
);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_due ON public.outreach_messages (next_attempt_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_outreach_messages_campaign ON public.outreach_messages (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_email ON public.outreach_messages (email);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_sent_at ON public.outreach_messages (sent_at) WHERE sent_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_messages_provider_id ON public.outreach_messages (provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Events (append-only activity log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id uuid REFERENCES public.outreach_messages(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'queued', 'sent', 'delivered', 'delivery_delayed', 'open', 'click', 'bounce', 'complaint',
    'unsubscribe', 'failed', 'suppressed', 'converted', 'replied', 'test_sent'
  )),
  url text,
  provider_event_id text,
  user_agent text,
  suspected_bot boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_events_campaign ON public.outreach_events (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_events_message ON public.outreach_events (message_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_events_provider ON public.outreach_events (provider_event_id) WHERE provider_event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_outreach_contacts_updated_at ON public.outreach_contacts;
CREATE TRIGGER trg_outreach_contacts_updated_at BEFORE UPDATE ON public.outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_outreach_templates_updated_at ON public.outreach_templates;
CREATE TRIGGER trg_outreach_templates_updated_at BEFORE UPDATE ON public.outreach_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_outreach_campaigns_updated_at ON public.outreach_campaigns;
CREATE TRIGGER trg_outreach_campaigns_updated_at BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_outreach_messages_updated_at ON public.outreach_messages;
CREATE TRIGGER trg_outreach_messages_updated_at BEFORE UPDATE ON public.outreach_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_outreach_settings_updated_at ON public.outreach_settings;
CREATE TRIGGER trg_outreach_settings_updated_at BEFORE UPDATE ON public.outreach_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row level security: staff read everything; sending state is written only by
-- the edge functions (service role).
-- ---------------------------------------------------------------------------
ALTER TABLE public.outreach_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.outreach_settings, public.outreach_contacts, public.outreach_suppressions,
  public.outreach_templates, public.outreach_campaigns, public.outreach_messages, public.outreach_events
  FROM anon;
GRANT SELECT, UPDATE ON public.outreach_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_contacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.outreach_suppressions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaigns TO authenticated;
GRANT SELECT ON public.outreach_messages TO authenticated;
GRANT SELECT ON public.outreach_events TO authenticated;
GRANT ALL ON public.outreach_settings, public.outreach_contacts, public.outreach_suppressions,
  public.outreach_templates, public.outreach_campaigns, public.outreach_messages, public.outreach_events
  TO service_role;

DROP POLICY IF EXISTS "outreach staff read settings" ON public.outreach_settings;
CREATE POLICY "outreach staff read settings" ON public.outreach_settings
  FOR SELECT TO authenticated USING (public.is_outreach_staff(auth.uid()));
DROP POLICY IF EXISTS "outreach staff update settings" ON public.outreach_settings;
CREATE POLICY "outreach staff update settings" ON public.outreach_settings
  FOR UPDATE TO authenticated USING (public.is_outreach_staff(auth.uid())) WITH CHECK (public.is_outreach_staff(auth.uid()));

DROP POLICY IF EXISTS "outreach staff manage contacts" ON public.outreach_contacts;
CREATE POLICY "outreach staff manage contacts" ON public.outreach_contacts
  FOR ALL TO authenticated USING (public.is_outreach_staff(auth.uid())) WITH CHECK (public.is_outreach_staff(auth.uid()));

DROP POLICY IF EXISTS "outreach staff read suppressions" ON public.outreach_suppressions;
CREATE POLICY "outreach staff read suppressions" ON public.outreach_suppressions
  FOR SELECT TO authenticated USING (public.is_outreach_staff(auth.uid()));
DROP POLICY IF EXISTS "outreach staff add manual suppressions" ON public.outreach_suppressions;
CREATE POLICY "outreach staff add manual suppressions" ON public.outreach_suppressions
  FOR INSERT TO authenticated WITH CHECK (public.is_outreach_staff(auth.uid()) AND reason = 'manual');
-- Only manual entries can be removed; an unsubscribe/bounce/complaint is permanent.
DROP POLICY IF EXISTS "outreach staff remove manual suppressions" ON public.outreach_suppressions;
CREATE POLICY "outreach staff remove manual suppressions" ON public.outreach_suppressions
  FOR DELETE TO authenticated USING (public.is_outreach_staff(auth.uid()) AND reason = 'manual');

DROP POLICY IF EXISTS "outreach staff manage templates" ON public.outreach_templates;
CREATE POLICY "outreach staff manage templates" ON public.outreach_templates
  FOR ALL TO authenticated USING (public.is_outreach_staff(auth.uid())) WITH CHECK (public.is_outreach_staff(auth.uid()));

DROP POLICY IF EXISTS "outreach staff read campaigns" ON public.outreach_campaigns;
CREATE POLICY "outreach staff read campaigns" ON public.outreach_campaigns
  FOR SELECT TO authenticated USING (public.is_outreach_staff(auth.uid()));
DROP POLICY IF EXISTS "outreach staff create draft campaigns" ON public.outreach_campaigns;
CREATE POLICY "outreach staff create draft campaigns" ON public.outreach_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.is_outreach_staff(auth.uid()) AND status = 'draft');
-- Direct edits are limited to drafts; launch/pause/resume/cancel go through outreach-admin.
DROP POLICY IF EXISTS "outreach staff edit draft campaigns" ON public.outreach_campaigns;
CREATE POLICY "outreach staff edit draft campaigns" ON public.outreach_campaigns
  FOR UPDATE TO authenticated
  USING (public.is_outreach_staff(auth.uid()) AND status = 'draft')
  WITH CHECK (public.is_outreach_staff(auth.uid()) AND status = 'draft');
DROP POLICY IF EXISTS "outreach staff delete draft campaigns" ON public.outreach_campaigns;
CREATE POLICY "outreach staff delete draft campaigns" ON public.outreach_campaigns
  FOR DELETE TO authenticated USING (public.is_outreach_staff(auth.uid()) AND status = 'draft');

DROP POLICY IF EXISTS "outreach staff read messages" ON public.outreach_messages;
CREATE POLICY "outreach staff read messages" ON public.outreach_messages
  FOR SELECT TO authenticated USING (public.is_outreach_staff(auth.uid()));
DROP POLICY IF EXISTS "outreach staff read events" ON public.outreach_events;
CREATE POLICY "outreach staff read events" ON public.outreach_events
  FOR SELECT TO authenticated USING (public.is_outreach_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Campaign statistics (RLS of the underlying tables applies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.outreach_campaign_stats
WITH (security_invoker = true) AS
SELECT
  c.id AS campaign_id,
  count(m.id)::int AS total,
  count(m.id) FILTER (WHERE m.status IN ('queued', 'sending'))::int AS pending,
  count(m.id) FILTER (WHERE m.sent_at IS NOT NULL)::int AS sent,
  count(m.id) FILTER (WHERE m.delivered_at IS NOT NULL)::int AS delivered,
  count(m.id) FILTER (WHERE m.first_opened_at IS NOT NULL)::int AS opened,
  count(m.id) FILTER (WHERE m.first_clicked_at IS NOT NULL)::int AS clicked,
  count(m.id) FILTER (WHERE m.unsubscribed_at IS NOT NULL)::int AS unsubscribed,
  count(m.id) FILTER (WHERE m.status = 'bounced')::int AS bounced,
  count(m.id) FILTER (WHERE m.status = 'complained')::int AS complained,
  count(m.id) FILTER (WHERE m.status = 'failed')::int AS failed,
  count(m.id) FILTER (WHERE m.status = 'suppressed')::int AS suppressed,
  count(m.id) FILTER (WHERE m.replied_at IS NOT NULL)::int AS replied,
  count(m.id) FILTER (WHERE m.converted_at IS NOT NULL)::int AS converted
FROM public.outreach_campaigns c
LEFT JOIN public.outreach_messages m ON m.campaign_id = c.id
GROUP BY c.id;
GRANT SELECT ON public.outreach_campaign_stats TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Worker queue claim (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outreach_claim_batch(p_limit integer)
RETURNS SETOF public.outreach_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN;
  END IF;

  -- Recover rows left in 'sending' by a crashed run.
  UPDATE public.outreach_messages
     SET status = 'queued', locked_at = NULL
   WHERE status = 'sending' AND locked_at < now() - interval '10 minutes';

  RETURN QUERY
  WITH due AS (
    SELECT m.id
      FROM public.outreach_messages m
      JOIN public.outreach_campaigns c ON c.id = m.campaign_id
     WHERE m.status = 'queued'
       AND m.next_attempt_at <= now()
       AND c.status = 'sending'
     ORDER BY m.next_attempt_at, m.created_at
     LIMIT LEAST(p_limit, 100)
     FOR UPDATE OF m SKIP LOCKED
  )
  UPDATE public.outreach_messages m
     SET status = 'sending', locked_at = now(), attempt_count = m.attempt_count + 1
    FROM due
   WHERE m.id = due.id
  RETURNING m.*;
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_claim_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_claim_batch(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Open / click tracking (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outreach_record_engagement(
  p_token text,
  p_type text,
  p_url text,
  p_user_agent text,
  p_suspected_bot boolean
)
RETURNS public.outreach_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _m public.outreach_messages;
BEGIN
  IF p_type NOT IN ('open', 'click') THEN
    RAISE EXCEPTION 'unsupported engagement type %', p_type;
  END IF;

  SELECT * INTO _m FROM public.outreach_messages WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.outreach_events (message_id, campaign_id, event_type, url, user_agent, suspected_bot)
  VALUES (_m.id, _m.campaign_id, p_type, left(p_url, 2000), left(p_user_agent, 500), coalesce(p_suspected_bot, false));

  -- Suspected security-scanner hits are logged but do not count as engagement.
  IF coalesce(p_suspected_bot, false) THEN
    RETURN _m;
  END IF;

  IF p_type = 'open' THEN
    UPDATE public.outreach_messages
       SET open_count = open_count + 1,
           first_opened_at = coalesce(first_opened_at, now()),
           last_opened_at = now()
     WHERE id = _m.id
    RETURNING * INTO _m;
  ELSE
    -- A click proves the email was opened even when images were blocked.
    UPDATE public.outreach_messages
       SET click_count = click_count + 1,
           first_clicked_at = coalesce(first_clicked_at, now()),
           last_clicked_at = now(),
           first_opened_at = coalesce(first_opened_at, now()),
           last_opened_at = coalesce(last_opened_at, now())
     WHERE id = _m.id
    RETURNING * INTO _m;
  END IF;
  RETURN _m;
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_record_engagement(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_record_engagement(text, text, text, text, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- Suppress an address (unsubscribe / bounce / complaint) — service role only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outreach_suppress(
  p_email text,
  p_reason text,
  p_source text,
  p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text := lower(btrim(p_email));
  _campaign uuid;
  _contact_status text;
BEGIN
  IF _email IS NULL OR _email = '' THEN
    RETURN;
  END IF;
  IF p_reason NOT IN ('unsubscribed', 'hard_bounce', 'complaint', 'manual', 'invalid') THEN
    RAISE EXCEPTION 'unsupported suppression reason %', p_reason;
  END IF;

  IF p_message_id IS NOT NULL THEN
    SELECT campaign_id INTO _campaign FROM public.outreach_messages WHERE id = p_message_id;
  END IF;

  INSERT INTO public.outreach_suppressions (email, reason, source, campaign_id, message_id)
  VALUES (_email, p_reason, left(p_source, 200), _campaign, p_message_id)
  ON CONFLICT (email) DO NOTHING;

  _contact_status := CASE p_reason
    WHEN 'unsubscribed' THEN 'unsubscribed'
    WHEN 'hard_bounce' THEN 'bounced'
    WHEN 'complaint' THEN 'complained'
    ELSE 'do_not_contact'
  END;
  UPDATE public.outreach_contacts SET status = _contact_status WHERE email = _email AND status = 'active';

  -- Nothing still waiting in any campaign goes to this address.
  UPDATE public.outreach_messages
     SET status = 'suppressed', last_error = 'suppressed: ' || p_reason
   WHERE email = _email AND status = 'queued';

  IF p_message_id IS NOT NULL AND p_reason = 'unsubscribed' THEN
    UPDATE public.outreach_messages SET unsubscribed_at = coalesce(unsubscribed_at, now()) WHERE id = p_message_id;
  END IF;
  IF p_message_id IS NOT NULL THEN
    INSERT INTO public.outreach_events (message_id, campaign_id, event_type, meta)
    VALUES (
      p_message_id, _campaign,
      CASE p_reason WHEN 'unsubscribed' THEN 'unsubscribe' WHEN 'hard_bounce' THEN 'bounce' WHEN 'complaint' THEN 'complaint' ELSE 'suppressed' END,
      jsonb_build_object('reason', p_reason, 'source', p_source)
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_suppress(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_suppress(text, text, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Conversion: link a business lead / quote back to the email that produced it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outreach_link_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _term text;
  _msg public.outreach_messages;
BEGIN
  BEGIN
    _term := nullif(btrim(coalesce(NEW.utm ->> 'utm_term', '')), '');
    IF _term IS NOT NULL AND _term LIKE 'ob-%' THEN
      SELECT * INTO _msg FROM public.outreach_messages WHERE token = substr(_term, 4) LIMIT 1;
    END IF;
    IF _msg.id IS NULL AND NEW.email IS NOT NULL THEN
      SELECT * INTO _msg FROM public.outreach_messages
       WHERE email = lower(btrim(NEW.email))
         AND sent_at IS NOT NULL
         AND sent_at > now() - interval '90 days'
       ORDER BY sent_at DESC
       LIMIT 1;
    END IF;
    IF _msg.id IS NOT NULL AND _msg.converted_at IS NULL THEN
      UPDATE public.outreach_messages
         SET converted_at = now(), converted_lead_id = NEW.id, converted_source = TG_TABLE_NAME
       WHERE id = _msg.id;
      INSERT INTO public.outreach_events (message_id, campaign_id, event_type, meta)
      VALUES (_msg.id, _msg.campaign_id, 'converted', jsonb_build_object('table', TG_TABLE_NAME, 'record_id', NEW.id));
    END IF;
  EXCEPTION WHEN others THEN
    -- Attribution must never block a customer's enquiry.
    RAISE WARNING 'outreach conversion link failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.outreach_link_conversion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_outreach_conversion_business_leads ON public.business_leads;
CREATE TRIGGER trg_outreach_conversion_business_leads
  AFTER INSERT ON public.business_leads
  FOR EACH ROW EXECUTE FUNCTION public.outreach_link_conversion();
DROP TRIGGER IF EXISTS trg_outreach_conversion_business_quotes ON public.business_quote_requests;
CREATE TRIGGER trg_outreach_conversion_business_quotes
  AFTER INSERT ON public.business_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.outreach_link_conversion();

-- ---------------------------------------------------------------------------
-- Starter templates from the October 2026 business flyers
-- ---------------------------------------------------------------------------
INSERT INTO public.outreach_templates (template_key, name, flyer_ref, subject, preheader, body_html, body_text, cta_label, cta_path)
VALUES
(
  'last-orders-landline',
  'Last orders for your landline (LAST-A)',
  'LAST-A',
  'Is {{business_name}} ready for the landline switch-off?',
  'Openreach aims to finish switching off analogue lines by January 2027. A free 15-minute line check shows what needs to move.',
  '<p>Hello {{business_name}} team,</p>
<p>The UK''s analogue phone lines are being switched off area by area, and Openreach aims to finish by <strong>January 2027</strong>. It isn''t just the phone: card machines, alarms, door entry, lift lines and fax machines can all depend on that line.</p>
<p>We''re OCCTA, a Huddersfield-based communications provider. We offer a <strong>free 15-minute line check</strong> by phone or video. We list what uses your line, check your site, network and number-porting eligibility, then send a written quote. There''s no obligation.</p>
<ul>
<li>Hosted VoIP from £6.95 per seat a month + VAT (£8.34 inc. VAT)</li>
<li>SIP trunks from £5.95 per trunk a month + VAT (£7.14 inc. VAT)</li>
<li>Business broadband from £34.99 a month + VAT (£41.99 inc. VAT)</li>
<li>Business SIMs from £7.50 per line a month + VAT (£9.00 inc. VAT)</li>
</ul>
<p>Your reference is <strong>{{flyer_ref}}</strong>. If you''d rather talk, call 0800 260 6626 (Mon–Fri, 9am–6pm) or reply to this email.</p>
<p style="font-size:12px;color:#555">"From" prices depend on address, route, term and eligibility; your quote and Contract Summary confirm exact prices before you accept. Number porting is subject to eligibility. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut. OCCTA is not Openreach.</p>',
  'Hello {{business_name}} team,

The UK''s analogue phone lines are being switched off area by area, and Openreach aims to finish by January 2027. It isn''t just the phone: card machines, alarms, door entry, lift lines and fax machines can all depend on that line.

We''re OCCTA, a Huddersfield-based communications provider. We offer a free 15-minute line check by phone or video. We list what uses your line, check your site, network and number-porting eligibility, then send a written quote. There''s no obligation.

- Hosted VoIP from £6.95 per seat a month + VAT (£8.34 inc. VAT)
- SIP trunks from £5.95 per trunk a month + VAT (£7.14 inc. VAT)
- Business broadband from £34.99 a month + VAT (£41.99 inc. VAT)
- Business SIMs from £7.50 per line a month + VAT (£9.00 inc. VAT)

Book your free line check: {{cta_url}}

Your reference is {{flyer_ref}}. If you''d rather talk, call 0800 260 6626 (Mon–Fri, 9am–6pm) or reply to this email.

"From" prices depend on address, route, term and eligibility; your quote and Contract Summary confirm exact prices before you accept. Number porting is subject to eligibility. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut. OCCTA is not Openreach.',
  'Book my free line check',
  '/business/contact-sales'
),
(
  'card-machine-checklist',
  'Is your card machine on a phone line? (LAST-B)',
  'LAST-B',
  'Does {{business_name}}''s card machine still use a phone line?',
  'Card machines, alarms and door entry can rely on analogue lines that are being switched off. Here''s a 2-minute checklist.',
  '<p>Hello {{business_name}} team,</p>
<p>Card machines, alarms, door entry and lift lines can all depend on analogue phone lines, which are being switched off area by area. Openreach aims to finish by <strong>January 2027</strong>.</p>
<p>A quick checklist:</p>
<ul>
<li><strong>Card machine (PDQ):</strong> phone line, broadband or SIM? Ask your terminal provider.</li>
<li><strong>Intruder or fire alarm:</strong> is it monitored? Ask your alarm company about digital.</li>
<li><strong>Door entry or intercom:</strong> does it dial out over a phone line?</li>
<li><strong>Lift emergency phone:</strong> ask your lift maintenance company.</li>
<li><strong>Phones and numbers:</strong> how many lines, and which numbers must you keep?</li>
</ul>
<p>We''re OCCTA, a Huddersfield-based communications provider. Tick what applies, then book a <strong>free 15-minute line check</strong> by phone or video. We''ll go through it with you and send a written quote. There''s no obligation.</p>
<p>Your reference is <strong>{{flyer_ref}}</strong>. You can also call 0800 260 6626 (Mon–Fri, 9am–6pm) or reply to this email.</p>
<p style="font-size:12px;color:#555">Compatibility of third-party equipment (card terminals, alarms, door entry, lift lines, telecare) must be confirmed with the equipment supplier. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut. OCCTA is not Openreach.</p>',
  'Hello {{business_name}} team,

Card machines, alarms, door entry and lift lines can all depend on analogue phone lines, which are being switched off area by area. Openreach aims to finish by January 2027.

A quick checklist:
- Card machine (PDQ): phone line, broadband or SIM? Ask your terminal provider.
- Intruder or fire alarm: is it monitored? Ask your alarm company about digital.
- Door entry or intercom: does it dial out over a phone line?
- Lift emergency phone: ask your lift maintenance company.
- Phones and numbers: how many lines, and which numbers must you keep?

We''re OCCTA, a Huddersfield-based communications provider. Tick what applies, then book a free 15-minute line check by phone or video. We''ll go through it with you and send a written quote. There''s no obligation.

Book your free line check: {{cta_url}}

Your reference is {{flyer_ref}}. You can also call 0800 260 6626 (Mon–Fri, 9am–6pm) or reply to this email.

Compatibility of third-party equipment (card terminals, alarms, door entry, lift lines, telecare) must be confirmed with the equipment supplier. Hosted voice needs power and a working internet connection, so emergency calls may not work in a power cut. OCCTA is not Openreach.',
  'Book my free line check',
  '/business/contact-sales'
)
ON CONFLICT (template_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Schedule the sender every 5 minutes, reusing the project's existing cron
-- secret convention (command cloned from an existing worker so no secret is
-- written here). The worker itself refuses to send while sending_enabled is
-- false or outside the configured window.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _job record;
  _template text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed; outreach worker not scheduled';
    RETURN;
  END IF;

  FOR _job IN SELECT jobid FROM cron.job WHERE jobname = 'outreach-worker' LOOP
    PERFORM cron.unschedule(_job.jobid);
  END LOOP;

  SELECT command INTO _template FROM cron.job WHERE jobname = 'process-activation-outbox' LIMIT 1;
  IF _template IS NULL OR position('process-activation-outbox' in _template) = 0 THEN
    RAISE NOTICE 'cron template unavailable; outreach worker not scheduled';
    RETURN;
  END IF;

  PERFORM cron.schedule('outreach-worker', '*/5 * * * *', replace(_template, 'process-activation-outbox', 'outreach-worker'));
END;
$$;
