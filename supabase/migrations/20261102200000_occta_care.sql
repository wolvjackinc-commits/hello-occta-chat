-- OCCTA Care: a non-insurance support subscription paid by its OWN Direct Debit.
--
-- Design rules this schema enforces:
--   * Care is NEVER in public.dd_mandates. Its mandates live in care_mandates
--     so a Care cancellation, failure or indemnity claim can never touch a
--     customer's broadband or SIM billing.
--   * No sale activates without a complete, append-only evidence record
--     (care_consents): terms version + hash, key facts hash, each tick with
--     its time, verification, IP, device, channel and any staff involved.
--   * Nothing is collected before the 14-day cooling-off period ends, and no
--     collection can be submitted without (a) an active mandate confirmed by
--     staff and (b) written advance notice at least 12 working days before.
--   * A collection is 'paid' only when staff confirm the money arrived
--     (AGENTS.md: never mark DD money paid without confirmation).
--   * Care debts are never chased. Two failed payments pause Care.
--   * OCCTA's DD bureaux are manual portals: nothing here calls a provider.
--   * Every state change writes care_events (append-only).
BEGIN;

-- ---------------------------------------------------------------------------
-- Calendar: England & Wales bank holidays and working-day arithmetic
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_bank_holidays (
  holiday date PRIMARY KEY,
  name text NOT NULL
);
INSERT INTO public.care_bank_holidays(holiday, name) VALUES
  ('2026-01-01','New Year''s Day'),('2026-04-03','Good Friday'),('2026-04-06','Easter Monday'),
  ('2026-05-04','Early May bank holiday'),('2026-05-25','Spring bank holiday'),('2026-08-31','Summer bank holiday'),
  ('2026-12-25','Christmas Day'),('2026-12-28','Boxing Day (substitute day)'),
  ('2027-01-01','New Year''s Day'),('2027-03-26','Good Friday'),('2027-03-29','Easter Monday'),
  ('2027-05-03','Early May bank holiday'),('2027-05-31','Spring bank holiday'),('2027-08-30','Summer bank holiday'),
  ('2027-12-27','Christmas Day (substitute day)'),('2027-12-28','Boxing Day (substitute day)'),
  ('2028-01-03','New Year''s Day (substitute day)'),('2028-04-14','Good Friday'),('2028-04-17','Easter Monday'),
  ('2028-05-01','Early May bank holiday'),('2028-05-29','Spring bank holiday'),('2028-08-28','Summer bank holiday'),
  ('2028-12-25','Christmas Day'),('2028-12-26','Boxing Day')
ON CONFLICT (holiday) DO NOTHING;

CREATE OR REPLACE FUNCTION public.care_is_working_day(d date) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM public.care_bank_holidays h WHERE h.holiday = d)
$$;

CREATE OR REPLACE FUNCTION public.care_next_working_day(d date) RETURNS date
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE x date := d;
BEGIN
  WHILE NOT public.care_is_working_day(x) LOOP x := x + 1; END LOOP;
  RETURN x;
END $$;

-- Adds n working days (n >= 0). Day 0 = d itself if it is a working day.
CREATE OR REPLACE FUNCTION public.care_add_working_days(d date, n integer) RETURNS date
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE x date := d; left_ integer := greatest(n, 0);
BEGIN
  WHILE left_ > 0 LOOP
    x := x + 1;
    IF public.care_is_working_day(x) THEN left_ := left_ - 1; END IF;
  END LOOP;
  RETURN x;
END $$;

-- Working days strictly between a and b (a < b): used for notice checks.
CREATE OR REPLACE FUNCTION public.care_working_days_between(a date, b date) RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::integer FROM generate_series(a + 1, b - 1, interval '1 day') g(d)
  WHERE b > a + 1 AND public.care_is_working_day(g.d::date)
$$;

-- First date on/after d whose day-of-month is p_day (1 or 15).
CREATE OR REPLACE FUNCTION public.care_day_on_or_after(d date, p_day integer) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE cand date := make_date(extract(year FROM d)::int, extract(month FROM d)::int, p_day);
BEGIN
  IF cand < d THEN cand := (cand + interval '1 month')::date; END IF;
  RETURN cand;
END $$;

CREATE OR REPLACE FUNCTION public.care_period_months(p_frequency text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_frequency WHEN 'annual' THEN 12 WHEN 'quarterly' THEN 3 ELSE 1 END
$$;

-- ---------------------------------------------------------------------------
-- Terms versions (immutable) and settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_terms_versions (
  version text PRIMARY KEY CHECK (version ~ '^care-[0-9]{4}-[0-9]{2}-v[0-9]+$'),
  effective_from timestamptz NOT NULL,
  summary text NOT NULL CHECK (length(summary) BETWEEN 80 AND 2000),
  terms_sha256 text NOT NULL CHECK (terms_sha256 ~ '^[0-9a-f]{64}$'),
  terms_url text NOT NULL DEFAULT 'https://www.occta.co.uk/legal/occta-care-terms',
  rules jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.care_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'care_% is append-only', TG_TABLE_NAME; END $$;

DROP TRIGGER IF EXISTS trg_care_terms_immutable ON public.care_terms_versions;
CREATE TRIGGER trg_care_terms_immutable BEFORE UPDATE OR DELETE ON public.care_terms_versions
  FOR EACH ROW EXECUTE FUNCTION public.care_immutable();

INSERT INTO public.care_terms_versions(version, effective_from, summary, terms_sha256, rules) VALUES (
  'care-2026-11-v1', '2026-11-02T00:00:00Z',
  'OCCTA Care is a support service, not insurance. Care Essentials costs £4.99 a month and Care Plus £8.99 a month, VAT included, paid by its own Direct Debit monthly, every 3 months, or yearly with 2 months free. There is no minimum term and no exit fee: cancel any time by phone, email, letter, chat or in My OCCTA. Nothing is taken until your 14-day cooling-off period has ended. Prepaid plans get a refund for unused time. We give at least 10 working days'' notice before any payment, and 30 days'' notice of any price change, with the right to leave free. Care does not pay for, repair or replace your own devices and doesn''t affect your legal rights.',
  '47f6f9524a6a8b22cec91267453023b5d9008e3e71e9d4f3e4adaaedbc979823',
  '{
    "cooling_off_days": 14,
    "first_collection_min_working_days": 15,
    "notice_working_days": 10,
    "notice_check_working_days": 12,
    "lodge_within_working_days": 10,
    "collection_days": [1, 15],
    "price_change_notice_days": 30,
    "renewal_reminder_days": 30,
    "usage_reminder_months": 6,
    "max_failed_collections": 2,
    "represent_after_working_days": 13,
    "annual_months_charged": 10,
    "quarterly_months_charged": 3,
    "minimum_age": 18,
    "extra_check_age": 75,
    "extra_check_pause_hours": 48,
    "indemnity_challenge_days": 9,
    "ddi_copy_working_days": 7,
    "debt_chasing": false
  }'::jsonb
) ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.care_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sales_open boolean NOT NULL DEFAULT true,
  current_terms_version text NOT NULL REFERENCES public.care_terms_versions(version),
  provider_code text NOT NULL DEFAULT 'accesspay' REFERENCES public.dd_providers(provider_code),
  support_hours text NOT NULL DEFAULT 'Monday to Saturday, 8am to 8pm',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.care_settings(singleton, current_terms_version) VALUES (true, 'care-2026-11-v1')
ON CONFLICT (singleton) DO NOTHING;

-- Plans. Prices here apply to NEW sign-ups only; members keep their snapshot
-- until a price change is scheduled with 30 days' notice.
CREATE TABLE IF NOT EXISTS public.care_plans (
  code text PRIMARY KEY CHECK (code IN ('essentials','plus')),
  name text NOT NULL,
  monthly_minor integer NOT NULL CHECK (monthly_minor BETWEEN 100 AND 5000),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.care_plans(code, name, monthly_minor, sort_order) VALUES
  ('essentials', 'Care Essentials', 499, 1),
  ('plus', 'Care Plus', 899, 2)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.care_price_minor(p_plan text, p_frequency text) RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.monthly_minor * CASE p_frequency WHEN 'annual' THEN 10 WHEN 'quarterly' THEN 3 WHEN 'monthly' THEN 1 ELSE NULL END
  FROM public.care_plans p WHERE p.code = p_plan AND p.active
$$;

CREATE SEQUENCE IF NOT EXISTS public.care_reference_seq START 100001;

-- ---------------------------------------------------------------------------
-- Support needs (special category data: stored only with explicit consent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_support_needs (
  customer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  needs text[] NOT NULL DEFAULT '{}' CHECK (needs <@ ARRAY['large_print','braille','carer_copy','extra_time','phone_preferred','email_preferred','no_sales_contact','other']::text[]),
  other_detail text CHECK (other_detail IS NULL OR length(other_detail) <= 500),
  carer_name text CHECK (carer_name IS NULL OR length(carer_name) <= 120),
  carer_contact text CHECK (carer_contact IS NULL OR length(carer_contact) <= 300),
  consent_at timestamptz NOT NULL,
  consent_source text NOT NULL CHECK (consent_source IN ('customer_web','customer_phone','customer_letter')),
  staff_sales_block boolean NOT NULL DEFAULT false,
  staff_note text CHECK (staff_note IS NULL OR length(staff_note) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- ---------------------------------------------------------------------------
-- Phone-assisted invites and draft applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.care_plans(code),
  frequency text NOT NULL CHECK (frequency IN ('monthly','quarterly','annual')),
  collection_day integer NOT NULL CHECK (collection_day IN (1, 15)),
  created_by uuid NOT NULL,
  script_confirmed jsonb NOT NULL,
  call_reference text CHECK (call_reference IS NULL OR length(call_reference) <= 120),
  call_notes text CHECK (call_notes IS NULL OR length(call_notes) <= 2000),
  sent_to_email text,
  email_status text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_invites_customer ON public.care_invites(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.care_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.care_invites(id),
  channel text NOT NULL CHECK (channel IN ('web','phone_assisted')),
  plan_code text NOT NULL REFERENCES public.care_plans(code),
  frequency text NOT NULL CHECK (frequency IN ('monthly','quarterly','annual')),
  collection_day integer NOT NULL CHECK (collection_day IN (1, 15)),
  price_minor integer NOT NULL CHECK (price_minor > 0),
  first_collection_date date NOT NULL,
  terms_version text NOT NULL REFERENCES public.care_terms_versions(version),
  key_facts jsonb,
  key_facts_sha256 text CHECK (key_facts_sha256 IS NULL OR key_facts_sha256 ~ '^[0-9a-f]{64}$'),
  key_facts_shown_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','expired','abandoned')),
  ip text, user_agent text,
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_applications_customer ON public.care_applications(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.care_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.care_applications(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('sms_otp','email_code')),
  destination_masked text NOT NULL,
  destination_hash text NOT NULL,
  code_hash text,
  provider_challenge_id text,
  send_count integer NOT NULL DEFAULT 1,
  verify_attempts integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_verifications_app ON public.care_verifications(application_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('OCCTA CARE-' || nextval('public.care_reference_seq')::text)
    CHECK (reference ~ '^OCCTA CARE-[0-9]{6,}$'),
  customer_id uuid NOT NULL REFERENCES auth.users(id),
  application_id uuid UNIQUE REFERENCES public.care_applications(id),
  plan_code text NOT NULL REFERENCES public.care_plans(code),
  frequency text NOT NULL CHECK (frequency IN ('monthly','quarterly','annual')),
  price_minor integer NOT NULL CHECK (price_minor > 0),
  collection_day integer NOT NULL CHECK (collection_day IN (1, 15)),
  status text NOT NULL CHECK (status IN ('pending_review','pending_mandate','active','paused','cancel_pending','cancelled','declined')),
  status_reason text,
  channel text NOT NULL CHECK (channel IN ('web','phone_assisted')),
  invite_id uuid REFERENCES public.care_invites(id),
  sold_by uuid,
  terms_version text NOT NULL REFERENCES public.care_terms_versions(version),
  joined_at timestamptz NOT NULL DEFAULT now(),
  cooling_off_ends_at timestamptz NOT NULL,
  started_early boolean NOT NULL DEFAULT false,
  service_starts_on date NOT NULL,
  first_collection_date date NOT NULL,
  review_reasons text[] NOT NULL DEFAULT '{}',
  review_hold_until timestamptz,
  reviewed_at timestamptz, reviewed_by uuid, review_note text,
  failed_collections integer NOT NULL DEFAULT 0,
  cancel_requested_at timestamptz,
  cancel_channel text CHECK (cancel_channel IS NULL OR cancel_channel IN ('portal','phone','email','letter','chat','bank','occta','in_cooling_off')),
  cancel_reason text CHECK (cancel_reason IS NULL OR length(cancel_reason) <= 1000),
  cancel_effective_date date,
  cancelled_at timestamptz,
  cancelled_by uuid,
  next_usage_reminder_on date,
  last_usage_reminder_at timestamptz,
  welcome_call_due_on date,
  welcome_call_done_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS care_one_live_subscription ON public.care_subscriptions(customer_id)
  WHERE status IN ('pending_review','pending_mandate','active','paused','cancel_pending');
CREATE INDEX IF NOT EXISTS idx_care_subscriptions_status ON public.care_subscriptions(status);
DROP TRIGGER IF EXISTS trg_care_subscriptions_updated ON public.care_subscriptions;
CREATE TRIGGER trg_care_subscriptions_updated BEFORE UPDATE ON public.care_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Consent evidence (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  customer_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('join','plan_change')),
  application_id uuid REFERENCES public.care_applications(id),
  terms_version text NOT NULL REFERENCES public.care_terms_versions(version),
  terms_sha256 text NOT NULL CHECK (terms_sha256 ~ '^[0-9a-f]{64}$'),
  key_facts jsonb NOT NULL,
  key_facts_sha256 text NOT NULL CHECK (key_facts_sha256 ~ '^[0-9a-f]{64}$'),
  key_facts_shown_at timestamptz NOT NULL,
  plan_code text NOT NULL,
  frequency text NOT NULL,
  price_minor integer NOT NULL,
  collection_day integer NOT NULL,
  ticked_terms_at timestamptz NOT NULL,
  ticked_dd_at timestamptz,
  ticked_account_holder_at timestamptz,
  ticked_early_start boolean NOT NULL DEFAULT false,
  ticked_early_start_at timestamptz,
  declared_over_18 boolean NOT NULL,
  verification_id uuid REFERENCES public.care_verifications(id),
  verification_method text CHECK (verification_method IS NULL OR verification_method IN ('sms_otp','email_code')),
  verification_destination text,
  verified_at timestamptz,
  channel text NOT NULL CHECK (channel IN ('web','phone_assisted','portal')),
  invite_id uuid,
  staff_id uuid,
  ip text,
  user_agent text,
  page_url text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_consent_join_complete CHECK (
    kind <> 'join' OR (ticked_dd_at IS NOT NULL AND ticked_account_holder_at IS NOT NULL
                       AND verified_at IS NOT NULL AND verification_id IS NOT NULL AND declared_over_18)
  )
);
CREATE INDEX IF NOT EXISTS idx_care_consents_sub ON public.care_consents(subscription_id, created_at);
DROP TRIGGER IF EXISTS trg_care_consents_immutable ON public.care_consents;
CREATE TRIGGER trg_care_consents_immutable BEFORE UPDATE OR DELETE ON public.care_consents
  FOR EACH ROW EXECUTE FUNCTION public.care_immutable();

-- ---------------------------------------------------------------------------
-- Mandates (separate from dd_mandates on purpose)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  customer_id uuid NOT NULL,
  reference text NOT NULL,
  provider_code text NOT NULL REFERENCES public.dd_providers(provider_code),
  status text NOT NULL CHECK (status IN ('on_hold','awaiting_lodgement','lodged','active','rejected','cancel_requested','cancelled')),
  account_holder_name text NOT NULL,
  bank_name text,
  masked_account_last4 text NOT NULL CHECK (masked_account_last4 ~ '^[0-9]{4}$'),
  masked_sort_last2 text NOT NULL CHECK (masked_sort_last2 ~ '^[0-9]{2}$'),
  bank_details_ciphertext bytea,
  enc_nonce bytea,
  enc_key_id text,
  enc_alg text,
  ciphertext_purged_at timestamptz,
  signed_at timestamptz NOT NULL,
  lodge_due_by date NOT NULL,
  lodged_at timestamptz, lodged_by uuid,
  provider_reference text,
  activated_at timestamptz, activated_by uuid,
  rejected_at timestamptz, rejection_reason text,
  cancel_requested_at timestamptz,
  cancelled_at timestamptz,
  cancel_source text CHECK (cancel_source IS NULL OR cancel_source IN ('occta','customer_via_occta','bank_addacs','rejected')),
  cancel_reason_code text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS care_one_live_mandate ON public.care_mandates(subscription_id)
  WHERE status IN ('on_hold','awaiting_lodgement','lodged','active','cancel_requested');
CREATE INDEX IF NOT EXISTS idx_care_mandates_status ON public.care_mandates(status);
DROP TRIGGER IF EXISTS trg_care_mandates_updated ON public.care_mandates;
CREATE TRIGGER trg_care_mandates_updated BEFORE UPDATE ON public.care_mandates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Collections and collection runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number text NOT NULL UNIQUE,
  provider_code text NOT NULL,
  created_by uuid NOT NULL,
  item_count integer NOT NULL,
  total_minor integer NOT NULL,
  earliest_due date, latest_due date,
  csv_sha256 text,
  submitted_confirmed_at timestamptz,
  submitted_confirmed_by uuid,
  voided_at timestamptz, voided_by uuid, void_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  mandate_id uuid REFERENCES public.care_mandates(id),
  kind text NOT NULL CHECK (kind IN ('first','recurring','represent')),
  due_date date NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','ready','in_run','submitted','paid','unpaid','cancelled','indemnity_claimed')),
  notice_sent_at timestamptz,
  notice_kind text,
  run_id uuid REFERENCES public.care_collection_runs(id),
  submitted_at timestamptz, submitted_by uuid,
  paid_confirmed_at timestamptz, paid_confirmed_by uuid, bank_received_date date,
  unpaid_recorded_at timestamptz, unpaid_recorded_by uuid,
  unpaid_reason_code text, unpaid_reason_text text,
  represent_of uuid REFERENCES public.care_collections(id),
  reschedule_count integer NOT NULL DEFAULT 0,
  cancelled_reason text,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (status <> 'paid' OR (paid_confirmed_at IS NOT NULL AND paid_confirmed_by IS NOT NULL AND bank_received_date IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS care_one_collection_per_period ON public.care_collections(subscription_id, period_start)
  WHERE kind <> 'represent' AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_care_collections_due ON public.care_collections(status, due_date);
DROP TRIGGER IF EXISTS trg_care_collections_updated ON public.care_collections;
CREATE TRIGGER trg_care_collections_updated BEFORE UPDATE ON public.care_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Refunds (bank transfer by staff; never automatic money movement)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  collection_id uuid REFERENCES public.care_collections(id),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  status text NOT NULL CHECK (status IN ('awaiting_collection','to_pay','paid','cancelled')),
  due_by date,
  paid_at date, paid_by uuid, paid_reference text,
  cancelled_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS care_one_refund_per_collection ON public.care_refunds(collection_id)
  WHERE status <> 'cancelled' AND collection_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_care_refunds_updated ON public.care_refunds;
CREATE TRIGGER trg_care_refunds_updated BEFORE UPDATE ON public.care_refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Disputes: indemnity claims (DDICA), DDI copy requests, complaints links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  collection_id uuid REFERENCES public.care_collections(id),
  kind text NOT NULL CHECK (kind IN ('indemnity_claim','ddi_copy_request','complaint')),
  bacs_reason_code text,
  amount_minor integer,
  received_on date NOT NULL,
  respond_by date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','challenged','accepted','closed')),
  decision_note text,
  complaint_id uuid REFERENCES public.complaints(id),
  evidence_pack_id uuid,
  created_by uuid,
  decided_by uuid, decided_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_disputes_open ON public.care_disputes(status, respond_by);

-- ---------------------------------------------------------------------------
-- Usage and customer requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  kind text NOT NULL CHECK (kind IN ('support_call','remote_session','wifi_setup','device_setup','router_replacement','repair_quote','repair_referral','health_check','extender_loan','other')),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','customer_request','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_usage_sub ON public.care_usage(subscription_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  customer_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('help','device_setup','wifi_setup','repair_quote','router_fault','health_check','extender')),
  details text NOT NULL CHECK (length(details) BETWEEN 3 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Letters, print batches, outbox and evidence packs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_print_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL UNIQUE,
  letter_count integer NOT NULL,
  pdf_path text,
  pdf_sha256 text,
  created_by uuid NOT NULL,
  posted_on date, posted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.care_subscriptions(id),
  customer_id uuid NOT NULL,
  letter_type text NOT NULL,
  recipient jsonb NOT NULL,
  payload jsonb NOT NULL,
  large_print boolean NOT NULL DEFAULT false,
  copy_for text,
  status text NOT NULL DEFAULT 'rendering' CHECK (status IN ('rendering','awaiting_print','in_batch','posted','sent_to_mail_house','needs_manual','failed','cancelled')),
  delivery text CHECK (delivery IS NULL OR delivery IN ('print_queue','stannp','manual')),
  pdf_path text,
  pdf_sha256 text,
  provider_id text,
  batch_id uuid REFERENCES public.care_print_batches(id),
  posted_on date, posted_by uuid,
  email_status text,
  email_log_id uuid,
  error text,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_letters_status ON public.care_letters(status, created_at);
CREATE INDEX IF NOT EXISTS idx_care_letters_sub ON public.care_letters(subscription_id, created_at DESC);
DROP TRIGGER IF EXISTS trg_care_letters_updated ON public.care_letters;
CREATE TRIGGER trg_care_letters_updated BEFORE UPDATE ON public.care_letters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A PDF's content can never change once stored.
CREATE OR REPLACE FUNCTION public.care_letter_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.pdf_sha256 IS NOT NULL AND (NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256 OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path) THEN
    RAISE EXCEPTION 'care_letter_pdf_is_immutable';
  END IF;
  IF NEW.payload IS DISTINCT FROM OLD.payload OR NEW.recipient IS DISTINCT FROM OLD.recipient OR NEW.letter_type IS DISTINCT FROM OLD.letter_type THEN
    RAISE EXCEPTION 'care_letter_content_is_immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_care_letter_guard ON public.care_letters;
CREATE TRIGGER trg_care_letter_guard BEFORE UPDATE ON public.care_letters
  FOR EACH ROW EXECUTE FUNCTION public.care_letter_guard();

CREATE TABLE IF NOT EXISTS public.care_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid REFERENCES public.care_letters(id),
  subscription_id uuid,
  customer_id uuid,
  kind text NOT NULL CHECK (kind IN ('letter_and_email','email_only')),
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed','suppressed_test')),
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  lease uuid,
  last_error text,
  dedupe_key text UNIQUE,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_care_outbox_pending ON public.care_outbox(status, created_at);

CREATE TABLE IF NOT EXISTS public.care_evidence_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.care_subscriptions(id),
  purpose text NOT NULL CHECK (purpose IN ('indemnity_challenge','ddi_copy','complaint','customer_request','internal_review')),
  pdf_path text NOT NULL,
  pdf_sha256 text NOT NULL,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_care_evidence_immutable ON public.care_evidence_packs;
CREATE TRIGGER trg_care_evidence_immutable BEFORE UPDATE OR DELETE ON public.care_evidence_packs
  FOR EACH ROW EXECUTE FUNCTION public.care_immutable();

CREATE TABLE IF NOT EXISTS public.care_price_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  frequency text NOT NULL,
  old_price_minor integer NOT NULL,
  new_price_minor integer NOT NULL CHECK (new_price_minor > 0),
  effective_from date NOT NULL,
  reason text NOT NULL CHECK (length(reason) >= 10),
  affected integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Event log (append-only timeline for every Care record)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_events (
  id bigserial PRIMARY KEY,
  subscription_id uuid,
  customer_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('customer','staff','system','bank')),
  actor_id uuid,
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_events_sub ON public.care_events(subscription_id, id);
CREATE INDEX IF NOT EXISTS idx_care_events_customer ON public.care_events(customer_id, id);
DROP TRIGGER IF EXISTS trg_care_events_immutable ON public.care_events;
CREATE TRIGGER trg_care_events_immutable BEFORE UPDATE OR DELETE ON public.care_events
  FOR EACH ROW EXECUTE FUNCTION public.care_immutable();

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_is_staff(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND public.is_staff(_uid)
$$;

CREATE OR REPLACE FUNCTION public.care_is_finance(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role::text IN ('admin','super_admin','finance_admin'))
$$;

CREATE OR REPLACE FUNCTION public.care_require(_finance boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.care_is_staff(uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _finance AND NOT public.care_is_finance(uid) THEN RAISE EXCEPTION 'forbidden_finance_role_required'; END IF;
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION public.care_log(p_sub uuid, p_customer uuid, p_actor_type text, p_actor uuid, p_event text, p_details jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.care_events(subscription_id, customer_id, actor_type, actor_id, event, details)
  VALUES (p_sub, p_customer, p_actor_type, p_actor, p_event, coalesce(p_details, '{}'))
$$;

CREATE OR REPLACE FUNCTION public.care_request_header(p_name text) RETURNS text
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN nullif(current_setting('request.headers', true), '')::jsonb ->> p_name;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.care_task(p_customer uuid, p_title text, p_description text, p_priority text, p_due date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_tasks(title, description, priority, status, created_by, related_customer_id, due_date)
  VALUES (left(p_title, 200), p_description, p_priority, 'open', p_customer, p_customer, p_due)
$$;

-- Queue a letter (with email copy) or an email. The recipient and support
-- needs are snapshotted NOW so the letter shows exactly who it went to.
CREATE OR REPLACE FUNCTION public.care_queue(p_sub uuid, p_template text, p_payload jsonb, p_dedupe text, p_kind text DEFAULT 'letter_and_email')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; pr record; sn record; recip jsonb; lid uuid; oid uuid; test boolean := false;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'care_subscription_not_found'; END IF;
  test := s.is_test;
  SELECT full_name, email, address_line1, address_line2, city, postcode, account_number INTO pr FROM public.profiles WHERE id = s.customer_id;
  SELECT * INTO sn FROM public.care_support_needs WHERE customer_id = s.customer_id;
  recip := jsonb_build_object(
    'name', coalesce(pr.full_name, 'OCCTA customer'), 'email', pr.email,
    'address_line1', pr.address_line1, 'address_line2', pr.address_line2, 'city', pr.city, 'postcode', pr.postcode,
    'account_number', pr.account_number, 'reference', s.reference,
    'needs', coalesce(to_jsonb(sn.needs), '[]'::jsonb), 'carer_name', sn.carer_name, 'carer_contact', sn.carer_contact);
  IF p_dedupe IS NOT NULL AND EXISTS (SELECT 1 FROM public.care_outbox WHERE dedupe_key = p_dedupe) THEN
    RETURN (SELECT id FROM public.care_outbox WHERE dedupe_key = p_dedupe);
  END IF;
  IF p_kind = 'letter_and_email' THEN
    INSERT INTO public.care_letters(subscription_id, customer_id, letter_type, recipient, payload, large_print, dedupe_key)
    VALUES (s.id, s.customer_id, p_template, recip, coalesce(p_payload, '{}'),
            coalesce('large_print' = ANY(sn.needs), false), p_dedupe)
    RETURNING id INTO lid;
  END IF;
  INSERT INTO public.care_outbox(letter_id, subscription_id, customer_id, kind, template, payload, dedupe_key, is_test)
  VALUES (lid, s.id, s.customer_id, p_kind, p_template, coalesce(p_payload, '{}') || jsonb_build_object('recipient', recip), p_dedupe, test)
  RETURNING id INTO oid;
  RETURN oid;
END $$;

-- Eligibility, with reasons. Review triggers are separate (they don't block).
CREATE OR REPLACE FUNCTION public.care_eligibility(p_customer uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; reasons text[] := '{}'; review text[] := '{}'; sn record; age integer;
BEGIN
  IF p_customer IS NULL THEN RETURN jsonb_build_object('eligible', false, 'reasons', jsonb_build_array('not_signed_in'), 'review', '[]'::jsonb); END IF;
  IF NOT (SELECT sales_open FROM public.care_settings WHERE singleton) THEN reasons := array_append(reasons, 'sales_closed'); END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_customer;
  IF NOT FOUND THEN
    reasons := array_append(reasons, 'no_account');
  ELSE
    IF pr.account_type <> 'residential' THEN reasons := array_append(reasons, 'business_account'); END IF;
    IF pr.archived_at IS NOT NULL OR pr.suspended_at IS NOT NULL THEN reasons := array_append(reasons, 'account_not_active'); END IF;
    IF pr.date_of_birth IS NOT NULL THEN
      age := extract(year FROM age(current_date, pr.date_of_birth))::int;
      IF age < 18 THEN reasons := array_append(reasons, 'under_18'); END IF;
      IF age >= 75 THEN review := array_append(review, 'age_extra_check'); END IF;
    END IF;
    IF pr.address_line1 IS NULL OR pr.postcode IS NULL THEN reasons := array_append(reasons, 'no_postal_address'); END IF;
    IF pr.email IS NULL THEN reasons := array_append(reasons, 'no_email'); END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices i WHERE i.user_id = p_customer
             AND (i.status = 'overdue' OR (i.status = 'sent' AND i.due_date < current_date - 3))) THEN
    reasons := array_append(reasons, 'overdue_bill');
  END IF;
  IF EXISTS (SELECT 1 FROM public.care_subscriptions s WHERE s.customer_id = p_customer
             AND s.status IN ('pending_review','pending_mandate','active','paused','cancel_pending')) THEN
    reasons := array_append(reasons, 'already_member');
  END IF;
  SELECT * INTO sn FROM public.care_support_needs WHERE customer_id = p_customer;
  IF FOUND AND sn.staff_sales_block THEN reasons := array_append(reasons, 'contact_us_first'); END IF;
  IF FOUND AND (cardinality(sn.needs) > 0 OR sn.other_detail IS NOT NULL) THEN review := array_append(review, 'support_needs'); END IF;
  IF to_regclass('public.customer_vulnerability_reviews') IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.customer_vulnerability_reviews v WHERE v.customer_id = p_customer AND v.status = 'pending') THEN
    review := array_append(review, 'vulnerability_review_open');
  END IF;
  RETURN jsonb_build_object('eligible', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons), 'review', to_jsonb(review),
                            'date_of_birth_known', pr.date_of_birth IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.care_first_collection_date(p_signed date, p_day integer) RETURNS date
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.care_next_working_day(public.care_day_on_or_after(
    greatest(public.care_add_working_days(p_signed, 15), p_signed + 15), p_day))
$$;

-- ---------------------------------------------------------------------------
-- Public catalogue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_public_catalogue() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'sales_open', st.sales_open,
    'terms_version', st.current_terms_version,
    'terms_summary', t.summary,
    'support_hours', st.support_hours,
    'plans', (SELECT jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name, 'monthly_minor', p.monthly_minor,
                'quarterly_minor', p.monthly_minor * 3, 'annual_minor', p.monthly_minor * 10) ORDER BY p.sort_order)
              FROM public.care_plans p WHERE p.active))
  FROM public.care_settings st JOIN public.care_terms_versions t ON t.version = st.current_terms_version
  WHERE st.singleton
$$;

-- ---------------------------------------------------------------------------
-- Application lifecycle (called by the care-join edge function, service role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_start_application(
  p_customer uuid, p_plan text, p_frequency text, p_day integer, p_invite_hash text, p_ip text, p_ua text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE elig jsonb; inv record; inv_id uuid; price integer; first_date date; app_id uuid; chan text := 'web';
BEGIN
  elig := public.care_eligibility(p_customer);
  IF NOT (elig->>'eligible')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_eligible', 'reasons', elig->'reasons');
  END IF;
  IF p_invite_hash IS NOT NULL THEN
    SELECT * INTO inv FROM public.care_invites WHERE token_hash = p_invite_hash;
    IF NOT FOUND OR inv.revoked_at IS NOT NULL OR inv.used_at IS NOT NULL OR inv.expires_at < now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invite_invalid');
    END IF;
    IF inv.customer_id <> p_customer THEN RETURN jsonb_build_object('ok', false, 'error', 'invite_other_account'); END IF;
    inv_id := inv.id;
    chan := 'phone_assisted';
    -- The customer may still choose differently: the invite only pre-fills.
  END IF;
  IF p_plan NOT IN ('essentials','plus') OR p_frequency NOT IN ('monthly','quarterly','annual') OR p_day NOT IN (1, 15) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_choice');
  END IF;
  price := public.care_price_minor(p_plan, p_frequency);
  IF price IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'plan_unavailable'); END IF;
  first_date := public.care_first_collection_date(current_date, p_day);
  UPDATE public.care_applications SET status = 'abandoned' WHERE customer_id = p_customer AND status = 'draft';
  INSERT INTO public.care_applications(customer_id, invite_id, channel, plan_code, frequency, collection_day, price_minor,
    first_collection_date, terms_version, ip, user_agent, expires_at)
  VALUES (p_customer, inv_id, chan, p_plan, p_frequency, p_day, price, first_date,
    (SELECT current_terms_version FROM public.care_settings WHERE singleton), left(p_ip, 100), left(p_ua, 500), now() + interval '24 hours')
  RETURNING id INTO app_id;
  PERFORM public.care_log(NULL, p_customer, 'customer', p_customer, 'application_started',
    jsonb_build_object('application_id', app_id, 'plan', p_plan, 'frequency', p_frequency, 'day', p_day, 'price_minor', price, 'channel', chan));
  RETURN jsonb_build_object('ok', true, 'application_id', app_id, 'price_minor', price, 'first_collection_date', first_date,
    'channel', chan, 'review', elig->'review', 'date_of_birth_known', elig->'date_of_birth_known',
    'terms_version', (SELECT current_terms_version FROM public.care_settings WHERE singleton));
END $$;

CREATE OR REPLACE FUNCTION public.care_record_key_facts(p_application uuid, p_customer uuid, p_key_facts jsonb, p_sha text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.care_applications SET key_facts = p_key_facts, key_facts_sha256 = p_sha, key_facts_shown_at = now()
  WHERE id = p_application AND customer_id = p_customer AND status = 'draft' AND expires_at > now();
  RETURN FOUND;
END $$;

-- The single gate that turns an application into a subscription. Everything is
-- re-checked here, server-side, regardless of what the browser showed.
CREATE OR REPLACE FUNCTION public.care_submit_application(p_application uuid, p_customer uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  app record; elig jsonb; ver record; vrf record; pr record; sub_id uuid; sub_ref text; mandate_id uuid;
  review text[]; status_ text; cooling timestamptz; hold timestamptz; consent_id uuid; first_end date;
  test boolean := coalesce((p->>'is_test')::boolean, false); holder text; name_match boolean;
BEGIN
  SELECT * INTO app FROM public.care_applications WHERE id = p_application FOR UPDATE;
  IF NOT FOUND OR app.customer_id <> p_customer THEN RETURN jsonb_build_object('ok', false, 'error', 'application_not_found'); END IF;
  IF app.status <> 'draft' THEN RETURN jsonb_build_object('ok', false, 'error', 'application_already_used'); END IF;
  IF app.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'application_expired'); END IF;
  IF app.key_facts_sha256 IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'key_facts_not_shown'); END IF;

  elig := public.care_eligibility(p_customer);
  IF NOT (elig->>'eligible')::boolean THEN RETURN jsonb_build_object('ok', false, 'error', 'not_eligible', 'reasons', elig->'reasons'); END IF;

  SELECT * INTO ver FROM public.care_terms_versions WHERE version = app.terms_version;
  IF p->>'terms_sha256' IS DISTINCT FROM ver.terms_sha256 THEN RETURN jsonb_build_object('ok', false, 'error', 'terms_changed'); END IF;

  IF NOT coalesce((p->>'tick_terms')::boolean, false) OR NOT coalesce((p->>'tick_dd')::boolean, false)
     OR NOT coalesce((p->>'tick_account_holder')::boolean, false) OR NOT coalesce((p->>'declared_over_18')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'agreement_incomplete');
  END IF;

  SELECT * INTO vrf FROM public.care_verifications WHERE id = (p->>'verification_id')::uuid;
  IF NOT FOUND OR vrf.application_id <> app.id OR vrf.verified_at IS NULL OR vrf.consumed_at IS NOT NULL
     OR vrf.verified_at < now() - interval '30 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_verified');
  END IF;

  IF coalesce(p->>'bank_ciphertext', '') = '' OR coalesce(p->>'masked_account_last4', '') !~ '^[0-9]{4}$'
     OR coalesce(p->>'masked_sort_last2', '') !~ '^[0-9]{2}$' OR length(coalesce(p->>'account_holder_name', '')) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bank_details_incomplete');
  END IF;

  -- Price must still be what was shown.
  IF public.care_price_minor(app.plan_code, app.frequency) IS DISTINCT FROM app.price_minor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_changed');
  END IF;

  SELECT full_name INTO pr FROM public.profiles WHERE id = p_customer;
  holder := lower(regexp_replace(p->>'account_holder_name', '[^a-zA-Z ]', '', 'g'));
  name_match := pr.full_name IS NOT NULL AND (
    holder LIKE '%' || lower(split_part(regexp_replace(pr.full_name, '[^a-zA-Z ]', '', 'g'), ' ', -1)) || '%');

  review := ARRAY(SELECT jsonb_array_elements_text(elig->'review'));
  IF NOT name_match THEN review := array_append(review, 'account_holder_mismatch'); END IF;
  IF app.channel = 'phone_assisted' THEN review := array_append(review, 'phone_assisted'); END IF;
  IF jsonb_typeof(p->'support_needs') = 'array' AND jsonb_array_length(p->'support_needs') > 0
     AND NOT ('support_needs' = ANY(review)) THEN review := array_append(review, 'support_needs'); END IF;

  -- Phone-assisted alone is recorded for QA but doesn't hold the sale.
  status_ := CASE WHEN EXISTS (SELECT 1 FROM unnest(review) r WHERE r <> 'phone_assisted') THEN 'pending_review' ELSE 'pending_mandate' END;
  hold := CASE WHEN 'age_extra_check' = ANY(review) THEN now() + interval '48 hours' ELSE NULL END;
  cooling := now() + interval '14 days';

  -- Support needs (special category data) only with explicit consent.
  IF jsonb_typeof(p->'support_needs') = 'array' AND jsonb_array_length(p->'support_needs') > 0 THEN
    IF NOT coalesce((p->>'support_needs_consent')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'support_needs_consent_required');
    END IF;
    INSERT INTO public.care_support_needs(customer_id, needs, other_detail, carer_name, carer_contact, consent_at, consent_source, updated_by)
    VALUES (p_customer, ARRAY(SELECT jsonb_array_elements_text(p->'support_needs')), nullif(left(p->>'support_other', 500), ''),
            nullif(left(p->>'carer_name', 120), ''), nullif(left(p->>'carer_contact', 300), ''), now(), 'customer_web', p_customer)
    ON CONFLICT (customer_id) DO UPDATE SET needs = EXCLUDED.needs, other_detail = EXCLUDED.other_detail,
      carer_name = EXCLUDED.carer_name, carer_contact = EXCLUDED.carer_contact, consent_at = EXCLUDED.consent_at,
      consent_source = EXCLUDED.consent_source, updated_at = now(), updated_by = p_customer;
  END IF;

  INSERT INTO public.care_subscriptions(customer_id, application_id, plan_code, frequency, price_minor, collection_day, status,
    channel, invite_id, sold_by, terms_version, cooling_off_ends_at, started_early, service_starts_on, first_collection_date,
    review_reasons, review_hold_until, next_usage_reminder_on, welcome_call_due_on, is_test)
  VALUES (p_customer, app.id, app.plan_code, app.frequency, app.price_minor, app.collection_day, status_,
    app.channel, app.invite_id, (SELECT created_by FROM public.care_invites WHERE id = app.invite_id), app.terms_version, cooling,
    coalesce((p->>'tick_early_start')::boolean, false),
    CASE WHEN coalesce((p->>'tick_early_start')::boolean, false) THEN current_date ELSE (cooling)::date END,
    app.first_collection_date, review, hold,
    CASE WHEN app.frequency = 'monthly' THEN (current_date + interval '6 months')::date ELSE NULL END,
    CASE WHEN status_ = 'pending_review' THEN public.care_add_working_days(current_date, 5) ELSE NULL END, test)
  RETURNING id, reference INTO sub_id, sub_ref;

  INSERT INTO public.care_consents(subscription_id, customer_id, kind, application_id, terms_version, terms_sha256, key_facts,
    key_facts_sha256, key_facts_shown_at, plan_code, frequency, price_minor, collection_day, ticked_terms_at, ticked_dd_at,
    ticked_account_holder_at, ticked_early_start, ticked_early_start_at, declared_over_18, verification_id, verification_method,
    verification_destination, verified_at, channel, invite_id, staff_id, ip, user_agent, page_url, snapshot)
  VALUES (sub_id, p_customer, 'join', app.id, app.terms_version, ver.terms_sha256, app.key_facts, app.key_facts_sha256,
    app.key_facts_shown_at, app.plan_code, app.frequency, app.price_minor, app.collection_day,
    coalesce((p->>'ticked_terms_at')::timestamptz, now()), coalesce((p->>'ticked_dd_at')::timestamptz, now()),
    coalesce((p->>'ticked_account_holder_at')::timestamptz, now()),
    coalesce((p->>'tick_early_start')::boolean, false), (p->>'ticked_early_start_at')::timestamptz, true,
    vrf.id, vrf.method, vrf.destination_masked, vrf.verified_at, app.channel, app.invite_id,
    (SELECT created_by FROM public.care_invites WHERE id = app.invite_id),
    left(p->>'ip', 100), left(p->>'user_agent', 500), left(p->>'page_url', 300),
    jsonb_build_object('server_received_at', now(), 'client', p->'client_snapshot', 'review', to_jsonb(review),
      'account_holder_name', p->>'account_holder_name', 'bank_name', p->>'bank_name',
      'masked_account_last4', p->>'masked_account_last4', 'masked_sort_last2', p->>'masked_sort_last2',
      'first_collection_date', app.first_collection_date, 'cooling_off_ends_at', cooling))
  RETURNING id INTO consent_id;

  INSERT INTO public.care_mandates(subscription_id, customer_id, reference, provider_code, status, account_holder_name, bank_name,
    masked_account_last4, masked_sort_last2, bank_details_ciphertext, enc_nonce, enc_key_id, enc_alg, signed_at, lodge_due_by, is_test)
  VALUES (sub_id, p_customer, sub_ref, (SELECT provider_code FROM public.care_settings WHERE singleton),
    CASE WHEN status_ = 'pending_review' THEN 'on_hold' ELSE 'awaiting_lodgement' END,
    left(p->>'account_holder_name', 120), left(p->>'bank_name', 120), p->>'masked_account_last4', p->>'masked_sort_last2',
    decode(regexp_replace(p->>'bank_ciphertext', '^\\x', ''), 'hex'), decode(regexp_replace(p->>'bank_nonce', '^\\x', ''), 'hex'),
    p->>'enc_key_id', 'AES-256-GCM', now(), public.care_add_working_days(current_date, 10), test)
  RETURNING id INTO mandate_id;

  first_end := (app.first_collection_date + make_interval(months => public.care_period_months(app.frequency)) - interval '1 day')::date;
  INSERT INTO public.care_collections(subscription_id, mandate_id, kind, due_date, amount_minor, period_start, period_end,
    notice_sent_at, notice_kind, is_test)
  VALUES (sub_id, mandate_id, 'first', app.first_collection_date, app.price_minor, app.first_collection_date, first_end,
    now(), 'dd_confirmation', test);

  UPDATE public.care_applications SET status = 'submitted', submitted_at = now() WHERE id = app.id;
  UPDATE public.care_verifications SET consumed_at = now() WHERE id = vrf.id;
  IF app.invite_id IS NOT NULL THEN UPDATE public.care_invites SET used_at = now() WHERE id = app.invite_id; END IF;

  PERFORM public.care_log(sub_id, p_customer, 'customer', p_customer, 'joined',
    jsonb_build_object('reference', sub_ref, 'consent_id', consent_id, 'status', status_, 'review', to_jsonb(review), 'channel', app.channel));

  PERFORM public.care_queue(sub_id, 'welcome_pack', jsonb_build_object('plan_code', app.plan_code, 'frequency', app.frequency,
    'price_minor', app.price_minor, 'collection_day', app.collection_day, 'first_collection_date', app.first_collection_date,
    'cooling_off_ends_on', cooling::date, 'started_early', coalesce((p->>'tick_early_start')::boolean, false),
    'terms_version', app.terms_version, 'pending_review', status_ = 'pending_review'), 'welcome:' || sub_id);
  PERFORM public.care_queue(sub_id, 'dd_confirmation', jsonb_build_object('price_minor', app.price_minor, 'frequency', app.frequency,
    'collection_day', app.collection_day, 'first_collection_date', app.first_collection_date,
    'account_holder_name', left(p->>'account_holder_name', 120), 'masked_account_last4', p->>'masked_account_last4',
    'masked_sort_last2', p->>'masked_sort_last2', 'bank_name', p->>'bank_name'), 'ddconf:' || sub_id);

  IF status_ = 'pending_review' THEN
    PERFORM public.care_task(p_customer, 'OCCTA Care review — ' || sub_ref,
      'Check Care is right for this customer before the mandate is lodged. Reasons: ' || array_to_string(review, ', ') ||
      CASE WHEN hold IS NOT NULL THEN '. 48-hour pause until ' || to_char(hold AT TIME ZONE 'Europe/London', 'DD Mon YYYY HH24:MI') || ' — call the customer to confirm.' ELSE '.' END ||
      ' Approve or decline in Admin → OCCTA Care. The mandate must be lodged by ' || to_char(public.care_add_working_days(current_date, 10), 'DD Mon YYYY') || '.',
      'high', public.care_add_working_days(current_date, 5));
  ELSE
    PERFORM public.care_task(p_customer, 'Lodge OCCTA Care mandate — ' || sub_ref,
      'Lodge this Care Direct Debit in the AccessPay portal under reference ' || sub_ref ||
      ' (separate from any broadband mandate), then mark it lodged in Admin → OCCTA Care → Direct Debit. Bacs deadline: ' ||
      to_char(public.care_add_working_days(current_date, 10), 'DD Mon YYYY') || '.', 'high', public.care_add_working_days(current_date, 8));
  END IF;

  RETURN jsonb_build_object('ok', true, 'subscription_id', sub_id, 'reference', sub_ref, 'status', status_,
    'first_collection_date', app.first_collection_date, 'cooling_off_ends_on', cooling::date, 'price_minor', app.price_minor);
END $$;

-- ---------------------------------------------------------------------------
-- Cancellation (shared by customer, staff, bank cancellations)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_cancel_internal(p_sub uuid, p_channel text, p_reason text, p_actor_type text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; c record; cur record; end_date date := current_date; refund_minor integer := 0; refunds jsonb := '[]';
  total_days integer; unused integer; amt integer; in_cooling boolean; ch text := p_channel;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF s.status IN ('cancelled','declined') THEN RETURN jsonb_build_object('ok', true, 'already', true, 'status', s.status); END IF;
  IF s.status = 'cancel_pending' AND p_channel <> 'bank' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', s.status, 'effective_date', s.cancel_effective_date);
  END IF;
  in_cooling := now() < s.cooling_off_ends_at;
  IF in_cooling AND p_channel NOT IN ('bank','occta') THEN ch := p_channel; END IF;

  -- Current period = a submitted or paid collection whose period covers today.
  SELECT * INTO cur FROM public.care_collections
   WHERE subscription_id = s.id AND status IN ('submitted','paid','in_run') AND period_start <= current_date AND period_end >= current_date
   ORDER BY period_start DESC LIMIT 1;

  IF FOUND THEN
    IF s.frequency = 'monthly' THEN
      end_date := cur.period_end; -- Monthly keeps the month already paid for.
    ELSE
      total_days := cur.period_end - cur.period_start + 1;
      unused := cur.period_end - current_date;
      amt := floor(cur.amount_minor::numeric * unused / total_days)::int;
      IF amt > 0 THEN
        INSERT INTO public.care_refunds(subscription_id, collection_id, amount_minor, reason, status, due_by, created_by)
        VALUES (s.id, cur.id, amt, 'Unused ' || unused || ' of ' || total_days || ' days after cancellation',
                CASE WHEN cur.status = 'paid' THEN 'to_pay' ELSE 'awaiting_collection' END, current_date + 14, p_actor)
        ON CONFLICT DO NOTHING;
        refund_minor := refund_minor + amt;
        refunds := refunds || jsonb_build_object('amount_minor', amt, 'reason', 'unused_time');
      END IF;
      end_date := current_date;
    END IF;
  END IF;

  -- Any later collection already sent to the bank is refunded in full.
  FOR c IN SELECT * FROM public.care_collections WHERE subscription_id = s.id AND status IN ('in_run','submitted','paid')
           AND period_start > current_date LOOP
    INSERT INTO public.care_refunds(subscription_id, collection_id, amount_minor, reason, status, due_by, created_by)
    VALUES (s.id, c.id, c.amount_minor, 'Payment for a period after cancellation',
            CASE WHEN c.status = 'paid' THEN 'to_pay' ELSE 'awaiting_collection' END, greatest(c.due_date, current_date) + 14, p_actor)
    ON CONFLICT DO NOTHING;
    refund_minor := refund_minor + c.amount_minor;
    refunds := refunds || jsonb_build_object('amount_minor', c.amount_minor, 'reason', 'future_period');
  END LOOP;

  UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'subscription_cancelled'
   WHERE subscription_id = s.id AND status IN ('scheduled','ready');

  UPDATE public.care_subscriptions SET
    status = CASE WHEN end_date > current_date THEN 'cancel_pending' ELSE 'cancelled' END,
    status_reason = 'cancelled_' || p_channel,
    cancel_requested_at = coalesce(cancel_requested_at, now()), cancel_channel = CASE WHEN in_cooling AND p_channel IN ('portal','phone','email','letter','chat') THEN 'in_cooling_off' ELSE p_channel END,
    cancel_reason = left(p_reason, 1000), cancel_effective_date = end_date,
    cancelled_at = CASE WHEN end_date > current_date THEN NULL ELSE now() END, cancelled_by = p_actor
   WHERE id = s.id;

  -- The mandate must be cancelled in the AccessPay portal by staff, unless the bank already did it.
  IF p_channel = 'bank' THEN
    UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), cancel_source = 'bank_addacs'
     WHERE subscription_id = s.id AND status NOT IN ('cancelled','rejected');
  ELSE
    UPDATE public.care_mandates SET status = CASE WHEN status IN ('on_hold','awaiting_lodgement') THEN 'cancelled' ELSE 'cancel_requested' END,
      cancel_requested_at = now(), cancelled_at = CASE WHEN status IN ('on_hold','awaiting_lodgement') THEN now() ELSE NULL END,
      cancel_source = CASE WHEN p_actor_type = 'customer' THEN 'customer_via_occta' ELSE 'occta' END
     WHERE subscription_id = s.id AND status NOT IN ('cancelled','rejected');
    IF EXISTS (SELECT 1 FROM public.care_mandates WHERE subscription_id = s.id AND status = 'cancel_requested') THEN
      PERFORM public.care_task(s.customer_id, 'Cancel OCCTA Care mandate — ' || s.reference,
        'The customer has cancelled Care. Cancel Direct Debit reference ' || s.reference || ' in the AccessPay portal before the next submission, then mark it cancelled in Admin → OCCTA Care.' ||
        CASE WHEN refund_minor > 0 THEN ' A refund of £' || to_char(refund_minor / 100.0, 'FM999990.00') || ' is due within 14 days.' ELSE '' END,
        'high', public.care_add_working_days(current_date, 1));
    END IF;
  END IF;

  -- Mandates never lodged hold no reason to keep bank details.
  UPDATE public.care_mandates SET bank_details_ciphertext = NULL, enc_nonce = NULL, ciphertext_purged_at = now()
   WHERE subscription_id = s.id AND status = 'cancelled' AND lodged_at IS NULL AND ciphertext_purged_at IS NULL;

  PERFORM public.care_log(s.id, s.customer_id, p_actor_type, p_actor, 'cancelled',
    jsonb_build_object('channel', p_channel, 'reason', p_reason, 'effective_date', end_date, 'refund_minor', refund_minor, 'in_cooling_off', in_cooling));
  PERFORM public.care_queue(s.id, 'cancellation_confirmation', jsonb_build_object('effective_date', end_date,
    'refund_minor', refund_minor, 'refunds', refunds, 'in_cooling_off', in_cooling, 'channel', p_channel, 'frequency', s.frequency),
    'cancel:' || s.id);
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN end_date > current_date THEN 'cancel_pending' ELSE 'cancelled' END,
    'effective_date', end_date, 'refund_minor', refund_minor);
END $$;

-- ---------------------------------------------------------------------------
-- Customer RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_my_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s record; m record;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('signed_in', false); END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE customer_id = uid ORDER BY created_at DESC LIMIT 1;
  -- Always assign m (a no-row SELECT INTO sets it to nulls, keeping it readable).
  SELECT status, masked_account_last4, masked_sort_last2, bank_name, account_holder_name INTO m
    FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'signed_in', true,
    'eligibility', public.care_eligibility(uid),
    'subscription', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', s.id, 'reference', s.reference, 'plan_code', s.plan_code, 'frequency', s.frequency, 'price_minor', s.price_minor,
      'collection_day', s.collection_day, 'status', s.status, 'joined_at', s.joined_at, 'cooling_off_ends_at', s.cooling_off_ends_at,
      'service_starts_on', s.service_starts_on, 'first_collection_date', s.first_collection_date,
      'cancel_effective_date', s.cancel_effective_date, 'cancelled_at', s.cancelled_at, 'terms_version', s.terms_version,
      'mandate', CASE WHEN m.status IS NULL THEN NULL ELSE jsonb_build_object('status', m.status, 'last4', m.masked_account_last4,
        'sort_last2', m.masked_sort_last2, 'bank_name', m.bank_name, 'holder', m.account_holder_name) END) END,
    'next_payment', (SELECT jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor)
       FROM public.care_collections c WHERE c.subscription_id = s.id AND c.status IN ('scheduled','ready','in_run','submitted')
       ORDER BY c.due_date LIMIT 1),
    'payments', coalesce((SELECT jsonb_agg(jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor,
       'period_start', c.period_start, 'period_end', c.period_end,
       'status', CASE WHEN c.status IN ('ready','in_run') THEN 'scheduled' ELSE c.status END) ORDER BY c.due_date DESC)
       FROM public.care_collections c WHERE c.subscription_id = s.id AND c.status <> 'cancelled'), '[]'),
    'letters', coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'type', l.letter_type, 'created_at', l.created_at,
       'pdf_path', l.pdf_path, 'posted_on', l.posted_on) ORDER BY l.created_at DESC)
       FROM public.care_letters l WHERE l.customer_id = uid AND l.pdf_path IS NOT NULL AND l.copy_for IS NULL), '[]'),
    'usage', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', u.kind, 'occurred_at', u.occurred_at) ORDER BY u.occurred_at DESC)
       FROM public.care_usage u WHERE u.subscription_id = s.id), '[]'),
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status, 'created_at', r.created_at)
       ORDER BY r.created_at DESC) FROM public.care_requests r WHERE r.subscription_id = s.id), '[]'),
    'refunds', coalesce((SELECT jsonb_agg(jsonb_build_object('amount_minor', f.amount_minor, 'status', f.status, 'paid_at', f.paid_at))
       FROM public.care_refunds f WHERE f.subscription_id = s.id AND f.status <> 'cancelled'), '[]'),
    'support_needs', (SELECT jsonb_build_object('needs', n.needs, 'carer_name', n.carer_name) FROM public.care_support_needs n WHERE n.customer_id = uid)
  );
END $$;

CREATE OR REPLACE FUNCTION public.care_my_cancel(p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); sid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT id INTO sid FROM public.care_subscriptions WHERE customer_id = uid
    AND status IN ('pending_review','pending_mandate','active','paused','cancel_pending') ORDER BY created_at DESC LIMIT 1;
  IF sid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_active_care'); END IF;
  PERFORM public.care_log(sid, uid, 'customer', uid, 'cancel_requested_portal',
    jsonb_build_object('ip', public.care_request_header('x-forwarded-for'), 'user_agent', left(public.care_request_header('user-agent'), 300)));
  RETURN public.care_cancel_internal(sid, 'portal', nullif(left(p_reason, 1000), ''), 'customer', uid);
END $$;

CREATE OR REPLACE FUNCTION public.care_my_request(p_kind text, p_details text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s record; rid uuid; tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF p_kind NOT IN ('help','device_setup','wifi_setup','repair_quote','router_fault','health_check','extender') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF length(coalesce(btrim(p_details), '')) < 3 THEN RAISE EXCEPTION 'details_required'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE customer_id = uid AND status IN ('pending_review','pending_mandate','active','cancel_pending')
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_active_care'); END IF;
  IF (SELECT count(*) FROM public.care_requests WHERE customer_id = uid AND created_at > now() - interval '1 hour') >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;
  INSERT INTO public.support_tickets(user_id, subject, description, category, priority)
  VALUES (uid, left('OCCTA Care (' || s.plan_code || ') — ' || replace(p_kind, '_', ' '), 200),
          left(p_details, 2000) || E'\n\nCare reference: ' || s.reference, 'occta_care',
          CASE WHEN s.plan_code = 'plus' THEN 'high'::ticket_priority ELSE 'medium'::ticket_priority END)
  RETURNING id INTO tid;
  INSERT INTO public.care_requests(subscription_id, customer_id, kind, details, ticket_id)
  VALUES (s.id, uid, p_kind, left(p_details, 2000), tid) RETURNING id INTO rid;
  PERFORM public.care_log(s.id, uid, 'customer', uid, 'request_created', jsonb_build_object('kind', p_kind, 'ticket_id', tid));
  RETURN jsonb_build_object('ok', true, 'request_id', rid, 'ticket_id', tid);
END $$;

CREATE OR REPLACE FUNCTION public.care_my_update_support_needs(p_needs text[], p_consent boolean, p_other text DEFAULT NULL,
  p_carer_name text DEFAULT NULL, p_carer_contact text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF coalesce(cardinality(p_needs), 0) = 0 AND p_other IS NULL AND p_carer_name IS NULL THEN
    DELETE FROM public.care_support_needs WHERE customer_id = uid AND NOT staff_sales_block;
    UPDATE public.care_support_needs SET needs = '{}', other_detail = NULL, carer_name = NULL, carer_contact = NULL, updated_at = now(), updated_by = uid
      WHERE customer_id = uid;
    PERFORM public.care_log(NULL, uid, 'customer', uid, 'support_needs_removed', '{}');
    RETURN jsonb_build_object('ok', true, 'removed', true);
  END IF;
  IF NOT coalesce(p_consent, false) THEN RETURN jsonb_build_object('ok', false, 'error', 'consent_required'); END IF;
  INSERT INTO public.care_support_needs(customer_id, needs, other_detail, carer_name, carer_contact, consent_at, consent_source, updated_by)
  VALUES (uid, coalesce(p_needs, '{}'), nullif(left(p_other, 500), ''), nullif(left(p_carer_name, 120), ''), nullif(left(p_carer_contact, 300), ''), now(), 'customer_web', uid)
  ON CONFLICT (customer_id) DO UPDATE SET needs = EXCLUDED.needs, other_detail = EXCLUDED.other_detail, carer_name = EXCLUDED.carer_name,
    carer_contact = EXCLUDED.carer_contact, consent_at = EXCLUDED.consent_at, consent_source = 'customer_web', updated_at = now(), updated_by = uid;
  PERFORM public.care_log(NULL, uid, 'customer', uid, 'support_needs_updated', jsonb_build_object('needs', p_needs));
  RETURN jsonb_build_object('ok', true);
END $$;

-- Plan change: takes effect from the next collection not yet sent to the bank
-- that is at least 12 working days away, with a written change notice.
CREATE OR REPLACE FUNCTION public.care_my_change_plan(p_plan text, p_agree boolean, p_key_facts jsonb, p_key_facts_sha text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s record; newp integer; c record; ver record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF NOT coalesce(p_agree, false) THEN RETURN jsonb_build_object('ok', false, 'error', 'agreement_required'); END IF;
  IF p_key_facts_sha !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'key_facts_required'); END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE customer_id = uid AND status IN ('pending_mandate','active') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_active_care'); END IF;
  IF p_plan = s.plan_code THEN RETURN jsonb_build_object('ok', false, 'error', 'same_plan'); END IF;
  newp := public.care_price_minor(p_plan, s.frequency);
  IF newp IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'plan_unavailable'); END IF;
  SELECT * INTO c FROM public.care_collections WHERE subscription_id = s.id AND status = 'scheduled'
    AND public.care_working_days_between(current_date, due_date) >= 12 ORDER BY due_date LIMIT 1;
  SELECT * INTO ver FROM public.care_terms_versions WHERE version = s.terms_version;
  INSERT INTO public.care_consents(subscription_id, customer_id, kind, terms_version, terms_sha256, key_facts, key_facts_sha256,
    key_facts_shown_at, plan_code, frequency, price_minor, collection_day, ticked_terms_at, declared_over_18, channel, ip, user_agent, snapshot)
  VALUES (s.id, uid, 'plan_change', s.terms_version, ver.terms_sha256, coalesce(p_key_facts, '[]'), p_key_facts_sha, now(), p_plan,
    s.frequency, newp, s.collection_day, now(), true, 'portal', public.care_request_header('x-forwarded-for'),
    left(public.care_request_header('user-agent'), 500),
    jsonb_build_object('from_plan', s.plan_code, 'from_price_minor', s.price_minor, 'effective_collection', c.id, 'effective_date', c.due_date));
  UPDATE public.care_subscriptions SET plan_code = p_plan, price_minor = newp WHERE id = s.id;
  IF c.id IS NOT NULL THEN
    UPDATE public.care_collections SET amount_minor = newp, notice_sent_at = now(), notice_kind = 'change_notice' WHERE id = c.id;
  END IF;
  PERFORM public.care_log(s.id, uid, 'customer', uid, 'plan_changed', jsonb_build_object('from', s.plan_code, 'to', p_plan, 'price_minor', newp, 'effective_date', c.due_date));
  PERFORM public.care_queue(s.id, 'change_notice', jsonb_build_object('kind', 'plan_change', 'from_plan', s.plan_code, 'to_plan', p_plan,
    'old_price_minor', s.price_minor, 'new_price_minor', newp, 'frequency', s.frequency, 'effective_date', c.due_date),
    'planchange:' || s.id || ':' || extract(epoch FROM now())::bigint);
  RETURN jsonb_build_object('ok', true, 'new_price_minor', newp, 'effective_date', c.due_date);
END $$;

-- ---------------------------------------------------------------------------
-- Outbox lease (worker = care-dispatch edge function)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_claim_outbox(p_limit integer DEFAULT 10) RETURNS SETOF public.care_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.care_outbox o SET status = 'processing', lease = gen_random_uuid(), locked_until = now() + interval '5 minutes',
         attempts = o.attempts + 1
   WHERE o.id IN (SELECT id FROM public.care_outbox
                  WHERE (status = 'pending' OR (status = 'processing' AND locked_until < now())) AND attempts < 6
                  ORDER BY created_at LIMIT greatest(1, least(p_limit, 25)) FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION public.care_finish_outbox(p_id uuid, p_lease uuid, p_ok boolean, p_error text, p_status text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.care_outbox SET
    status = CASE WHEN p_status IS NOT NULL THEN p_status WHEN p_ok THEN 'done' WHEN attempts >= 6 THEN 'failed' ELSE 'pending' END,
    last_error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 500) END,
    finished_at = CASE WHEN p_ok OR attempts >= 6 THEN now() ELSE NULL END,
    locked_until = NULL
  WHERE id = p_id AND lease = p_lease;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.care_dispatch_messages() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.care_outbox WHERE status = 'pending' OR (status = 'processing' AND locked_until < now())) THEN
    RETURN false;
  END IF;
  PERFORM public.invoke_edge_function_from_cron('care-dispatch', '{}'::jsonb);
  RETURN true;
END $$;

-- ---------------------------------------------------------------------------
-- Nightly engine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_nightly() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; c record; m record; nxt date; nxt_end date; due date; n_sched int := 0; n_notice int := 0; n_ready int := 0;
  n_resched int := 0; n_usage int := 0; n_end int := 0; n_tasks int := 0; mths int; used int;
BEGIN
  UPDATE public.care_applications SET status = 'expired' WHERE status = 'draft' AND expires_at < now();

  -- 1. Finish cancellations whose paid period has ended.
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'cancel_pending' AND cancel_effective_date < current_date LOOP
    UPDATE public.care_subscriptions SET status = 'cancelled', cancelled_at = now() WHERE id = s.id;
    PERFORM public.care_log(s.id, s.customer_id, 'system', NULL, 'cancellation_effective', jsonb_build_object('date', s.cancel_effective_date));
    n_end := n_end + 1;
  END LOOP;

  -- 2. Review holds past their time with no decision: remind staff (never auto-approve).
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'pending_review' AND welcome_call_due_on = current_date LOOP
    PERFORM public.care_task(s.customer_id, 'OCCTA Care review overdue — ' || s.reference,
      'This sale is still waiting for a review decision. The Bacs lodging deadline is ' ||
      to_char((SELECT lodge_due_by FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1), 'DD Mon YYYY') ||
      '. If it can''t be approved in time, decline it (nothing has been collected).', 'urgent', current_date);
    n_tasks := n_tasks + 1;
  END LOOP;

  -- 3. Lodging deadline: warn 2 working days ahead; past it, the sale cannot proceed under that Instruction.
  FOR m IN SELECT cm.*, cs.customer_id AS cust, cs.reference AS sref FROM public.care_mandates cm JOIN public.care_subscriptions cs ON cs.id = cm.subscription_id
           WHERE cm.status = 'awaiting_lodgement' AND public.care_add_working_days(current_date, 2) = cm.lodge_due_by LOOP
    PERFORM public.care_task(m.cust, 'Care mandate lodging deadline in 2 working days — ' || m.sref,
      'Lodge ' || m.sref || ' in AccessPay by ' || to_char(m.lodge_due_by, 'DD Mon YYYY') || '.', 'urgent', m.lodge_due_by);
    n_tasks := n_tasks + 1;
  END LOOP;

  -- 4. Schedule the next collection for active members (one period ahead).
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'active' AND NOT is_test LOOP
    SELECT * INTO c FROM public.care_collections WHERE subscription_id = s.id AND kind <> 'represent' AND status <> 'cancelled'
      ORDER BY period_start DESC LIMIT 1;
    CONTINUE WHEN c.id IS NULL;
    CONTINUE WHEN c.period_end > current_date + 45;
    mths := public.care_period_months(s.frequency);
    nxt := c.period_end + 1;
    nxt_end := (nxt + make_interval(months => mths) - interval '1 day')::date;
    due := public.care_next_working_day(nxt);
    SELECT * INTO m FROM public.care_mandates WHERE subscription_id = s.id AND status IN ('active','lodged') ORDER BY created_at DESC LIMIT 1;
    INSERT INTO public.care_collections(subscription_id, mandate_id, kind, due_date, amount_minor, period_start, period_end,
      notice_sent_at, notice_kind)
    VALUES (s.id, m.id, 'recurring', due, s.price_minor, nxt, nxt_end,
      -- Monthly members were given the full schedule in their DD confirmation; same amount and day = notice already given.
      CASE WHEN s.frequency = 'monthly' AND extract(day FROM nxt) = s.collection_day THEN s.joined_at ELSE NULL END,
      CASE WHEN s.frequency = 'monthly' AND extract(day FROM nxt) = s.collection_day THEN 'schedule_in_dd_confirmation' ELSE NULL END)
    ON CONFLICT DO NOTHING;
    n_sched := n_sched + 1;
  END LOOP;

  -- 5. Renewal reminder (= advance notice) for quarterly/annual, 30 days before.
  FOR c IN SELECT cc.*, cs.frequency, cs.reference, cs.customer_id FROM public.care_collections cc JOIN public.care_subscriptions cs ON cs.id = cc.subscription_id
           WHERE cc.status = 'scheduled' AND cc.notice_sent_at IS NULL AND cc.kind = 'recurring'
             AND cs.status = 'active' AND cc.due_date <= current_date + 30 LOOP
    SELECT count(*) INTO used FROM public.care_usage u WHERE u.subscription_id = c.subscription_id AND u.occurred_at > now() - interval '12 months';
    PERFORM public.care_queue(c.subscription_id, 'renewal_reminder', jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor,
      'period_start', c.period_start, 'period_end', c.period_end, 'frequency', c.frequency, 'usage_count', used), 'renew:' || c.id);
    UPDATE public.care_collections SET notice_sent_at = now(), notice_kind = 'renewal_reminder' WHERE id = c.id;
    n_notice := n_notice + 1;
  END LOOP;

  -- 6. Any other collection without notice that is getting close: send an advance notice.
  FOR c IN SELECT cc.*, cs.frequency FROM public.care_collections cc JOIN public.care_subscriptions cs ON cs.id = cc.subscription_id
           WHERE cc.status = 'scheduled' AND cc.notice_sent_at IS NULL AND cs.status = 'active' AND cc.due_date <= current_date + 30 LOOP
    PERFORM public.care_queue(c.subscription_id, 'advance_notice', jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor,
      'period_start', c.period_start, 'period_end', c.period_end, 'frequency', c.frequency, 'kind', c.kind), 'notice:' || c.id);
    UPDATE public.care_collections SET notice_sent_at = now(), notice_kind = 'advance_notice' WHERE id = c.id;
    n_notice := n_notice + 1;
  END LOOP;

  -- 7. Promote to 'ready' (within 7 days of due, mandate active, notice >= 12 working days before due).
  --    If the mandate isn't active or notice was too late, move the collection to the next cycle with fresh notice.
  FOR c IN SELECT cc.*, cs.frequency, cs.collection_day, cs.status AS sub_status, cs.customer_id FROM public.care_collections cc
           JOIN public.care_subscriptions cs ON cs.id = cc.subscription_id
           WHERE cc.status = 'scheduled' AND cc.due_date <= current_date + 7 AND NOT cc.is_test LOOP
    SELECT * INTO m FROM public.care_mandates WHERE subscription_id = c.subscription_id ORDER BY created_at DESC LIMIT 1;
    IF c.sub_status IN ('pending_mandate','active') AND m.status = 'active' AND c.notice_sent_at IS NOT NULL
       AND public.care_working_days_between(c.notice_sent_at::date, c.due_date) >= 12 THEN
      UPDATE public.care_collections SET status = 'ready', mandate_id = m.id WHERE id = c.id;
      n_ready := n_ready + 1;
    ELSIF c.sub_status IN ('pending_review','pending_mandate','active') THEN
      due := public.care_next_working_day(public.care_day_on_or_after(public.care_add_working_days(current_date, 15), c.collection_day));
      UPDATE public.care_collections SET due_date = due, period_start = due,
        period_end = (due + make_interval(months => public.care_period_months(c.frequency)) - interval '1 day')::date,
        notice_sent_at = now(), notice_kind = 'change_notice', reschedule_count = reschedule_count + 1
       WHERE id = c.id;
      UPDATE public.care_subscriptions SET first_collection_date = due WHERE id = c.subscription_id AND c.kind = 'first';
      PERFORM public.care_queue(c.subscription_id, 'change_notice', jsonb_build_object('kind', 'date_moved', 'old_date', c.due_date,
        'new_date', due, 'amount_minor', c.amount_minor, 'frequency', c.frequency,
        'reason', CASE WHEN m.status IS DISTINCT FROM 'active' THEN 'mandate_not_ready' ELSE 'notice' END),
        'moved:' || c.id || ':' || c.reschedule_count);
      PERFORM public.care_log(c.subscription_id, c.customer_id, 'system', NULL, 'collection_rescheduled',
        jsonb_build_object('collection_id', c.id, 'from', c.due_date, 'to', due, 'mandate_status', m.status));
      n_resched := n_resched + 1;
    END IF;
  END LOOP;

  -- 8. Six-monthly usage reminders for monthly members (with a low-use question).
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'active' AND frequency = 'monthly' AND next_usage_reminder_on <= current_date LOOP
    SELECT count(*) INTO used FROM public.care_usage u WHERE u.subscription_id = s.id AND u.occurred_at > now() - interval '6 months';
    PERFORM public.care_queue(s.id, 'usage_reminder', jsonb_build_object('usage_count', used, 'low_use', used = 0,
      'price_minor', s.price_minor, 'frequency', s.frequency, 'since', (now() - interval '6 months')::date), 'usage:' || s.id || ':' || current_date);
    UPDATE public.care_subscriptions SET next_usage_reminder_on = (current_date + interval '6 months')::date, last_usage_reminder_at = now() WHERE id = s.id;
    n_usage := n_usage + 1;
  END LOOP;

  -- 9. Low-use check for prepaid members halfway through a year (no usage in 6 months).
  FOR s IN SELECT cs.* FROM public.care_subscriptions cs WHERE cs.status = 'active' AND cs.frequency <> 'monthly'
           AND cs.joined_at < now() - interval '6 months'
           AND (cs.last_usage_reminder_at IS NULL OR cs.last_usage_reminder_at < now() - interval '6 months')
           AND NOT EXISTS (SELECT 1 FROM public.care_usage u WHERE u.subscription_id = cs.id AND u.occurred_at > now() - interval '6 months') LOOP
    PERFORM public.care_queue(s.id, 'usage_reminder', jsonb_build_object('usage_count', 0, 'low_use', true, 'price_minor', s.price_minor,
      'frequency', s.frequency, 'since', (now() - interval '6 months')::date), 'usage:' || s.id || ':' || current_date);
    UPDATE public.care_subscriptions SET last_usage_reminder_at = now() WHERE id = s.id;
    n_usage := n_usage + 1;
  END LOOP;

  -- 10. Indemnity claims: escalate one working day before the challenge window closes.
  FOR c IN SELECT d.*, cs.customer_id, cs.reference FROM public.care_disputes d JOIN public.care_subscriptions cs ON cs.id = d.subscription_id
           WHERE d.status = 'open' AND d.kind = 'indemnity_claim' AND d.respond_by = public.care_add_working_days(current_date, 1) LOOP
    PERFORM public.care_task(c.customer_id, 'Care indemnity claim decision due tomorrow — ' || c.reference,
      'Decide whether to challenge or accept the indemnity claim in Admin → OCCTA Care → Disputes. Window closes ' || to_char(c.respond_by, 'DD Mon YYYY') || '.',
      'urgent', c.respond_by);
    n_tasks := n_tasks + 1;
  END LOOP;

  -- 11. Bank details: keep only while a mandate may need re-lodging.
  UPDATE public.care_mandates SET bank_details_ciphertext = NULL, enc_nonce = NULL, ciphertext_purged_at = now()
   WHERE ciphertext_purged_at IS NULL AND ((status IN ('cancelled','rejected') AND updated_at < now() - interval '30 days')
          OR (status = 'active' AND activated_at < now() - interval '90 days'));

  -- 12. Welcome calls for reviewed sales.
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status IN ('pending_mandate','active') AND welcome_call_done_at IS NULL
           AND welcome_call_due_on = current_date AND cardinality(review_reasons) > 0 LOOP
    PERFORM public.care_task(s.customer_id, 'OCCTA Care welcome call — ' || s.reference,
      'Call to check the customer understands Care and still wants it. Record the call in Admin → OCCTA Care. If they want to cancel, cancel it there (no charge).',
      'high', current_date);
    n_tasks := n_tasks + 1;
  END LOOP;

  RETURN jsonb_build_object('scheduled', n_sched, 'notices', n_notice, 'ready', n_ready, 'rescheduled', n_resched,
    'usage_reminders', n_usage, 'ended', n_end, 'tasks', n_tasks);
END $$;

-- ---------------------------------------------------------------------------
-- Admin: read models
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.care_require(false);
  RETURN jsonb_build_object(
    'settings', (SELECT to_jsonb(st) FROM public.care_settings st WHERE singleton),
    'plans', (SELECT jsonb_agg(to_jsonb(p) ORDER BY sort_order) FROM public.care_plans p),
    'members', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM public.care_subscriptions WHERE NOT is_test GROUP BY status) x),
    'by_plan', (SELECT coalesce(jsonb_object_agg(k, n), '{}') FROM (SELECT plan_code || ':' || frequency k, count(*) n FROM public.care_subscriptions
                 WHERE status IN ('pending_mandate','active','cancel_pending') AND NOT is_test GROUP BY 1) x),
    'mandates_to_lodge', (SELECT count(*) FROM public.care_mandates WHERE status = 'awaiting_lodgement'),
    'mandates_lodged_unconfirmed', (SELECT count(*) FROM public.care_mandates WHERE status = 'lodged'),
    'mandates_to_cancel', (SELECT count(*) FROM public.care_mandates WHERE status = 'cancel_requested'),
    'reviews', (SELECT count(*) FROM public.care_subscriptions WHERE status = 'pending_review'),
    'collections_ready', (SELECT count(*) FROM public.care_collections WHERE status = 'ready'),
    'collections_awaiting_result', (SELECT count(*) FROM public.care_collections WHERE status = 'submitted'),
    'open_disputes', (SELECT count(*) FROM public.care_disputes WHERE status = 'open'),
    'refunds_to_pay', (SELECT coalesce(sum(amount_minor), 0) FROM public.care_refunds WHERE status = 'to_pay'),
    'letters_to_print', (SELECT count(*) FROM public.care_letters WHERE status IN ('awaiting_print','needs_manual')),
    'outbox_failed', (SELECT count(*) FROM public.care_outbox WHERE status = 'failed'),
    'monthly_revenue_minor', (SELECT coalesce(sum(CASE frequency WHEN 'annual' THEN price_minor / 12.0 WHEN 'quarterly' THEN price_minor / 3.0 ELSE price_minor END), 0)::int
                               FROM public.care_subscriptions WHERE status IN ('pending_mandate','active') AND NOT is_test)
  );
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_list(p_filter text DEFAULT 'all', p_search text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := nullif(btrim(lower(p_search)), '');
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.joined_at DESC) FROM (
    SELECT s.id, s.reference, s.status, s.plan_code, s.frequency, s.price_minor, s.channel, s.joined_at, s.first_collection_date,
           s.review_reasons, s.cancel_effective_date, s.is_test, p.full_name, p.account_number, p.email, p.postcode,
           (SELECT status FROM public.care_mandates m WHERE m.subscription_id = s.id ORDER BY created_at DESC LIMIT 1) AS mandate_status,
           (SELECT max(occurred_at) FROM public.care_usage u WHERE u.subscription_id = s.id) AS last_used
      FROM public.care_subscriptions s LEFT JOIN public.profiles p ON p.id = s.customer_id
     WHERE (p_filter = 'all'
         OR (p_filter = 'live' AND s.status IN ('pending_mandate','active','cancel_pending'))
         OR (p_filter = 'review' AND s.status = 'pending_review')
         OR (p_filter = 'paused' AND s.status = 'paused')
         OR (p_filter = 'ended' AND s.status IN ('cancelled','declined'))
         OR (p_filter = 'low_use' AND s.status = 'active' AND s.joined_at < now() - interval '6 months'
             AND NOT EXISTS (SELECT 1 FROM public.care_usage u WHERE u.subscription_id = s.id AND u.occurred_at > now() - interval '6 months')))
       AND (q IS NULL OR lower(s.reference) LIKE '%' || q || '%' OR lower(coalesce(p.full_name, '')) LIKE '%' || q || '%'
         OR lower(coalesce(p.account_number, '')) LIKE '%' || q || '%' OR lower(coalesce(p.email, '')) LIKE '%' || q || '%'
         OR lower(replace(coalesce(p.postcode, ''), ' ', '')) LIKE '%' || replace(q, ' ', '') || '%')
     LIMIT 500) x), '[]');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_member(p_sub uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  PERFORM public.care_require(false);
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN jsonb_build_object(
    'subscription', to_jsonb(s),
    'customer', (SELECT jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email, 'phone', p.phone, 'account_number', p.account_number,
       'address', concat_ws(', ', p.address_line1, p.address_line2, p.city, p.postcode), 'date_of_birth_known', p.date_of_birth IS NOT NULL)
       FROM public.profiles p WHERE p.id = s.customer_id),
    'support_needs', (SELECT to_jsonb(n) FROM public.care_support_needs n WHERE n.customer_id = s.customer_id),
    'consents', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at) FROM public.care_consents c WHERE c.subscription_id = s.id), '[]'),
    'mandates', coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'reference', m.reference, 'status', m.status, 'holder', m.account_holder_name,
       'bank_name', m.bank_name, 'last4', m.masked_account_last4, 'sort_last2', m.masked_sort_last2, 'signed_at', m.signed_at,
       'lodge_due_by', m.lodge_due_by, 'lodged_at', m.lodged_at, 'provider_reference', m.provider_reference, 'activated_at', m.activated_at,
       'rejected_at', m.rejected_at, 'rejection_reason', m.rejection_reason, 'cancelled_at', m.cancelled_at, 'cancel_source', m.cancel_source,
       'cancel_reason_code', m.cancel_reason_code, 'details_available', m.bank_details_ciphertext IS NOT NULL) ORDER BY m.created_at)
       FROM public.care_mandates m WHERE m.subscription_id = s.id), '[]'),
    'collections', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.due_date) FROM public.care_collections c WHERE c.subscription_id = s.id), '[]'),
    'refunds', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.created_at) FROM public.care_refunds f WHERE f.subscription_id = s.id), '[]'),
    'disputes', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at) FROM public.care_disputes d WHERE d.subscription_id = s.id), '[]'),
    'letters', coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'type', l.letter_type, 'status', l.status, 'delivery', l.delivery,
       'pdf_path', l.pdf_path, 'pdf_sha256', l.pdf_sha256, 'posted_on', l.posted_on, 'email_status', l.email_status, 'copy_for', l.copy_for,
       'created_at', l.created_at, 'error', l.error) ORDER BY l.created_at) FROM public.care_letters l WHERE l.subscription_id = s.id), '[]'),
    'usage', coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.occurred_at DESC) FROM public.care_usage u WHERE u.subscription_id = s.id), '[]'),
    'requests', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM public.care_requests r WHERE r.subscription_id = s.id), '[]'),
    'evidence_packs', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC) FROM public.care_evidence_packs e WHERE e.subscription_id = s.id), '[]'),
    'complaints', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'reference', c.complaint_reference, 'status', c.status, 'opened_at', c.opened_at))
       FROM public.complaints c WHERE c.customer_id = s.customer_id AND c.category = 'occta_care'), '[]'),
    'invite', (SELECT to_jsonb(i) - 'token_hash' FROM public.care_invites i WHERE i.id = s.invite_id),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.care_events e WHERE e.subscription_id = s.id), '[]')
  );
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_mandate_queue() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.lodge_due_by NULLS LAST, x.created_at) FROM (
    SELECT m.id, m.reference, m.status, m.account_holder_name, m.bank_name, m.masked_account_last4, m.masked_sort_last2,
           m.signed_at, m.lodge_due_by, m.lodged_at, m.provider_reference, m.cancel_requested_at, m.created_at,
           m.bank_details_ciphertext IS NOT NULL AS details_available, s.id AS subscription_id, s.status AS subscription_status,
           s.review_hold_until, p.full_name, p.account_number,
           concat_ws(', ', p.address_line1, p.address_line2, p.city, p.postcode) AS address
      FROM public.care_mandates m JOIN public.care_subscriptions s ON s.id = m.subscription_id LEFT JOIN public.profiles p ON p.id = s.customer_id
     WHERE m.status IN ('on_hold','awaiting_lodgement','lodged','cancel_requested')) x), '[]');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_collections(p_status text DEFAULT 'ready') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.due_date, x.reference) FROM (
    SELECT c.id, c.kind, c.due_date, c.amount_minor, c.period_start, c.period_end, c.status, c.notice_sent_at, c.notice_kind, c.run_id,
           c.submitted_at, c.unpaid_reason_code, c.bank_received_date, s.reference, s.id AS subscription_id, s.frequency,
           m.account_holder_name, m.provider_reference, m.masked_account_last4, p.full_name, p.account_number,
           (SELECT run_number FROM public.care_collection_runs r WHERE r.id = c.run_id) AS run_number
      FROM public.care_collections c JOIN public.care_subscriptions s ON s.id = c.subscription_id
      LEFT JOIN public.care_mandates m ON m.id = c.mandate_id LEFT JOIN public.profiles p ON p.id = s.customer_id
     WHERE (p_status = 'all' OR c.status = p_status OR (p_status = 'upcoming' AND c.status = 'scheduled' AND c.due_date <= current_date + 35))
       AND NOT c.is_test
     LIMIT 1000) x), '[]');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_disputes() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.status = 'open' DESC, x.respond_by) FROM (
    SELECT d.*, s.reference, p.full_name, p.account_number, (d.respond_by - current_date) AS days_left
      FROM public.care_disputes d JOIN public.care_subscriptions s ON s.id = d.subscription_id LEFT JOIN public.profiles p ON p.id = s.customer_id
     ORDER BY d.created_at DESC LIMIT 300) x), '[]');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_letters(p_status text DEFAULT 'to_print') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at) FROM (
    SELECT l.id, l.letter_type, l.status, l.delivery, l.pdf_path, l.pdf_sha256, l.posted_on, l.email_status, l.error, l.large_print,
           l.copy_for, l.created_at, l.batch_id, l.recipient->>'name' AS name, l.recipient->>'postcode' AS postcode, s.reference
      FROM public.care_letters l LEFT JOIN public.care_subscriptions s ON s.id = l.subscription_id
     WHERE (p_status = 'all') OR (p_status = 'to_print' AND l.status IN ('awaiting_print','needs_manual','in_batch'))
        OR (p_status = 'problems' AND l.status IN ('failed','needs_manual')) OR l.status = p_status
     ORDER BY l.created_at DESC LIMIT 500) x), '[]');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_refunds() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.status <> 'to_pay', x.due_by) FROM (
    SELECT f.*, s.reference, p.full_name, p.account_number FROM public.care_refunds f
      JOIN public.care_subscriptions s ON s.id = f.subscription_id LEFT JOIN public.profiles p ON p.id = s.customer_id
     ORDER BY f.created_at DESC LIMIT 300) x), '[]');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_report(p_month date DEFAULT date_trunc('month', current_date)::date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a timestamptz := date_trunc('month', p_month); b timestamptz := date_trunc('month', p_month) + interval '1 month'; live int;
BEGIN
  PERFORM public.care_require(false);
  SELECT count(*) INTO live FROM public.care_subscriptions WHERE status IN ('pending_mandate','active','cancel_pending') AND NOT is_test;
  RETURN jsonb_build_object(
    'month', to_char(a, 'YYYY-MM'),
    'live_members', live,
    'joined', (SELECT count(*) FROM public.care_subscriptions WHERE joined_at >= a AND joined_at < b AND NOT is_test),
    'joined_by_channel', (SELECT coalesce(jsonb_object_agg(channel, n), '{}') FROM (SELECT channel, count(*) n FROM public.care_subscriptions
       WHERE joined_at >= a AND joined_at < b AND NOT is_test GROUP BY channel) x),
    'joined_by_staff', (SELECT coalesce(jsonb_agg(jsonb_build_object('staff_id', sold_by, 'name', (SELECT full_name FROM public.profiles WHERE id = sold_by), 'n', n)), '[]')
       FROM (SELECT sold_by, count(*) n FROM public.care_subscriptions WHERE joined_at >= a AND joined_at < b AND sold_by IS NOT NULL AND NOT is_test GROUP BY sold_by) x),
    'cancelled', (SELECT count(*) FROM public.care_subscriptions WHERE cancel_requested_at >= a AND cancel_requested_at < b AND NOT is_test),
    'cancelled_in_cooling_off', (SELECT count(*) FROM public.care_subscriptions WHERE cancel_requested_at >= a AND cancel_requested_at < b AND cancel_channel = 'in_cooling_off' AND NOT is_test),
    'declined', (SELECT count(*) FROM public.care_subscriptions WHERE status = 'declined' AND reviewed_at >= a AND reviewed_at < b),
    'paid_minor', (SELECT coalesce(sum(amount_minor), 0) FROM public.care_collections WHERE status = 'paid' AND bank_received_date >= a::date AND bank_received_date < b::date AND NOT is_test),
    'unpaid', (SELECT count(*) FROM public.care_collections WHERE unpaid_recorded_at >= a AND unpaid_recorded_at < b AND NOT is_test),
    'indemnity_claims', (SELECT count(*) FROM public.care_disputes WHERE kind = 'indemnity_claim' AND created_at >= a AND created_at < b),
    'refunds_minor', (SELECT coalesce(sum(amount_minor), 0) FROM public.care_refunds WHERE created_at >= a AND created_at < b AND status <> 'cancelled'),
    'complaints', (SELECT count(*) FROM public.complaints WHERE category = 'occta_care' AND opened_at >= a AND opened_at < b),
    'complaints_per_1000', CASE WHEN live > 0 THEN round((SELECT count(*) FROM public.complaints WHERE category = 'occta_care' AND opened_at >= a AND opened_at < b) * 1000.0 / live, 1) ELSE 0 END,
    'low_use_members', (SELECT count(*) FROM public.care_subscriptions s WHERE s.status = 'active' AND s.joined_at < now() - interval '6 months'
       AND NOT EXISTS (SELECT 1 FROM public.care_usage u WHERE u.subscription_id = s.id AND u.occurred_at > now() - interval '6 months')),
    'usage', (SELECT coalesce(jsonb_object_agg(kind, n), '{}') FROM (SELECT kind, count(*) n FROM public.care_usage WHERE occurred_at >= a AND occurred_at < b GROUP BY kind) x),
    'letters_sent', (SELECT count(*) FROM public.care_letters WHERE created_at >= a AND created_at < b AND status NOT IN ('cancelled','failed'))
  );
END $$;

-- ---------------------------------------------------------------------------
-- Admin: actions (every one logged; finance actions need a finance role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_admin_review(p_sub uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record;
BEGIN
  IF p_decision NOT IN ('approve','decline') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF length(coalesce(btrim(p_note), '')) < 10 THEN RAISE EXCEPTION 'note_required_min_10_chars'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub FOR UPDATE;
  IF NOT FOUND OR s.status <> 'pending_review' THEN RAISE EXCEPTION 'not_awaiting_review'; END IF;
  IF p_decision = 'approve' THEN
    IF s.review_hold_until IS NOT NULL AND s.review_hold_until > now() THEN RAISE EXCEPTION 'pause_not_over_until_%', s.review_hold_until; END IF;
    UPDATE public.care_subscriptions SET status = 'pending_mandate', reviewed_at = now(), reviewed_by = uid, review_note = p_note,
      welcome_call_due_on = public.care_add_working_days(current_date, 5) WHERE id = s.id;
    UPDATE public.care_mandates SET status = 'awaiting_lodgement' WHERE subscription_id = s.id AND status = 'on_hold';
    PERFORM public.care_task(s.customer_id, 'Lodge OCCTA Care mandate — ' || s.reference,
      'Review approved. Lodge ' || s.reference || ' in AccessPay by ' ||
      to_char((SELECT lodge_due_by FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1), 'DD Mon YYYY') || '.',
      'high', (SELECT lodge_due_by FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1));
  ELSE
    UPDATE public.care_subscriptions SET status = 'declined', status_reason = 'declined_after_review', reviewed_at = now(), reviewed_by = uid,
      review_note = p_note, cancelled_at = now(), cancelled_by = uid WHERE id = s.id;
    UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = now(), cancel_source = 'occta', bank_details_ciphertext = NULL,
      enc_nonce = NULL, ciphertext_purged_at = now() WHERE subscription_id = s.id AND status IN ('on_hold','awaiting_lodgement');
    UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'declined' WHERE subscription_id = s.id AND status IN ('scheduled','ready');
    PERFORM public.care_queue(s.id, 'application_declined', jsonb_build_object('note_for_customer', NULL), 'declined:' || s.id);
  END IF;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'review_' || p_decision, jsonb_build_object('note', p_note));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_mandate_action(p_mandate uuid, p_action text, p_provider_ref text DEFAULT NULL,
  p_reason text DEFAULT NULL, p_effective date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); m record; s record; r jsonb;
BEGIN
  SELECT * INTO m FROM public.care_mandates WHERE id = p_mandate FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = m.subscription_id FOR UPDATE;
  IF p_action = 'lodged' THEN
    IF m.status <> 'awaiting_lodgement' THEN RAISE EXCEPTION 'mandate_not_awaiting_lodgement'; END IF;
    IF s.status <> 'pending_mandate' THEN RAISE EXCEPTION 'subscription_not_ready_for_lodging'; END IF;
    UPDATE public.care_mandates SET status = 'lodged', lodged_at = coalesce(p_effective::timestamptz, now()), lodged_by = uid,
      provider_reference = nullif(btrim(p_provider_ref), '') WHERE id = m.id;
  ELSIF p_action = 'active' THEN
    IF m.status NOT IN ('lodged','awaiting_lodgement') THEN RAISE EXCEPTION 'mandate_not_lodged'; END IF;
    UPDATE public.care_mandates SET status = 'active', activated_at = now(), activated_by = uid,
      lodged_at = coalesce(lodged_at, now()), lodged_by = coalesce(lodged_by, uid),
      provider_reference = coalesce(nullif(btrim(p_provider_ref), ''), provider_reference) WHERE id = m.id;
    UPDATE public.care_subscriptions SET status = 'active' WHERE id = s.id AND status = 'pending_mandate';
    UPDATE public.care_collections SET mandate_id = m.id WHERE subscription_id = s.id AND status = 'scheduled';
  ELSIF p_action = 'rejected' THEN
    IF length(coalesce(btrim(p_reason), '')) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
    UPDATE public.care_mandates SET status = 'rejected', rejected_at = now(), rejection_reason = p_reason, cancel_source = 'rejected' WHERE id = m.id;
    UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'mandate_rejected' WHERE subscription_id = s.id AND status IN ('scheduled','ready');
    UPDATE public.care_subscriptions SET status = 'cancelled', status_reason = 'mandate_rejected', cancelled_at = now(), cancelled_by = uid,
      cancel_channel = 'bank', cancel_effective_date = current_date WHERE id = s.id;
    PERFORM public.care_queue(s.id, 'mandate_cancelled', jsonb_build_object('kind', 'rejected', 'reason', p_reason, 'nothing_collected',
      NOT EXISTS (SELECT 1 FROM public.care_collections WHERE subscription_id = s.id AND status = 'paid')), 'rejected:' || m.id);
  ELSIF p_action = 'cancelled' THEN
    IF m.status NOT IN ('cancel_requested','active','lodged') THEN RAISE EXCEPTION 'mandate_not_cancellable'; END IF;
    UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = now(),
      cancel_source = coalesce(cancel_source, 'occta'), cancel_reason_code = coalesce(p_reason, cancel_reason_code) WHERE id = m.id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'mandate_' || p_action,
    jsonb_build_object('mandate_id', m.id, 'provider_reference', p_provider_ref, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ADDACS: the customer (or their bank) cancelled the Instruction.
CREATE OR REPLACE FUNCTION public.care_admin_record_bank_cancellation(p_mandate uuid, p_reason_code text, p_received date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); m record; s record; r jsonb;
BEGIN
  SELECT * INTO m FROM public.care_mandates WHERE id = p_mandate FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = m.subscription_id;
  UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = coalesce(p_received::timestamptz, now()), cancel_source = 'bank_addacs',
    cancel_reason_code = p_reason_code WHERE id = m.id;
  -- Stop everything not yet submitted immediately: never collect on a cancelled Instruction.
  UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'mandate_cancelled_by_bank'
   WHERE subscription_id = s.id AND status IN ('scheduled','ready','in_run');
  PERFORM public.care_log(s.id, s.customer_id, 'bank', NULL, 'mandate_cancelled_addacs',
    jsonb_build_object('reason_code', p_reason_code, 'received', p_received, 'recorded_by', uid));
  r := public.care_cancel_internal(s.id, 'bank', 'Direct Debit cancelled at the bank (ADDACS ' || coalesce(p_reason_code, '?') || ')', 'staff', uid);
  -- care_cancel_internal queues a cancellation confirmation; the mandate letter explains why.
  PERFORM public.care_queue(s.id, 'mandate_cancelled', jsonb_build_object('kind', 'bank_cancelled', 'reason_code', p_reason_code,
    'effective_date', r->>'effective_date'), 'addacs:' || m.id);
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_create_run(p_collection_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); rid uuid; rnum text; n int; tot int; mn date; mx date; bad int;
BEGIN
  IF coalesce(cardinality(p_collection_ids), 0) = 0 THEN RAISE EXCEPTION 'no_collections'; END IF;
  SELECT count(*) INTO bad FROM public.care_collections c LEFT JOIN public.care_mandates m ON m.id = c.mandate_id
   WHERE c.id = ANY(p_collection_ids) AND (c.status <> 'ready' OR m.status IS DISTINCT FROM 'active');
  IF bad > 0 THEN RAISE EXCEPTION 'only_ready_collections_with_active_mandates (% not ready)', bad; END IF;
  rnum := 'CARE-RUN-' || to_char(now() AT TIME ZONE 'Europe/London', 'YYYYMMDD-HH24MISS');
  SELECT count(*), sum(amount_minor), min(due_date), max(due_date) INTO n, tot, mn, mx FROM public.care_collections WHERE id = ANY(p_collection_ids);
  INSERT INTO public.care_collection_runs(run_number, provider_code, created_by, item_count, total_minor, earliest_due, latest_due)
  VALUES (rnum, (SELECT provider_code FROM public.care_settings WHERE singleton), uid, n, tot, mn, mx) RETURNING id INTO rid;
  UPDATE public.care_collections SET status = 'in_run', run_id = rid WHERE id = ANY(p_collection_ids);
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'collection_run_created', jsonb_build_object('run_id', rid, 'run_number', rnum, 'count', n, 'total_minor', tot));
  RETURN jsonb_build_object('ok', true, 'run_id', rid, 'run_number', rnum, 'rows', (
    SELECT jsonb_agg(jsonb_build_object('reference', s.reference, 'account_holder', m.account_holder_name, 'amount', to_char(c.amount_minor / 100.0, 'FM999990.00'),
      'due_date', to_char(c.due_date, 'DD/MM/YYYY'), 'provider_reference', m.provider_reference, 'customer_account', p.account_number,
      'kind', c.kind, 'period', to_char(c.period_start, 'DD/MM/YYYY') || '-' || to_char(c.period_end, 'DD/MM/YYYY')) ORDER BY c.due_date, s.reference)
    FROM public.care_collections c JOIN public.care_subscriptions s ON s.id = c.subscription_id
    JOIN public.care_mandates m ON m.id = c.mandate_id LEFT JOIN public.profiles p ON p.id = s.customer_id WHERE c.run_id = rid));
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_run_action(p_run uuid, p_action text, p_csv_sha text DEFAULT NULL, p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); r record;
BEGIN
  SELECT * INTO r FROM public.care_collection_runs WHERE id = p_run FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.submitted_confirmed_at IS NOT NULL OR r.voided_at IS NOT NULL THEN RAISE EXCEPTION 'run_already_closed'; END IF;
  IF p_action = 'submitted' THEN
    UPDATE public.care_collection_runs SET submitted_confirmed_at = now(), submitted_confirmed_by = uid, csv_sha256 = coalesce(p_csv_sha, csv_sha256) WHERE id = r.id;
    UPDATE public.care_collections SET status = 'submitted', submitted_at = now(), submitted_by = uid WHERE run_id = r.id AND status = 'in_run';
  ELSIF p_action = 'void' THEN
    IF length(coalesce(btrim(p_reason), '')) < 5 THEN RAISE EXCEPTION 'reason_required'; END IF;
    UPDATE public.care_collection_runs SET voided_at = now(), voided_by = uid, void_reason = p_reason WHERE id = r.id;
    UPDATE public.care_collections SET status = 'ready', run_id = NULL WHERE run_id = r.id AND status = 'in_run';
  ELSIF p_action = 'csv' THEN
    UPDATE public.care_collection_runs SET csv_sha256 = p_csv_sha WHERE id = r.id;
  ELSE RAISE EXCEPTION 'invalid_action'; END IF;
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'collection_run_' || p_action, jsonb_build_object('run_id', r.id, 'run_number', r.run_number, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true);
END $$;

-- Results: 'paid' needs the bank-received date (money confirmed); 'unpaid' needs an ARUDD reason code.
CREATE OR REPLACE FUNCTION public.care_admin_record_result(p_collection uuid, p_outcome text, p_bank_received date DEFAULT NULL,
  p_reason_code text DEFAULT NULL, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); c record; s record; fails int; retry_due date; stop_codes text[] := ARRAY['1','2','3','5','6','B'];
  rep_id uuid; final_stop boolean;
BEGIN
  SELECT * INTO c FROM public.care_collections WHERE id = p_collection FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF c.status <> 'submitted' THEN RAISE EXCEPTION 'collection_not_submitted (status %)', c.status; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = c.subscription_id FOR UPDATE;
  IF p_outcome = 'paid' THEN
    IF p_bank_received IS NULL THEN RAISE EXCEPTION 'bank_received_date_required'; END IF;
    IF p_bank_received > current_date THEN RAISE EXCEPTION 'bank_received_date_in_future'; END IF;
    UPDATE public.care_collections SET status = 'paid', paid_confirmed_at = now(), paid_confirmed_by = uid, bank_received_date = p_bank_received WHERE id = c.id;
    UPDATE public.care_subscriptions SET failed_collections = 0 WHERE id = s.id AND c.kind <> 'represent';
    -- A refund waiting for this money can now be paid.
    UPDATE public.care_refunds SET status = 'to_pay', due_by = greatest(coalesce(due_by, current_date), current_date + 14) WHERE collection_id = c.id AND status = 'awaiting_collection';
    PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'collection_paid', jsonb_build_object('collection_id', c.id, 'bank_received', p_bank_received, 'amount_minor', c.amount_minor));
    RETURN jsonb_build_object('ok', true);
  ELSIF p_outcome = 'unpaid' THEN
    IF p_reason_code IS NULL THEN RAISE EXCEPTION 'reason_code_required'; END IF;
    UPDATE public.care_collections SET status = 'unpaid', unpaid_recorded_at = now(), unpaid_recorded_by = uid,
      unpaid_reason_code = p_reason_code, unpaid_reason_text = left(p_note, 300) WHERE id = c.id;
    UPDATE public.care_refunds SET status = 'cancelled', cancelled_reason = 'collection_unpaid' WHERE collection_id = c.id AND status = 'awaiting_collection';
    fails := s.failed_collections + 1;
    UPDATE public.care_subscriptions SET failed_collections = fails WHERE id = s.id;
    PERFORM public.care_log(s.id, s.customer_id, 'bank', NULL, 'collection_unpaid', jsonb_build_object('collection_id', c.id, 'reason_code', p_reason_code, 'recorded_by', uid, 'failed_count', fails));
    final_stop := p_reason_code = ANY(stop_codes) OR fails >= 2 OR s.status NOT IN ('active','pending_mandate');
    IF NOT final_stop THEN
      retry_due := public.care_next_working_day(public.care_add_working_days(current_date, 13));
      INSERT INTO public.care_collections(subscription_id, mandate_id, kind, due_date, amount_minor, period_start, period_end, notice_sent_at, notice_kind, represent_of)
      VALUES (s.id, c.mandate_id, 'represent', retry_due, c.amount_minor, c.period_start, c.period_end, now(), 'payment_failed', c.id)
      RETURNING id INTO rep_id;
      PERFORM public.care_queue(s.id, 'payment_failed', jsonb_build_object('amount_minor', c.amount_minor, 'due_date', c.due_date,
        'reason_code', p_reason_code, 'retry_date', retry_due, 'final', false), 'unpaid:' || c.id);
    ELSE
      -- Pause Care. The missed period is written off: Care debts are never chased.
      UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'paused_after_missed_payments'
       WHERE subscription_id = s.id AND status IN ('scheduled','ready');
      IF s.status IN ('active','pending_mandate') THEN
        UPDATE public.care_subscriptions SET status = 'paused', status_reason = CASE WHEN p_reason_code = ANY(stop_codes) THEN 'bank_instruction_ended' ELSE 'missed_payments' END WHERE id = s.id;
      END IF;
      IF p_reason_code = ANY(stop_codes) THEN
        UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = now(), cancel_source = 'bank_addacs', cancel_reason_code = 'ARUDD ' || p_reason_code
         WHERE subscription_id = s.id AND status IN ('active','lodged');
      ELSE
        UPDATE public.care_mandates SET status = 'cancel_requested', cancel_requested_at = now(), cancel_source = 'occta'
         WHERE subscription_id = s.id AND status IN ('active','lodged');
        PERFORM public.care_task(s.customer_id, 'Cancel paused OCCTA Care mandate — ' || s.reference,
          'Care is paused after missed payments. Cancel ' || s.reference || ' in AccessPay so nothing else is collected.', 'high', public.care_add_working_days(current_date, 1));
      END IF;
      PERFORM public.care_queue(s.id, 'service_paused', jsonb_build_object('amount_minor', c.amount_minor, 'reason_code', p_reason_code,
        'reason', CASE WHEN p_reason_code = ANY(stop_codes) THEN 'instruction_ended' ELSE 'missed_payments' END), 'paused:' || c.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'paused', final_stop, 'retry_date', retry_due);
  ELSE
    RAISE EXCEPTION 'invalid_outcome';
  END IF;
END $$;

-- DDICA: the customer's bank refunded them under the Guarantee.
CREATE OR REPLACE FUNCTION public.care_admin_record_indemnity(p_collection uuid, p_reason_code text, p_amount_minor integer, p_received date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); c record; s record; did uuid;
BEGIN
  SELECT * INTO c FROM public.care_collections WHERE id = p_collection FOR UPDATE;
  IF NOT FOUND OR c.status <> 'paid' THEN RAISE EXCEPTION 'indemnity_needs_a_paid_collection'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = c.subscription_id;
  UPDATE public.care_collections SET status = 'indemnity_claimed' WHERE id = c.id;
  INSERT INTO public.care_disputes(subscription_id, collection_id, kind, bacs_reason_code, amount_minor, received_on, respond_by, created_by)
  VALUES (s.id, c.id, 'indemnity_claim', p_reason_code, coalesce(p_amount_minor, c.amount_minor), p_received, p_received + 9, uid)
  RETURNING id INTO did;
  -- Refund already made by the bank: cancel any refund we were going to pay for the same money.
  UPDATE public.care_refunds SET status = 'cancelled', cancelled_reason = 'bank_refunded_under_guarantee' WHERE collection_id = c.id AND status IN ('to_pay','awaiting_collection');
  PERFORM public.care_log(s.id, s.customer_id, 'bank', NULL, 'indemnity_claim_received',
    jsonb_build_object('dispute_id', did, 'collection_id', c.id, 'reason_code', p_reason_code, 'received', p_received, 'recorded_by', uid));
  PERFORM public.care_task(s.customer_id, 'Care indemnity claim — decide by ' || to_char(p_received + 9, 'DD Mon') || ' — ' || s.reference,
    'Open Admin → OCCTA Care → Disputes. Generate the evidence pack, check every rule was followed, then challenge (with evidence) or accept.',
    'urgent', p_received + 8);
  RETURN jsonb_build_object('ok', true, 'dispute_id', did, 'respond_by', p_received + 9);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_dispute_decide(p_dispute uuid, p_decision text, p_note text, p_cancel_care boolean DEFAULT true,
  p_write_once boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); d record; s record;
BEGIN
  IF p_decision NOT IN ('challenged','accepted','closed') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF length(coalesce(btrim(p_note), '')) < 10 THEN RAISE EXCEPTION 'note_required_min_10_chars'; END IF;
  SELECT * INTO d FROM public.care_disputes WHERE id = p_dispute FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF d.status = 'closed' THEN RAISE EXCEPTION 'already_closed'; END IF;
  IF p_decision = 'challenged' AND d.kind = 'indemnity_claim' AND d.evidence_pack_id IS NULL THEN RAISE EXCEPTION 'generate_evidence_pack_first'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = d.subscription_id;
  UPDATE public.care_disputes SET status = p_decision, decision_note = p_note, decided_by = uid, decided_at = now(),
    closed_at = CASE WHEN p_decision IN ('accepted','closed') THEN now() ELSE NULL END WHERE id = d.id;
  IF p_cancel_care AND s.status IN ('pending_review','pending_mandate','active','paused') THEN
    PERFORM public.care_cancel_internal(s.id, 'occta', 'Ended after indemnity claim: ' || left(p_note, 200), 'staff', uid);
  END IF;
  IF p_decision = 'accepted' AND p_write_once AND d.kind = 'indemnity_claim' THEN
    PERFORM public.care_queue(s.id, 'indemnity_followup', jsonb_build_object('amount_minor', d.amount_minor, 'period_note', p_note), 'indemnity:' || d.id);
  END IF;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'dispute_' || p_decision, jsonb_build_object('dispute_id', d.id, 'note', p_note));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_record_ddi_request(p_sub uuid, p_received date, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); s record; did uuid;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.care_disputes(subscription_id, kind, received_on, respond_by, created_by, decision_note)
  VALUES (s.id, 'ddi_copy_request', p_received, public.care_add_working_days(p_received, 7), uid, p_note) RETURNING id INTO did;
  PERFORM public.care_log(s.id, s.customer_id, 'bank', NULL, 'ddi_copy_requested', jsonb_build_object('dispute_id', did, 'received', p_received, 'recorded_by', uid));
  PERFORM public.care_task(s.customer_id, 'Send Care DDI copy to bank by ' || to_char(public.care_add_working_days(p_received, 7), 'DD Mon') || ' — ' || s.reference,
    'Generate the evidence pack (purpose: DDI copy) and send it to the paying bank via AccessPay.', 'urgent', public.care_add_working_days(p_received, 6));
  RETURN jsonb_build_object('ok', true, 'dispute_id', did);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_cancel(p_sub uuid, p_channel text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false);
BEGIN
  IF p_channel NOT IN ('phone','email','letter','chat','occta') THEN RAISE EXCEPTION 'invalid_channel'; END IF;
  IF length(coalesce(btrim(p_reason), '')) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  RETURN public.care_cancel_internal(p_sub, p_channel, p_reason, 'staff', uid);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_record_usage(p_sub uuid, p_kind text, p_notes text, p_occurred timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record; uid2 uuid;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.care_usage(subscription_id, kind, notes, occurred_at, recorded_by) VALUES (s.id, p_kind, left(p_notes, 1000), coalesce(p_occurred, now()), uid)
  RETURNING id INTO uid2;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'usage_recorded', jsonb_build_object('kind', p_kind, 'usage_id', uid2));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_welcome_call(p_sub uuid, p_outcome text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record;
BEGIN
  IF p_outcome NOT IN ('confirmed','wants_to_cancel','no_answer') THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_outcome = 'confirmed' THEN UPDATE public.care_subscriptions SET welcome_call_done_at = now() WHERE id = s.id; END IF;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'welcome_call_' || p_outcome, jsonb_build_object('note', p_note));
  IF p_outcome = 'wants_to_cancel' THEN RETURN public.care_cancel_internal(s.id, 'phone', coalesce(p_note, 'Cancelled on welcome call'), 'staff', uid); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_refund_action(p_refund uuid, p_action text, p_paid_on date DEFAULT NULL, p_reference text DEFAULT NULL,
  p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); f record; s record;
BEGIN
  SELECT * INTO f FROM public.care_refunds WHERE id = p_refund FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = f.subscription_id;
  IF p_action = 'paid' THEN
    IF f.status <> 'to_pay' THEN RAISE EXCEPTION 'refund_not_payable_yet (status %)', f.status; END IF;
    IF p_paid_on IS NULL OR length(coalesce(btrim(p_reference), '')) < 3 THEN RAISE EXCEPTION 'paid_date_and_bank_reference_required'; END IF;
    UPDATE public.care_refunds SET status = 'paid', paid_at = p_paid_on, paid_by = uid, paid_reference = p_reference WHERE id = f.id;
    PERFORM public.care_queue(s.id, 'refund_confirmation', jsonb_build_object('amount_minor', f.amount_minor, 'paid_on', p_paid_on, 'reason', f.reason), 'refund:' || f.id);
  ELSIF p_action = 'cancel' THEN
    IF length(coalesce(btrim(p_reason), '')) < 5 THEN RAISE EXCEPTION 'reason_required'; END IF;
    UPDATE public.care_refunds SET status = 'cancelled', cancelled_reason = p_reason WHERE id = f.id AND status IN ('to_pay','awaiting_collection');
  ELSE RAISE EXCEPTION 'invalid_action'; END IF;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'refund_' || p_action, jsonb_build_object('refund_id', f.id, 'amount_minor', f.amount_minor, 'reference', p_reference, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_goodwill_refund(p_sub uuid, p_collection uuid, p_amount_minor integer, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record; c record; cstatus text; fid uuid;
BEGIN
  IF length(coalesce(btrim(p_reason), '')) < 10 THEN RAISE EXCEPTION 'reason_required_min_10_chars'; END IF;
  IF coalesce(p_amount_minor, 0) <= 0 THEN RAISE EXCEPTION 'amount_required'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_collection IS NOT NULL THEN
    SELECT * INTO c FROM public.care_collections WHERE id = p_collection AND subscription_id = s.id;
    IF NOT FOUND OR c.status NOT IN ('paid','submitted') THEN RAISE EXCEPTION 'collection_not_refundable'; END IF;
    IF p_amount_minor > c.amount_minor THEN RAISE EXCEPTION 'refund_exceeds_payment'; END IF;
    cstatus := c.status;
  END IF;
  INSERT INTO public.care_refunds(subscription_id, collection_id, amount_minor, reason, status, due_by, created_by)
  VALUES (s.id, p_collection, p_amount_minor, p_reason, CASE WHEN cstatus = 'submitted' THEN 'awaiting_collection' ELSE 'to_pay' END, current_date + 14, uid)
  RETURNING id INTO fid;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'refund_created', jsonb_build_object('refund_id', fid, 'amount_minor', p_amount_minor, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true, 'refund_id', fid);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_raise_complaint(p_sub uuid, p_summary text, p_desired text, p_channel text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record; pr record; cid uuid; ref text;
BEGIN
  IF length(coalesce(btrim(p_summary), '')) < 10 THEN RAISE EXCEPTION 'summary_required'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT email, phone INTO pr FROM public.profiles WHERE id = s.customer_id;
  ref := 'CMP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  INSERT INTO public.complaints(customer_id, complaint_reference, category, summary, customer_desired_outcome, contact_email, contact_phone,
    six_week_adr_eligible_at)
  VALUES (s.customer_id, ref, 'occta_care', left('[' || s.reference || ' via ' || coalesce(p_channel, 'staff') || '] ' || p_summary, 4000),
    left(p_desired, 2000), pr.email, pr.phone, now() + interval '6 weeks')
  RETURNING id INTO cid;
  INSERT INTO public.care_disputes(subscription_id, kind, received_on, respond_by, complaint_id, created_by)
  VALUES (s.id, 'complaint', current_date, public.care_add_working_days(current_date, 5), cid, uid);
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'complaint_raised', jsonb_build_object('complaint_id', cid, 'reference', ref, 'channel', p_channel));
  RETURN jsonb_build_object('ok', true, 'complaint_id', cid, 'reference', ref);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_update_support_needs(p_customer uuid, p_needs text[], p_sales_block boolean, p_note text,
  p_consent_source text, p_carer_name text DEFAULT NULL, p_carer_contact text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false);
BEGIN
  IF p_consent_source NOT IN ('customer_phone','customer_letter','customer_web') THEN RAISE EXCEPTION 'consent_source_required'; END IF;
  INSERT INTO public.care_support_needs(customer_id, needs, carer_name, carer_contact, consent_at, consent_source, staff_sales_block, staff_note, updated_by)
  VALUES (p_customer, coalesce(p_needs, '{}'), nullif(left(p_carer_name, 120), ''), nullif(left(p_carer_contact, 300), ''), now(), p_consent_source,
          coalesce(p_sales_block, false), left(p_note, 1000), uid)
  ON CONFLICT (customer_id) DO UPDATE SET needs = EXCLUDED.needs, carer_name = EXCLUDED.carer_name, carer_contact = EXCLUDED.carer_contact,
    consent_at = EXCLUDED.consent_at, consent_source = EXCLUDED.consent_source, staff_sales_block = EXCLUDED.staff_sales_block,
    staff_note = EXCLUDED.staff_note, updated_at = now(), updated_by = uid;
  PERFORM public.care_log(NULL, p_customer, 'staff', uid, 'support_needs_updated', jsonb_build_object('needs', p_needs, 'sales_block', p_sales_block, 'source', p_consent_source));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_letters_posted(p_letter_ids uuid[], p_posted_on date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); n int;
BEGIN
  IF p_posted_on IS NULL OR p_posted_on > current_date THEN RAISE EXCEPTION 'posted_date_required'; END IF;
  UPDATE public.care_letters SET status = 'posted', posted_on = p_posted_on, posted_by = uid
   WHERE id = ANY(p_letter_ids) AND status IN ('awaiting_print','in_batch','needs_manual');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.care_print_batches SET posted_on = p_posted_on, posted_by = uid
   WHERE id IN (SELECT DISTINCT batch_id FROM public.care_letters WHERE id = ANY(p_letter_ids) AND batch_id IS NOT NULL);
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'letters_posted', jsonb_build_object('count', n, 'posted_on', p_posted_on));
  RETURN jsonb_build_object('ok', true, 'posted', n);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_settings(p_sales_open boolean, p_support_hours text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true);
BEGIN
  UPDATE public.care_settings SET sales_open = p_sales_open, support_hours = coalesce(nullif(btrim(p_support_hours), ''), support_hours),
    updated_at = now(), updated_by = uid WHERE singleton;
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'settings_changed', jsonb_build_object('sales_open', p_sales_open, 'support_hours', p_support_hours));
  RETURN jsonb_build_object('ok', true);
END $$;

-- New-join prices. Existing members are untouched; use care_admin_schedule_price_change for them.
CREATE OR REPLACE FUNCTION public.care_admin_set_plan_price(p_plan text, p_monthly_minor integer, p_active boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); old int;
BEGIN
  SELECT monthly_minor INTO old FROM public.care_plans WHERE code = p_plan;
  UPDATE public.care_plans SET monthly_minor = p_monthly_minor, active = p_active, updated_at = now(), updated_by = uid WHERE code = p_plan;
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'plan_price_set_for_new_joins', jsonb_build_object('plan', p_plan, 'from', old, 'to', p_monthly_minor, 'active', p_active));
  RETURN jsonb_build_object('ok', true, 'note', 'Applies to new sign-ups only. The published terms quote the launch prices: publish a new terms version before advertising a different price.');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_schedule_price_change(p_plan text, p_frequency text, p_new_minor integer, p_effective date, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); s record; n int := 0; pcid uuid; old int;
BEGIN
  IF p_effective < current_date + 30 THEN RAISE EXCEPTION 'effective_date_must_be_at_least_30_days_away'; END IF;
  IF length(coalesce(btrim(p_reason), '')) < 10 THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT price_minor INTO old FROM public.care_subscriptions WHERE plan_code = p_plan AND frequency = p_frequency AND status IN ('pending_mandate','active') LIMIT 1;
  INSERT INTO public.care_price_changes(plan_code, frequency, old_price_minor, new_price_minor, effective_from, reason, created_by)
  VALUES (p_plan, p_frequency, coalesce(old, 0), p_new_minor, p_effective, p_reason, uid) RETURNING id INTO pcid;
  FOR s IN SELECT * FROM public.care_subscriptions WHERE plan_code = p_plan AND frequency = p_frequency AND status IN ('pending_mandate','active') FOR UPDATE LOOP
    UPDATE public.care_subscriptions SET price_minor = p_new_minor WHERE id = s.id;
    UPDATE public.care_collections SET amount_minor = p_new_minor, notice_sent_at = now(), notice_kind = 'price_change'
     WHERE subscription_id = s.id AND status = 'scheduled' AND period_start >= p_effective;
    PERFORM public.care_queue(s.id, 'change_notice', jsonb_build_object('kind', 'price_change', 'old_price_minor', s.price_minor,
      'new_price_minor', p_new_minor, 'frequency', s.frequency, 'effective_date', p_effective, 'reason', p_reason), 'price:' || pcid || ':' || s.id);
    PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'price_change_notified', jsonb_build_object('price_change_id', pcid, 'from', s.price_minor, 'to', p_new_minor, 'effective', p_effective));
    n := n + 1;
  END LOOP;
  UPDATE public.care_price_changes SET affected = n WHERE id = pcid;
  RETURN jsonb_build_object('ok', true, 'affected', n);
END $$;

-- Used by the care-admin edge function after an evidence pack PDF is stored.
CREATE OR REPLACE FUNCTION public.care_record_evidence_pack(p_sub uuid, p_purpose text, p_path text, p_sha text, p_actor uuid, p_dispute uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eid uuid; s record;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  INSERT INTO public.care_evidence_packs(subscription_id, purpose, pdf_path, pdf_sha256, requested_by) VALUES (p_sub, p_purpose, p_path, p_sha, p_actor) RETURNING id INTO eid;
  IF p_dispute IS NOT NULL THEN UPDATE public.care_disputes SET evidence_pack_id = eid WHERE id = p_dispute AND subscription_id = p_sub; END IF;
  PERFORM public.care_log(p_sub, s.customer_id, 'staff', p_actor, 'evidence_pack_created', jsonb_build_object('evidence_pack_id', eid, 'purpose', p_purpose, 'sha256', p_sha));
  RETURN eid;
END $$;

-- ---------------------------------------------------------------------------
-- Existing systems: allow Care categories and Care OTP challenges
-- ---------------------------------------------------------------------------
ALTER TABLE public.sms_otp_challenges DROP CONSTRAINT IF EXISTS sms_otp_challenges_journey_type_check;
ALTER TABLE public.sms_otp_challenges ADD CONSTRAINT sms_otp_challenges_journey_type_check
  CHECK (journey_type IN ('journey_1','journey_2','care'));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for letters, evidence packs and print batches
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets(id, name, public) VALUES ('care-documents', 'care-documents', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "care_documents_customer_letters" ON storage.objects;
CREATE POLICY "care_documents_customer_letters" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'care-documents' AND (storage.foldername(name))[1] = 'letters' AND (storage.foldername(name))[2] = auth.uid()::text);
DROP POLICY IF EXISTS "care_documents_staff_read" ON storage.objects;
CREATE POLICY "care_documents_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'care-documents' AND public.care_is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Locks: tables only through the functions above
-- ---------------------------------------------------------------------------
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['care_bank_holidays','care_terms_versions','care_settings','care_plans','care_support_needs','care_invites',
    'care_applications','care_verifications','care_subscriptions','care_consents','care_mandates','care_collection_runs','care_collections',
    'care_refunds','care_disputes','care_usage','care_requests','care_print_batches','care_letters','care_outbox','care_evidence_packs',
    'care_price_changes','care_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.care_reference_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.care_events_id_seq TO service_role;

DO $$ DECLARE f text; BEGIN
  -- Internal: service role only.
  FOREACH f IN ARRAY ARRAY[
    'care_log(uuid,uuid,text,uuid,text,jsonb)','care_task(uuid,text,text,text,date)','care_queue(uuid,text,jsonb,text,text)',
    'care_eligibility(uuid)','care_start_application(uuid,text,text,integer,text,text,text)','care_record_key_facts(uuid,uuid,jsonb,text)',
    'care_submit_application(uuid,uuid,jsonb)','care_cancel_internal(uuid,text,text,text,uuid)','care_claim_outbox(integer)',
    'care_finish_outbox(uuid,uuid,boolean,text,text)','care_dispatch_messages()','care_nightly()',
    'care_record_evidence_pack(uuid,text,text,text,uuid,uuid)','care_require(boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
  -- Public catalogue.
  REVOKE ALL ON FUNCTION public.care_public_catalogue() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.care_public_catalogue() TO anon, authenticated, service_role;
  -- Signed-in customers and staff (each checks auth.uid() / staff role itself).
  FOREACH f IN ARRAY ARRAY[
    'care_my_overview()','care_my_cancel(text)','care_my_request(text,text)','care_my_update_support_needs(text[],boolean,text,text,text)',
    'care_my_change_plan(text,boolean,jsonb,text)',
    'care_admin_overview()','care_admin_list(text,text)','care_admin_member(uuid)','care_admin_mandate_queue()','care_admin_collections(text)',
    'care_admin_disputes()','care_admin_letters(text)','care_admin_refunds()','care_admin_report(date)','care_admin_review(uuid,text,text)',
    'care_admin_mandate_action(uuid,text,text,text,date)','care_admin_record_bank_cancellation(uuid,text,date)','care_admin_create_run(uuid[])',
    'care_admin_run_action(uuid,text,text,text)','care_admin_record_result(uuid,text,date,text,text)',
    'care_admin_record_indemnity(uuid,text,integer,date)','care_admin_dispute_decide(uuid,text,text,boolean,boolean)',
    'care_admin_record_ddi_request(uuid,date,text)','care_admin_cancel(uuid,text,text)','care_admin_record_usage(uuid,text,text,timestamptz)',
    'care_admin_welcome_call(uuid,text,text)','care_admin_refund_action(uuid,text,date,text,text)',
    'care_admin_goodwill_refund(uuid,uuid,integer,text)','care_admin_raise_complaint(uuid,text,text,text)',
    'care_admin_update_support_needs(uuid,text[],boolean,text,text,text,text)','care_admin_letters_posted(uuid[],date)',
    'care_admin_settings(boolean,text)','care_admin_set_plan_price(text,integer,boolean)',
    'care_admin_schedule_price_change(text,text,integer,date,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('care-nightly','care-messages');
EXCEPTION WHEN others THEN NULL; END $$;
SELECT cron.schedule('care-nightly', '10 3 * * *', 'SELECT public.care_nightly()');
SELECT cron.schedule('care-messages', '*/5 * * * *', 'SELECT public.care_dispatch_messages()');

COMMIT;
