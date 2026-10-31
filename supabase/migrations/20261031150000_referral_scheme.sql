-- OCCTA Refer-a-Friend scheme (bill credit only, never cash).
--
-- Lessons from SWITCH50 (OCC54401573, Oct 2026) that this design enforces:
--   * Eligibility uses payment HISTORY between the friend's order and the
--     qualifying date. Paying arrears late never restores eligibility.
--   * The engine can only move a reward up to 'approved_awaiting_admin'.
--     Nothing tells a customer a reward is coming until an admin has approved
--     it and the credit is booked. No trigger writes to the outbox.
--   * manual_hold suppresses every message and freezes the engine.
--   * Any status change after approval needs an admin and a written reason
--     (ledger bookkeeping and the published 12-month expiry excepted).
--   * Every attribution carries evidence; weak evidence goes to review.
--   * Every referral snapshots the terms version and its rules, so changing
--     the scheme never changes a referral already made.
--
-- Nothing here runs for customers while platform_settings.rewards_enabled is
-- false: codes cannot be issued, orders are not bound and cron jobs no-op.
-- No email is sent by this migration.
BEGIN;

-- ---------------------------------------------------------------------------
-- Terms versions (rules live here, never in mutable settings)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_terms_versions (
  version text PRIMARY KEY CHECK (version ~ '^raf-[0-9]{4}-[0-9]{2}-v[0-9]+$'),
  effective_from timestamptz NOT NULL,
  summary text NOT NULL CHECK (length(summary) BETWEEN 40 AND 2000),
  terms_url text NOT NULL DEFAULT 'https://www.occta.co.uk/legal/refer-a-friend-terms',
  rules jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.referral_terms_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'referral_terms_are_immutable_publish_a_new_version'; END $$;
DROP TRIGGER IF EXISTS trg_referral_terms_immutable ON public.referral_terms_versions;
CREATE TRIGGER trg_referral_terms_immutable BEFORE UPDATE OR DELETE ON public.referral_terms_versions
  FOR EACH ROW EXECUTE FUNCTION public.referral_terms_immutable();

-- Reward amounts are keyed by the FRIEND's customer type. A credit is worded in
-- the beneficiary's own billing terms: residential bills are VAT-inclusive, so
-- the amount is the gross reduction; business bills are VAT-exclusive, so the
-- amount is net and the bill's VAT falls with it.
INSERT INTO public.referral_terms_versions(version, effective_from, summary, rules) VALUES (
  'raf-2026-11-v1', '2026-10-31T00:00:00Z',
  'Refer a friend to OCCTA. When their service has been live for 60 days and they have paid their first 2 bills in full and on time, you get £25 off your bill and they get £10 off theirs. If your friend joins on a business plan, it is £50 for you and £25 for them. Business accounts get credit before VAT. Bill credit only, never cash. Both accounts must stay up to date with payments the whole time. Up to 5 rewards a year (10 for business accounts). Credit lasts 12 months and is lost if your account closes.',
  '{
    "qualify_days": 60,
    "invoices_required": 2,
    "payment_grace_days": 0,
    "caps": {"residential": 5, "business": 10},
    "rewards": {
      "residential": {"referrer": 25, "friend": 10},
      "business": {"referrer": 50, "friend": 25}
    },
    "vat_rate": 20,
    "clawback_months": 6,
    "unpaid_clawback_days": 30,
    "credit_expiry_months": 12,
    "expiry_warning_days": 30,
    "manual_attach_days": 7,
    "new_customer_lookback_months": 12,
    "click_window_days": 30,
    "allow_promotion_stacking": false,
    "charge_back_used_credit": false
  }'::jsonb
) ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Operational settings (not part of the customer promise)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  current_terms_version text NOT NULL REFERENCES public.referral_terms_versions(version),
  goodwill_monthly_budget numeric(10,2) NOT NULL DEFAULT 150 CHECK (goodwill_monthly_budget >= 0),
  click_hash_salt text NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.referral_settings(singleton, current_terms_version)
VALUES (true, 'raf-2026-11-v1') ON CONFLICT (singleton) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Codes: snapshot the terms shown with every code; no clash with partner or
-- promotion codes, which share the checkout's "reference code" box.
-- ---------------------------------------------------------------------------
ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS terms_version text REFERENCES public.referral_terms_versions(version);
ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS terms_shown_at timestamptz;
ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS customer_type text CHECK (customer_type IS NULL OR customer_type IN ('residential','business'));

CREATE OR REPLACE FUNCTION public.referral_code_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF EXISTS (SELECT 1 FROM public.offer_campaigns c WHERE upper(c.code) = NEW.code)
     OR (to_regclass('public.partners') IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.partners p WHERE upper(p.code) = NEW.code)) THEN
    RAISE EXCEPTION 'referral_code_reserved' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_referral_code_guard ON public.referral_codes;
CREATE TRIGGER trg_referral_code_guard BEFORE INSERT OR UPDATE OF code ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.referral_code_guard();

-- Partner codes must not clash with customer referral codes either.
DO $$ BEGIN
  IF to_regclass('public.partners') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.partners_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
    BEGIN
      NEW.code := upper(btrim(NEW.code));
      IF EXISTS (SELECT 1 FROM public.offer_campaigns c WHERE upper(c.code) = NEW.code) THEN
        RAISE EXCEPTION 'partner_code_reserved_by_offer' USING ERRCODE = '23505';
      END IF;
      IF EXISTS (SELECT 1 FROM public.referral_codes r WHERE upper(r.code) = NEW.code) THEN
        RAISE EXCEPTION 'partner_code_reserved_by_referral' USING ERRCODE = '23505';
      END IF;
      IF TG_OP = 'UPDATE' AND NEW.code IS DISTINCT FROM OLD.code
         AND EXISTS (SELECT 1 FROM public.partner_commission_payouts p WHERE p.partner_id = OLD.id) THEN
        RAISE EXCEPTION 'partner_code_locked_after_payout';
      END IF;
      NEW.updated_at := now();
      RETURN NEW;
    END $f$;
    DROP TRIGGER IF EXISTS trg_partners_guard ON public.partners;
    CREATE TRIGGER trg_partners_guard BEFORE INSERT OR UPDATE ON public.partners
      FOR EACH ROW EXECUTE FUNCTION public.partners_guard();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Click evidence (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),
  code text NOT NULL,
  landing_url text CHECK (landing_url IS NULL OR length(landing_url) <= 500),
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 500),
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_code_time ON public.referral_clicks(code, created_at DESC);

-- ---------------------------------------------------------------------------
-- Referrals (one per friend order) and rewards (referrer, friend, goodwill)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT ('RF-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),
  referrer_id uuid NOT NULL,
  referrer_type text NOT NULL CHECK (referrer_type IN ('residential','business')),
  friend_customer_id uuid,
  friend_order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  friend_session_id uuid,
  friend_type text NOT NULL CHECK (friend_type IN ('residential','business')),
  attribution_method text NOT NULL CHECK (attribution_method IN ('link','typed_code','admin_manual')),
  click_id uuid REFERENCES public.referral_clicks(id),
  evidence jsonb NOT NULL,
  order_created_at timestamptz NOT NULL,
  terms_version text NOT NULL REFERENCES public.referral_terms_versions(version),
  rules jsonb NOT NULL,
  manual_attach_reason text,
  manual_attached_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (attribution_method <> 'admin_manual' OR (length(btrim(coalesce(manual_attach_reason,''))) >= 10 AND manual_attached_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_friend ON public.referrals(friend_customer_id);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT ('RR-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  referral_id uuid REFERENCES public.referrals(id),
  customer_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('referrer','friend','goodwill')),
  status text NOT NULL DEFAULT 'tracked' CHECK (status IN (
    'tracked','pending','qualifying','approved_awaiting_admin',
    'booked','partly_applied','applied','expired','reversed','clawed_back','rejected')),
  status_reason text,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  amount_basis text NOT NULL CHECK (amount_basis IN ('gross','net')),
  credit_gross_minor integer NOT NULL CHECK (credit_gross_minor > 0),
  terms_version text NOT NULL REFERENCES public.referral_terms_versions(version),
  manual_hold boolean NOT NULL DEFAULT false,
  hold_reason text,
  needs_review boolean NOT NULL DEFAULT false,
  review_reasons text[] NOT NULL DEFAULT '{}',
  live_at timestamptz,
  qualifies_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  booked_at timestamptz,
  expires_at timestamptz,
  dispute_id uuid,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'goodwill') = (referral_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_reward_role ON public.referral_rewards(referral_id, role) WHERE referral_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_rewards_customer ON public.referral_rewards(customer_id, status);

CREATE TABLE IF NOT EXISTS public.referral_reward_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reward_id uuid REFERENCES public.referral_rewards(id),
  referral_id uuid REFERENCES public.referrals(id),
  actor_id uuid,
  actor_kind text NOT NULL DEFAULT 'system' CHECK (actor_kind IN ('system','admin','ledger','customer')),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  reason text,
  terms_version text,
  details jsonb NOT NULL DEFAULT '{}',
  request_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_events_reward ON public.referral_reward_events(reward_id, id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referral ON public.referral_reward_events(referral_id, id);

-- Credit ledger. Balance = booked − applied + unapplied − expired − reversed − clawed_back.
CREATE TABLE IF NOT EXISTS public.referral_credit_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reward_id uuid NOT NULL REFERENCES public.referral_rewards(id),
  customer_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('booked','applied','unapplied','expired','reversed','clawed_back')),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  invoice_id uuid REFERENCES public.invoices(id),
  invoice_line_id uuid,
  actor_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind IN ('applied','unapplied')) = (invoice_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_credit_invoice ON public.referral_credit_movements(reward_id, invoice_id, kind)
  WHERE invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_credit_once ON public.referral_credit_movements(reward_id, kind)
  WHERE kind IN ('booked','expired','reversed','clawed_back');
CREATE INDEX IF NOT EXISTS idx_referral_credit_customer ON public.referral_credit_movements(customer_id, created_at);

-- Customer messages. Only five templates exist; only admin actions and the
-- expiry job may enqueue. A hold suppresses everything.
CREATE TABLE IF NOT EXISTS public.referral_message_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  reward_id uuid REFERENCES public.referral_rewards(id),
  referral_id uuid REFERENCES public.referrals(id),
  template text NOT NULL CHECK (template IN ('your_code','friend_joined','reward_credited','credit_expiring','reward_withdrawn')),
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','suppressed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  locked_until timestamptz,
  first_attempt_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_messages_due ON public.referral_message_outbox(next_attempt_at)
  WHERE status IN ('pending','processing');

-- Account standing history: things the invoice/receipt tables can't show.
CREATE TABLE IF NOT EXISTS public.customer_standing_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('suspended','payment_arrangement','dd_returned','bank_recall',
    'overdue_notice','manual_arrears','leaving_request')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_standing_customer ON public.customer_standing_events(customer_id, occurred_at);

CREATE TABLE IF NOT EXISTS public.referral_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT ('RD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  customer_id uuid NOT NULL,
  referral_id uuid REFERENCES public.referrals(id),
  kind text NOT NULL CHECK (kind IN ('not_tracked','withdrawn','amount','other')),
  details text NOT NULL CHECK (length(btrim(details)) >= 10),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','upheld','rejected','goodwill')),
  outcome_reason text,
  opened_by uuid NOT NULL,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_recon_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('nightly','manual')),
  issues integer NOT NULL,
  findings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_binding_errors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only guards
CREATE OR REPLACE FUNCTION public.referral_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION '%_is_append_only', TG_TABLE_NAME; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['referral_clicks','referral_reward_events','referral_credit_movements','customer_standing_events','referral_recon_runs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_append_only ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_append_only BEFORE UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.referral_append_only()', t);
  END LOOP;
END $$;

-- Referrals: evidence and economics never change after creation, only the
-- friend's account link (provisioned after the order) may be filled in.
CREATE OR REPLACE FUNCTION public.referral_row_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'referrals_cannot_be_deleted'; END IF;
  IF (NEW.referral_code_id, NEW.referrer_id, NEW.friend_order_id, NEW.attribution_method, NEW.click_id,
      NEW.evidence, NEW.terms_version, NEW.rules, NEW.order_created_at, NEW.friend_type, NEW.referrer_type)
     IS DISTINCT FROM (OLD.referral_code_id, OLD.referrer_id, OLD.friend_order_id, OLD.attribution_method, OLD.click_id,
      OLD.evidence, OLD.terms_version, OLD.rules, OLD.order_created_at, OLD.friend_type, OLD.referrer_type)
     OR (OLD.friend_customer_id IS NOT NULL AND NEW.friend_customer_id IS DISTINCT FROM OLD.friend_customer_id) THEN
    RAISE EXCEPTION 'referral_evidence_is_immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_referral_row_guard ON public.referrals;
CREATE TRIGGER trg_referral_row_guard BEFORE UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.referral_row_guard();

-- Reward state guard: who may move a reward where.
-- referral.actor_kind is set (transaction-local) by the functions below.
CREATE OR REPLACE FUNCTION public.referral_reward_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_kind text := coalesce(nullif(current_setting('referral.actor_kind', true), ''), 'system');
  v_pre text[] := ARRAY['tracked','pending','qualifying','approved_awaiting_admin'];
  v_post text[] := ARRAY['booked','partly_applied','applied'];
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'referral_rewards_cannot_be_deleted'; END IF;
  IF (NEW.referral_id, NEW.customer_id, NEW.role, NEW.amount, NEW.amount_basis, NEW.credit_gross_minor, NEW.terms_version)
     IS DISTINCT FROM (OLD.referral_id, OLD.customer_id, OLD.role, OLD.amount, OLD.amount_basis, OLD.credit_gross_minor, OLD.terms_version) THEN
    RAISE EXCEPTION 'referral_reward_economics_are_immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_kind = 'system' THEN
      -- The engine works only before approval and can never book.
      IF NOT (OLD.status = ANY(v_pre) AND (NEW.status = ANY(v_pre) OR NEW.status = 'rejected')) THEN
        RAISE EXCEPTION 'referral_engine_cannot_move_%_to_%', OLD.status, NEW.status;
      END IF;
      IF OLD.manual_hold THEN RAISE EXCEPTION 'referral_reward_on_hold'; END IF;
    ELSIF v_kind = 'ledger' THEN
      IF NOT ((OLD.status = ANY(v_post) AND NEW.status = ANY(v_post))
              OR (OLD.status IN ('booked','partly_applied') AND NEW.status = 'expired')) THEN
        RAISE EXCEPTION 'referral_ledger_cannot_move_%_to_%', OLD.status, NEW.status;
      END IF;
    ELSIF v_kind = 'admin' THEN
      IF length(btrim(coalesce(NEW.status_reason, ''))) < 10 THEN
        RAISE EXCEPTION 'referral_admin_reason_required';
      END IF;
    ELSE
      RAISE EXCEPTION 'referral_status_change_not_allowed';
    END IF;
  END IF;
  IF NEW.manual_hold IS DISTINCT FROM OLD.manual_hold AND v_kind NOT IN ('admin','system') THEN
    RAISE EXCEPTION 'referral_hold_change_not_allowed';
  END IF;
  -- The system may only ADD a hold (bank dispute); releasing needs an admin.
  IF OLD.manual_hold AND NOT NEW.manual_hold AND v_kind <> 'admin' THEN
    RAISE EXCEPTION 'referral_hold_release_requires_admin';
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_referral_reward_guard ON public.referral_rewards;
CREATE TRIGGER trg_referral_reward_guard BEFORE UPDATE OR DELETE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.referral_reward_guard();

-- Immutable event row for every insert and change. Deliberately NO outbox.
CREATE OR REPLACE FUNCTION public.referral_reward_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_type := 'reward_created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN v_type := 'status_' || NEW.status;
  ELSIF NEW.manual_hold IS DISTINCT FROM OLD.manual_hold THEN v_type := CASE WHEN NEW.manual_hold THEN 'hold_on' ELSE 'hold_off' END;
  ELSIF NEW.needs_review IS DISTINCT FROM OLD.needs_review OR NEW.review_reasons IS DISTINCT FROM OLD.review_reasons THEN v_type := 'review_flags_changed';
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.referral_reward_events(reward_id, referral_id, actor_id, actor_kind, event_type,
    from_status, to_status, reason, terms_version, details)
  VALUES (NEW.id, NEW.referral_id, nullif(current_setting('referral.actor', true), '')::uuid,
    coalesce(nullif(current_setting('referral.actor_kind', true), ''), 'system'), v_type,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
    CASE WHEN v_type IN ('hold_on','hold_off') THEN NEW.hold_reason ELSE NEW.status_reason END,
    NEW.terms_version,
    jsonb_build_object('version', NEW.version, 'needs_review', NEW.needs_review, 'review_reasons', to_jsonb(NEW.review_reasons)));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_referral_reward_audit ON public.referral_rewards;
CREATE TRIGGER trg_referral_reward_audit AFTER INSERT OR UPDATE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.referral_reward_audit();

-- Outbox guard: the one place a customer promise could leak.
CREATE OR REPLACE FUNCTION public.referral_outbox_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referral_rewards%ROWTYPE; v_kind text := coalesce(nullif(current_setting('referral.actor_kind', true), ''), 'system');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.customer_id, NEW.reward_id, NEW.referral_id, NEW.template, NEW.payload, NEW.idempotency_key)
       IS DISTINCT FROM (OLD.customer_id, OLD.reward_id, OLD.referral_id, OLD.template, OLD.payload, OLD.idempotency_key) THEN
      RAISE EXCEPTION 'referral_message_content_is_immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.reward_id IS NOT NULL THEN SELECT * INTO r FROM public.referral_rewards WHERE id = NEW.reward_id; END IF;
  IF NEW.template = 'reward_credited' AND (r.id IS NULL OR r.status <> 'booked' OR r.approved_by IS NULL OR v_kind <> 'admin') THEN
    RAISE EXCEPTION 'reward_message_requires_admin_approved_booking';
  END IF;
  IF NEW.template = 'reward_withdrawn' AND (r.id IS NULL OR r.status NOT IN ('rejected','reversed','clawed_back') OR v_kind <> 'admin') THEN
    RAISE EXCEPTION 'withdrawal_message_requires_admin_decision';
  END IF;
  IF NEW.template = 'credit_expiring' AND (r.id IS NULL OR r.status NOT IN ('booked','partly_applied')) THEN
    RAISE EXCEPTION 'expiry_message_requires_live_credit';
  END IF;
  IF r.id IS NOT NULL AND r.manual_hold THEN NEW.status := 'suppressed'; NEW.last_error := 'manual_hold'; END IF;
  IF NEW.referral_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.referral_rewards x
       WHERE x.referral_id = NEW.referral_id AND x.manual_hold) THEN
    NEW.status := 'suppressed'; NEW.last_error := 'manual_hold';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_referral_outbox_guard ON public.referral_message_outbox;
CREATE TRIGGER trg_referral_outbox_guard BEFORE INSERT OR UPDATE ON public.referral_message_outbox
  FOR EACH ROW EXECUTE FUNCTION public.referral_outbox_guard();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT rewards_enabled FROM public.platform_settings WHERE singleton = true LIMIT 1), false);
$$;

CREATE OR REPLACE FUNCTION public.referral_is_finance(p_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_uid AND role::text IN ('admin','super_admin','finance_admin'));
$$;
CREATE OR REPLACE FUNCTION public.referral_is_staff(p_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_uid
    AND role::text IN ('admin','super_admin','finance_admin','support_agent','auditor'));
$$;

CREATE OR REPLACE FUNCTION public.referral_addr_key(p_line1 text, p_line2 text, p_postcode text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN nullif(btrim(coalesce(p_line1,'')), '') IS NULL OR nullif(btrim(coalesce(p_postcode,'')), '') IS NULL THEN NULL
    ELSE md5(regexp_replace(lower(p_line1), '[^a-z0-9]', '', 'g') || '|' ||
      regexp_replace(lower(coalesce(p_line2, '')), '[^a-z0-9]', '', 'g') || '|' ||
      regexp_replace(upper(p_postcode), '[^A-Z0-9]', '', 'g')) END;
$$;
CREATE OR REPLACE FUNCTION public.referral_norm_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(regexp_replace(regexp_replace(coalesce(p,''), '[^0-9]', '', 'g'), '^(44|0)', ''), '');
$$;

CREATE OR REPLACE FUNCTION public.referral_ip_hash(p_ip text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN nullif(btrim(coalesce(p_ip,'')), '') IS NULL THEN NULL ELSE
    encode(sha256(convert_to((SELECT click_hash_salt FROM public.referral_settings WHERE singleton) || ':' ||
      btrim(split_part(p_ip, ',', 1)), 'UTF8')), 'hex') END;
$$;

CREATE OR REPLACE FUNCTION public.referral_customer_type(p_customer uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = p_customer AND account_type = 'business')
    THEN 'business' ELSE 'residential' END;
$$;

-- A customer is live: an active, unarchived service and an open account.
CREATE OR REPLACE FUNCTION public.referral_customer_live(p_customer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.services s WHERE s.user_id = p_customer AND s.status::text = 'active' AND s.archived_at IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_customer AND (p.archived_at IS NOT NULL OR p.suspended_at IS NOT NULL));
$$;

-- Payment history between p_from and p_to. Returns the first problem found,
-- or NULL if the account was never behind. Late payment never clears this.
CREATE OR REPLACE FUNCTION public.referral_payment_history_issue(p_customer uuid, p_from timestamptz, p_to timestamptz, p_grace integer DEFAULT 0)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; v_acct text; v_from date := (p_from AT TIME ZONE 'Europe/London')::date; v_to date := (p_to AT TIME ZONE 'Europe/London')::date;
BEGIN
  -- An invoice was overdue at some point inside the window.
  WITH inv AS (
    SELECT i.id, i.invoice_number, i.due_date + p_grace AS late_after,
           i.total - coalesce((SELECT sum(c.amount) FROM public.credit_notes c WHERE c.invoice_id = i.id), 0) AS owed
    FROM public.invoices i
    WHERE i.user_id = p_customer AND i.total > 0 AND i.due_date IS NOT NULL
      AND i.status::text NOT IN ('draft','void','voided','cancelled')
      AND i.due_date + p_grace < v_to
      AND NOT (i.status::text = 'paid' AND NOT EXISTS (SELECT 1 FROM public.receipts r WHERE r.invoice_id = i.id))
  ), paid AS (
    SELECT inv.id, min(x.paid_on) AS paid_full_on
    FROM inv
    JOIN LATERAL (
      SELECT (coalesce(r.paid_at, r.created_at) AT TIME ZONE 'Europe/London')::date AS paid_on,
             sum(r.amount) OVER (ORDER BY coalesce(r.paid_at, r.created_at), r.id) AS running
      FROM public.receipts r WHERE r.invoice_id = inv.id
    ) x ON x.running >= inv.owed
    GROUP BY inv.id
  )
  SELECT 'late_or_unpaid_invoice:' || coalesce(inv.invoice_number, inv.id::text) INTO v
  FROM inv LEFT JOIN paid ON paid.id = inv.id
  WHERE inv.owed > 0
    AND (paid.paid_full_on IS NULL OR paid.paid_full_on > inv.late_after)   -- it was late
    AND coalesce(paid.paid_full_on, v_to) > v_from                          -- still owing inside the window
  ORDER BY inv.late_after LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;

  IF EXISTS (SELECT 1 FROM public.payment_attempts a WHERE a.user_id = p_customer AND a.status = 'failed'
             AND a.attempted_at >= p_from AND a.attempted_at <= p_to) THEN RETURN 'failed_payment'; END IF;

  SELECT account_number INTO v_acct FROM public.profiles WHERE id = p_customer;
  IF v_acct IS NOT NULL AND to_regclass('public.payment_recon_payments') IS NOT NULL THEN
    EXECUTE 'SELECT ''dd_returned'' FROM public.payment_recon_payments WHERE linked_account_number = $1
             AND failed_on IS NOT NULL AND failed_on >= $2 AND failed_on <= $3 LIMIT 1'
      INTO v USING v_acct, v_from, v_to;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;

  SELECT e.kind INTO v FROM public.customer_standing_events e
   WHERE e.customer_id = p_customer AND e.kind <> 'leaving_request'
     AND e.occurred_at >= p_from AND e.occurred_at <= p_to
   ORDER BY e.occurred_at LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;

  IF EXISTS (SELECT 1 FROM public.services s WHERE s.user_id = p_customer AND s.status::text = 'suspended') THEN RETURN 'suspended'; END IF;
  RETURN NULL;
END $$;

-- The friend's first N bills for this order, each paid in full by its due date.
CREATE OR REPLACE FUNCTION public.referral_first_invoices(p_customer uuid, p_order uuid, p_n integer, p_grace integer DEFAULT 0)
RETURNS TABLE (invoice_id uuid, invoice_number text, due_date date, owed numeric, paid_full_on date, on_time boolean, due_passed boolean, paid_unverified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH inv AS (
    SELECT i.id, i.invoice_number, i.due_date, i.issue_date, i.created_at, i.status::text AS status,
           i.total - coalesce((SELECT sum(c.amount) FROM public.credit_notes c WHERE c.invoice_id = i.id), 0) AS owed
    FROM public.invoices i
    WHERE i.user_id = p_customer AND i.total > 0
      AND i.invoice_type IN ('monthly','first_pro_rata')
      AND i.status::text NOT IN ('draft','void','voided','cancelled')
      AND (i.order_id = p_order OR (i.order_id IS NULL AND EXISTS (
            SELECT 1 FROM public.services s WHERE s.id = i.service_id AND s.order_id = p_order)))
    ORDER BY i.issue_date, i.created_at, i.id
    LIMIT p_n
  )
  SELECT inv.id, inv.invoice_number, inv.due_date, inv.owed, pf.paid_full_on,
    (pf.paid_full_on IS NOT NULL AND pf.paid_full_on <= inv.due_date + p_grace),
    (inv.due_date + p_grace < (now() AT TIME ZONE 'Europe/London')::date),
    (inv.status = 'paid' AND NOT EXISTS (SELECT 1 FROM public.receipts r WHERE r.invoice_id = inv.id))
  FROM inv
  LEFT JOIN LATERAL (
    SELECT min(x.paid_on) AS paid_full_on FROM (
      SELECT (coalesce(r.paid_at, r.created_at) AT TIME ZONE 'Europe/London')::date AS paid_on,
             sum(r.amount) OVER (ORDER BY coalesce(r.paid_at, r.created_at), r.id) AS running
      FROM public.receipts r WHERE r.invoice_id = inv.id) x
    WHERE x.running >= inv.owed
  ) pf ON true
  ORDER BY inv.issue_date, inv.created_at, inv.id;
$$;

-- Cancellation, cease, notice, porting or migration away.
CREATE OR REPLACE FUNCTION public.referral_friend_leaving(p_order uuid, p_customer uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p_order AND (
        lower(coalesce(o.lifecycle_status, '')) ~ '(cancel|cease|failed|rejected|closed)'
        OR o.status::text IN ('cancelled','failed','rejected')
        OR o.cancellation_requested_at IS NOT NULL OR o.cease_date IS NOT NULL)) THEN 'order_cancelled_or_ceased'
    WHEN EXISTS (SELECT 1 FROM public.service_cancellation_cases c WHERE c.order_id = p_order
        AND c.withdrawn_at IS NULL AND c.status NOT IN ('withdrawn','rejected')) THEN 'cancellation_or_notice'
    WHEN EXISTS (SELECT 1 FROM public.services s WHERE s.order_id = p_order AND s.status::text IN ('ceased','cancelled')) THEN 'service_ceased'
    WHEN EXISTS (SELECT 1 FROM public.customer_standing_events e WHERE e.customer_id = p_customer AND e.kind = 'leaving_request') THEN 'porting_or_migration_away'
  END;
$$;

-- Anything showing the friend is not new in the 12 months before their order.
CREATE OR REPLACE FUNCTION public.referral_friend_prior_footprint(p_order uuid, p_customer uuid, p_lookback_months integer)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; p record; v_key text; v_since timestamptz; v_phone text; v_email text; v_name text; v_pc text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order;
  v_since := o.created_at - make_interval(months => p_lookback_months);
  v_key := public.referral_addr_key(o.address_line1, o.address_line2, o.postcode);
  SELECT email, phone, full_name, postcode, created_at INTO p FROM public.profiles WHERE id = p_customer;
  v_email := lower(btrim(p.email)); v_phone := public.referral_norm_phone(p.phone);
  v_name := lower(regexp_replace(coalesce(p.full_name,''), '\s+', ' ', 'g'));
  v_pc := regexp_replace(upper(coalesce(o.postcode, p.postcode, '')), '[^A-Z0-9]', '', 'g');

  IF p.created_at IS NOT NULL AND p.created_at < o.created_at - interval '2 days' AND EXISTS (
       SELECT 1 FROM public.services s WHERE s.user_id = p_customer AND s.created_at < o.created_at) THEN
    RETURN 'existing_account';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orders x
    LEFT JOIN public.profiles xp ON xp.id = coalesce(x.customer_id, x.user_id)
    WHERE x.id <> o.id AND x.created_at >= v_since AND x.created_at < o.created_at
      AND lower(coalesce(x.lifecycle_status, '')) NOT LIKE '%test%'
      AND (coalesce(x.customer_id, x.user_id) = p_customer
        OR (v_key IS NOT NULL AND public.referral_addr_key(x.address_line1, x.address_line2, x.postcode) = v_key)
        OR (v_email IS NOT NULL AND lower(btrim(xp.email)) = v_email)
        OR (v_phone IS NOT NULL AND public.referral_norm_phone(xp.phone) = v_phone)
        OR (v_name <> '' AND lower(regexp_replace(coalesce(xp.full_name,''), '\s+', ' ', 'g')) = v_name
            AND regexp_replace(upper(coalesce(x.postcode,'')), '[^A-Z0-9]', '', 'g') = v_pc))) THEN
    RETURN 'previous_order';
  END IF;
  IF to_regclass('public.quote_requests') IS NOT NULL THEN
    EXECUTE 'SELECT ''previous_quote'' FROM public.quote_requests q WHERE q.created_at >= $1 AND q.created_at < $2 - interval ''1 day''
       AND (lower(btrim(q.email)) = $3 OR public.referral_norm_phone(q.phone) = $4
         OR ($5 IS NOT NULL AND public.referral_addr_key(q.address_line_1, q.address_line_2, q.postcode) = $5)) LIMIT 1'
      INTO v_email USING v_since, o.created_at, v_email, v_phone, v_key;
    IF v_email = 'previous_quote' THEN RETURN 'previous_quote'; END IF;
  END IF;
  RETURN NULL;
END $$;

-- Same person or same home as the referrer.
CREATE OR REPLACE FUNCTION public.referral_self_referral(p_referrer uuid, p_order uuid, p_friend uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; rp record; fp record; v_key text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order;
  IF p_referrer = coalesce(p_friend, o.customer_id, o.user_id) THEN RETURN 'same_account'; END IF;
  SELECT email, phone, full_name, postcode, address_line1, address_line2 INTO rp FROM public.profiles WHERE id = p_referrer;
  SELECT email, phone, full_name, postcode INTO fp FROM public.profiles WHERE id = coalesce(p_friend, o.customer_id, o.user_id);
  IF fp.email IS NOT NULL AND lower(btrim(fp.email)) = lower(btrim(rp.email)) THEN RETURN 'same_email'; END IF;
  IF public.referral_norm_phone(fp.phone) IS NOT NULL AND public.referral_norm_phone(fp.phone) = public.referral_norm_phone(rp.phone) THEN RETURN 'same_phone'; END IF;
  v_key := public.referral_addr_key(o.address_line1, o.address_line2, o.postcode);
  IF v_key IS NOT NULL AND (v_key = public.referral_addr_key(rp.address_line1, rp.address_line2, rp.postcode)
      OR EXISTS (SELECT 1 FROM public.orders ro WHERE coalesce(ro.customer_id, ro.user_id) = p_referrer AND ro.id <> o.id
                  AND public.referral_addr_key(ro.address_line1, ro.address_line2, ro.postcode) = v_key)) THEN
    RETURN 'same_service_address';
  END IF;
  IF fp.full_name IS NOT NULL AND lower(regexp_replace(fp.full_name, '\s+', ' ', 'g')) = lower(regexp_replace(coalesce(rp.full_name,''), '\s+', ' ', 'g')) THEN
    RETURN 'same_name';
  END IF;
  RETURN NULL;
END $$;

-- Review signals that never auto-reject but stop a quiet approval.
CREATE OR REPLACE FUNCTION public.referral_review_signals(p_referral uuid) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.referrals%ROWTYPE; v text[] := '{}'; v_utm jsonb;
BEGIN
  SELECT * INTO f FROM public.referrals WHERE id = p_referral;
  IF f.attribution_method = 'admin_manual' THEN v := array_append(v, 'manual_attribution'); END IF;
  IF f.attribution_method = 'link' AND f.click_id IS NULL THEN v := array_append(v, 'no_click_evidence'); END IF;
  SELECT utm_snapshot INTO v_utm FROM public.customer_journey_sessions WHERE id = f.friend_session_id;
  IF v_utm IS NOT NULL AND (
       coalesce(v_utm->>'gclid', v_utm->'first_touch'->>'gclid', v_utm->>'msclkid',
                v_utm->>'fbclid', v_utm->>'ttclid') IS NOT NULL
       OR lower(coalesce(v_utm->>'utm_medium', '')) IN ('cpc','ppc','paid','paidsearch','paid_social')) THEN
    v := array_append(v, 'paid_ad_click');
  END IF;
  IF EXISTS (SELECT 1 FROM public.dd_mandates a JOIN public.dd_mandates b
       ON a.masked_account_last4 = b.masked_account_last4 AND a.masked_sort_last2 = b.masked_sort_last2
       WHERE a.user_id = f.referrer_id AND b.user_id = f.friend_customer_id AND a.masked_account_last4 IS NOT NULL) THEN
    v := array_append(v, 'shared_bank_account');
  END IF;
  IF EXISTS (SELECT 1 FROM public.fraud_flags ff WHERE ff.status = 'open'
       AND (ff.customer_id IN (f.referrer_id, f.friend_customer_id))) THEN
    v := array_append(v, 'open_fraud_flag');
  END IF;
  IF (SELECT count(*) FROM public.referrals x WHERE x.referrer_id = f.referrer_id
       AND x.created_at > f.created_at - interval '7 days' AND x.created_at <= f.created_at) >= 3 THEN
    v := array_append(v, 'burst_of_referrals');
  END IF;
  RETURN v;
END $$;

-- ---------------------------------------------------------------------------
-- The engine. One authoritative decision per referral; hourly and on demand.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_evaluate(p_referral uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f public.referrals%ROWTYPE; o public.orders%ROWTYPE; rr public.referral_rewards%ROWTYPE;
  v_rules jsonb; v_live timestamptz; v_now timestamptz := now(); v_grace int; v_n int; v_days int;
  v_common text; v_ref_only text; v_friend_only text; v_wait text; v_inv record; v_paid int := 0;
  v_next text; v_reason text; v_signals text[]; v_unverified boolean := false; v_cap int; v_used int; v_clawback text; v_out jsonb := '{}';
BEGIN
  PERFORM set_config('referral.actor_kind', 'system', true);
  SELECT * INTO f FROM public.referrals WHERE id = p_referral;
  IF f.id IS NULL THEN RETURN jsonb_build_object('error','missing'); END IF;
  SELECT * INTO o FROM public.orders WHERE id = f.friend_order_id;
  v_rules := f.rules; v_grace := coalesce((v_rules->>'payment_grace_days')::int, 0);
  v_n := (v_rules->>'invoices_required')::int; v_days := (v_rules->>'qualify_days')::int;

  IF f.friend_customer_id IS NULL AND coalesce(o.customer_id, o.user_id) IS NOT NULL THEN
    UPDATE public.referrals SET friend_customer_id = coalesce(o.customer_id, o.user_id) WHERE id = f.id;
    f.friend_customer_id := coalesce(o.customer_id, o.user_id);
  END IF;
  PERFORM public.referral_ensure_friend_reward(f.id);
  v_live := coalesce(o.actual_service_live_at_utc, o.actual_activation_date::timestamp AT TIME ZONE 'Europe/London');

  -- Terminal reasons that apply to both rewards (the friend's side).
  v_common := CASE
    WHEN public.referral_self_referral(f.referrer_id, f.friend_order_id, f.friend_customer_id) IS NOT NULL
      THEN 'self_referral:' || public.referral_self_referral(f.referrer_id, f.friend_order_id, f.friend_customer_id)
    WHEN f.friend_customer_id IS NOT NULL AND public.referral_friend_prior_footprint(f.friend_order_id, f.friend_customer_id,
           (v_rules->>'new_customer_lookback_months')::int) IS NOT NULL
      THEN 'not_new_customer:' || public.referral_friend_prior_footprint(f.friend_order_id, f.friend_customer_id, (v_rules->>'new_customer_lookback_months')::int)
    WHEN o.campaign_code IS NOT NULL AND NOT coalesce((v_rules->>'allow_promotion_stacking')::boolean, false)
      THEN 'promotion_stacking:' || o.campaign_code
    WHEN public.referral_friend_leaving(f.friend_order_id, f.friend_customer_id) IS NOT NULL
      THEN 'friend_leaving:' || public.referral_friend_leaving(f.friend_order_id, f.friend_customer_id)
    WHEN f.friend_customer_id IS NOT NULL AND public.referral_payment_history_issue(f.friend_customer_id, f.order_created_at, v_now, v_grace) IS NOT NULL
      THEN 'friend_payment_history:' || public.referral_payment_history_issue(f.friend_customer_id, f.order_created_at, v_now, v_grace)
  END;

  -- First bills: any late one is terminal; otherwise count paid ones.
  IF v_common IS NULL AND f.friend_customer_id IS NOT NULL THEN
    FOR v_inv IN SELECT * FROM public.referral_first_invoices(f.friend_customer_id, f.friend_order_id, v_n, v_grace) LOOP
      IF v_inv.on_time THEN v_paid := v_paid + 1;
      ELSIF v_inv.paid_unverified THEN v_unverified := true;
      ELSIF v_inv.due_passed OR v_inv.paid_full_on IS NOT NULL THEN
        v_common := 'friend_bill_not_paid_on_time:' || coalesce(v_inv.invoice_number, v_inv.invoice_id::text); EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Referrer-only terminal reasons.
  v_ref_only := CASE
    WHEN public.referral_payment_history_issue(f.referrer_id, f.order_created_at, v_now, v_grace) IS NOT NULL
      THEN 'referrer_payment_history:' || public.referral_payment_history_issue(f.referrer_id, f.order_created_at, v_now, v_grace)
  END;

  -- Waiting states.
  v_wait := CASE
    WHEN f.friend_customer_id IS NULL OR v_live IS NULL OR lower(coalesce(o.lifecycle_status,'')) <> 'live' THEN 'tracked'
    WHEN v_now < v_live + make_interval(days => v_days) THEN 'pending'
    WHEN v_paid < v_n THEN 'qualifying'
  END;

  FOR rr IN SELECT * FROM public.referral_rewards WHERE referral_id = f.id ORDER BY role FOR UPDATE LOOP
    -- After approval the engine only raises flags for an admin.
    IF rr.status IN ('booked','partly_applied','applied') THEN
      v_clawback := NULL;
      IF rr.live_at IS NOT NULL AND v_now < rr.live_at + make_interval(months => (v_rules->>'clawback_months')::int) THEN
        v_clawback := public.referral_friend_leaving(f.friend_order_id, f.friend_customer_id);
      END IF;
      IF v_clawback IS NULL AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.user_id = f.friend_customer_id AND i.total > 0
           AND i.status::text NOT IN ('paid','draft','void','voided','cancelled','refunded')
           AND i.due_date + (v_rules->>'unpaid_clawback_days')::int < (v_now AT TIME ZONE 'Europe/London')::date
           AND rr.live_at IS NOT NULL AND i.due_date < (rr.live_at + make_interval(months => (v_rules->>'clawback_months')::int))::date) THEN
        v_clawback := 'friend_invoice_unpaid_30_days';
      END IF;
      IF v_clawback IS NOT NULL AND NOT ('clawback_due:' || v_clawback = ANY(rr.review_reasons)) THEN
        UPDATE public.referral_rewards SET needs_review = true,
          review_reasons = array_append(review_reasons, 'clawback_due:' || v_clawback) WHERE id = rr.id;
      END IF;
      v_out := v_out || jsonb_build_object(rr.role, rr.status);
      CONTINUE;
    END IF;
    IF rr.manual_hold OR rr.status NOT IN ('tracked','pending','qualifying','approved_awaiting_admin') THEN
      v_out := v_out || jsonb_build_object(rr.role, rr.status); CONTINUE;
    END IF;

    v_reason := coalesce(v_common, CASE WHEN rr.role = 'referrer' THEN v_ref_only END);
    IF v_reason IS NOT NULL THEN v_next := 'rejected';
    ELSIF v_wait IS NOT NULL THEN v_next := v_wait;
    ELSE
      v_next := 'approved_awaiting_admin';
      -- On the qualifying date the referrer must still be live and up to date.
      IF rr.role = 'referrer' AND NOT public.referral_customer_live(f.referrer_id) THEN
        v_next := 'rejected'; v_reason := 'referrer_not_live_on_qualifying_date';
      ELSIF rr.role = 'friend' AND NOT public.referral_customer_live(f.friend_customer_id) THEN
        v_next := 'rejected'; v_reason := 'friend_not_live_on_qualifying_date';
      ELSIF rr.role = 'referrer' AND rr.status <> 'approved_awaiting_admin' THEN
        v_cap := (v_rules->'caps'->>f.referrer_type)::int;
        SELECT count(*) INTO v_used FROM public.referral_rewards x
          WHERE x.customer_id = f.referrer_id AND x.role = 'referrer' AND x.id <> rr.id
            AND x.status IN ('approved_awaiting_admin','booked','partly_applied','applied','expired')
            AND coalesce(x.qualifies_at, x.created_at) > v_now - interval '12 months';
        IF v_used >= v_cap THEN v_next := 'rejected'; v_reason := 'annual_cap_reached'; END IF;
      END IF;
    END IF;

    v_signals := public.referral_review_signals(f.id);
    IF v_unverified THEN v_signals := array_append(v_signals, 'paid_invoice_without_receipt'); END IF;
    IF (rr.status, rr.status_reason, rr.live_at, rr.needs_review, rr.review_reasons)
       IS DISTINCT FROM (v_next, v_reason, v_live, cardinality(v_signals) > 0, v_signals) THEN
      UPDATE public.referral_rewards SET status = v_next, status_reason = v_reason, live_at = v_live,
        qualifies_at = CASE WHEN v_next = 'approved_awaiting_admin' THEN coalesce(qualifies_at, v_now) ELSE qualifies_at END,
        needs_review = cardinality(v_signals) > 0, review_reasons = v_signals
      WHERE id = rr.id;
    END IF;
    v_out := v_out || jsonb_build_object(rr.role, v_next);
  END LOOP;
  RETURN v_out;
END $$;

CREATE OR REPLACE FUNCTION public.referral_evaluate_all() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.referral_enabled() THEN RETURN 0; END IF;
  FOR r IN SELECT DISTINCT f.id FROM public.referrals f JOIN public.referral_rewards w ON w.referral_id = f.id
           WHERE w.status IN ('tracked','pending','qualifying','approved_awaiting_admin','booked','partly_applied','applied')
             AND NOT w.manual_hold LOOP
    PERFORM public.referral_evaluate(r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- Binding: a friend's order is attributed only from evidence captured BEFORE
-- the order existed (link cc on the journey session, or the code typed in the
-- reference-code box). Never added afterwards except by an admin (7 days).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_create(p_order uuid, p_code_id uuid, p_method text, p_session uuid,
  p_click uuid, p_evidence jsonb, p_admin uuid DEFAULT NULL, p_admin_reason text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; c public.referral_codes%ROWTYPE; t public.referral_terms_versions%ROWTYPE;
  v_id uuid; v_friend uuid; v_ftype text; v_rtype text; v_amt numeric; v_rate numeric; v_role text; v_ben uuid; v_btype text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order;
  SELECT * INTO c FROM public.referral_codes WHERE id = p_code_id;
  IF c.customer_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO t FROM public.referral_terms_versions WHERE version = coalesce(c.terms_version,
    (SELECT current_terms_version FROM public.referral_settings WHERE singleton));
  -- The friend gets the terms in force when they ordered, never older ones.
  IF t.version IS NULL OR t.effective_from > o.created_at THEN
    SELECT * INTO t FROM public.referral_terms_versions
     WHERE effective_from <= o.created_at OR version = coalesce(c.terms_version, t.version)
     ORDER BY (effective_from <= o.created_at) DESC, effective_from DESC LIMIT 1;
  END IF;
  IF t.version IS NULL THEN RETURN NULL; END IF;
  v_friend := coalesce(o.customer_id, o.user_id);
  -- Any non-consumer order type (business, micro/small business, not-for-profit)
  -- is billed VAT-exclusive, so it takes the business rewards.
  v_ftype := CASE WHEN o.customer_type_v2 IS NOT NULL AND o.customer_type_v2::text <> 'residential_consumer' THEN 'business'
                  WHEN v_friend IS NOT NULL THEN public.referral_customer_type(v_friend) ELSE 'residential' END;
  v_rtype := public.referral_customer_type(c.customer_id);
  v_rate := (t.rules->>'vat_rate')::numeric;

  INSERT INTO public.referrals(referral_code_id, referrer_id, referrer_type, friend_customer_id, friend_order_id,
    friend_session_id, friend_type, attribution_method, click_id, evidence, order_created_at, terms_version, rules,
    manual_attach_reason, manual_attached_by)
  VALUES (c.id, c.customer_id, v_rtype, v_friend, o.id, p_session, v_ftype, p_method, p_click, p_evidence,
    o.created_at, t.version, t.rules, p_admin_reason, p_admin)
  ON CONFLICT (friend_order_id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN NULL; END IF;

  FOREACH v_role IN ARRAY ARRAY['referrer','friend'] LOOP
    v_amt := (t.rules->'rewards'->v_ftype->>v_role)::numeric;
    v_ben := CASE WHEN v_role = 'referrer' THEN c.customer_id ELSE v_friend END;
    v_btype := CASE WHEN v_role = 'referrer' THEN v_rtype ELSE v_ftype END;
    IF v_amt IS NULL OR v_amt <= 0 OR v_ben IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.referral_rewards(referral_id, customer_id, role, amount, amount_basis, credit_gross_minor, terms_version)
    VALUES (v_id, v_ben, v_role, v_amt, CASE WHEN v_btype = 'business' THEN 'net' ELSE 'gross' END,
      CASE WHEN v_btype = 'business' THEN round(v_amt * 100 * (1 + v_rate / 100))::int ELSE round(v_amt * 100)::int END,
      t.version);
  END LOOP;

  UPDATE public.referral_codes SET usage_count = usage_count + 1 WHERE id = c.id;
  RETURN v_id;
END $$;

-- Friend reward rows need the friend's account, which Journey 2 provisions
-- after the order. Create it when the link appears.
CREATE OR REPLACE FUNCTION public.referral_ensure_friend_reward(p_referral uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.referrals%ROWTYPE; v_amt numeric; v_rate numeric; v_btype text;
BEGIN
  SELECT * INTO f FROM public.referrals WHERE id = p_referral;
  IF f.friend_customer_id IS NULL OR EXISTS (SELECT 1 FROM public.referral_rewards WHERE referral_id = f.id AND role = 'friend') THEN RETURN; END IF;
  v_amt := (f.rules->'rewards'->f.friend_type->>'friend')::numeric; v_rate := (f.rules->>'vat_rate')::numeric;
  v_btype := f.friend_type;
  IF v_amt IS NULL OR v_amt <= 0 THEN RETURN; END IF;
  INSERT INTO public.referral_rewards(referral_id, customer_id, role, amount, amount_basis, credit_gross_minor, terms_version,
    status, status_reason)
  SELECT f.id, f.friend_customer_id, 'friend', v_amt, CASE WHEN v_btype = 'business' THEN 'net' ELSE 'gross' END,
    CASE WHEN v_btype = 'business' THEN round(v_amt * 100 * (1 + v_rate / 100))::int ELSE round(v_amt * 100)::int END,
    f.terms_version, 'tracked', NULL
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.referral_bind_order(p_order uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; s record; v_existing uuid; v_link text; v_typed text; v_code public.referral_codes%ROWTYPE;
  v_method text; v_click uuid; v_iphash text; v_id uuid; v_captured timestamptz; v_window int := 30;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order;
  SELECT id INTO v_existing FROM public.referrals WHERE friend_order_id = p_order;
  IF v_existing IS NOT NULL THEN
    UPDATE public.referrals SET friend_customer_id = coalesce(o.customer_id, o.user_id)
      WHERE id = v_existing AND friend_customer_id IS NULL AND coalesce(o.customer_id, o.user_id) IS NOT NULL;
    PERFORM public.referral_ensure_friend_reward(v_existing);
    RETURN v_existing;
  END IF;
  IF NOT public.referral_enabled() THEN RETURN NULL; END IF;

  SELECT cs.id, cs.utm_snapshot, cs.customer_details, cs.ip, cs.user_agent, cs.created_at, cs.submitted_at, cs.test_session
    INTO s FROM public.customer_journey_sessions cs
   WHERE (cs.order_id = o.id OR (o.checkout_session_id IS NOT NULL AND cs.checkout_session_id = o.checkout_session_id))
   ORDER BY (cs.order_id IS NOT DISTINCT FROM o.id) DESC, cs.created_at DESC LIMIT 1;
  IF s.id IS NULL OR coalesce(s.test_session, false) THEN RETURN NULL; END IF;

  v_link := upper(nullif(btrim(coalesce(s.utm_snapshot->'first_touch'->>'cc', s.utm_snapshot->>'cc')), ''));
  v_typed := upper(nullif(btrim(s.customer_details->>'offer_code'), ''));
  v_captured := coalesce(nullif(s.utm_snapshot->>'captured_at', '')::timestamptz, s.created_at);

  SELECT * INTO v_code FROM public.referral_codes rc WHERE rc.code = v_link AND rc.customer_id IS NOT NULL
     AND rc.status = 'active' AND (rc.expires_at IS NULL OR rc.expires_at > o.created_at) AND v_captured <= o.created_at;
  IF v_code.id IS NOT NULL THEN v_method := 'link';
  ELSE
    SELECT * INTO v_code FROM public.referral_codes rc WHERE rc.code = v_typed AND rc.customer_id IS NOT NULL
       AND rc.status = 'active' AND (rc.expires_at IS NULL OR rc.expires_at > o.created_at);
    IF v_code.id IS NOT NULL THEN v_method := 'typed_code'; END IF;
  END IF;
  IF v_code.id IS NULL THEN RETURN NULL; END IF;

  v_iphash := public.referral_ip_hash(s.ip);
  SELECT k.id INTO v_click FROM public.referral_clicks k
   WHERE k.referral_code_id = v_code.id AND k.created_at <= o.created_at
     AND k.created_at > o.created_at - make_interval(days => v_window)
   ORDER BY (v_iphash IS NOT NULL AND k.ip_hash = v_iphash) DESC, k.created_at DESC LIMIT 1;

  v_id := public.referral_create(o.id, v_code.id, v_method, s.id, v_click, jsonb_build_object(
    'session_id', s.id, 'session_started_at', s.created_at, 'session_submitted_at', s.submitted_at,
    'order_created_at', o.created_at, 'captured_at', v_captured,
    'link_code', v_link, 'typed_code', v_typed,
    'landing_path', s.utm_snapshot->>'landing_path', 'referrer_host', s.utm_snapshot->>'referrer_host',
    'session_ip_hash', v_iphash, 'session_user_agent', left(s.user_agent, 300),
    'click_id', v_click, 'click_ip_matches', (v_click IS NOT NULL AND EXISTS (SELECT 1 FROM public.referral_clicks k WHERE k.id = v_click AND k.ip_hash = v_iphash))));
  IF v_id IS NOT NULL THEN
    PERFORM public.referral_evaluate(v_id);
    -- "Friend joined (pending)": a status note, never a promise.
    INSERT INTO public.referral_message_outbox(customer_id, referral_id, template, payload, idempotency_key)
    SELECT f.referrer_id, f.id, 'friend_joined',
      jsonb_build_object('referral_ref', f.ref, 'qualify_days', f.rules->>'qualify_days',
        'invoices_required', f.rules->>'invoices_required',
        'amount', (f.rules->'rewards'->f.friend_type->>'referrer'), 'amount_basis',
        CASE WHEN f.referrer_type = 'business' THEN 'net' ELSE 'gross' END,
        'terms_version', f.terms_version,
        'recipient_email', (SELECT email FROM public.profiles WHERE id = f.referrer_id)),
      'friend_joined:' || f.id
    FROM public.referrals f WHERE f.id = v_id
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.referral_order_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM public.referral_bind_order(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Attribution must never block an order.
    INSERT INTO public.referral_binding_errors(order_id, error) VALUES (NEW.id, left(SQLERRM, 500));
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_referral_order_bind ON public.orders;
CREATE TRIGGER zz_referral_order_bind AFTER INSERT OR UPDATE OF checkout_session_id, customer_id, user_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.referral_order_changed();

-- ---------------------------------------------------------------------------
-- Standing history capture and the automatic bank-dispute hold
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_hold_for_friend(p_customer uuid, p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM set_config('referral.actor_kind', 'system', true);
  UPDATE public.referral_rewards w SET manual_hold = true, hold_reason = p_reason
   WHERE NOT w.manual_hold AND w.referral_id IN (SELECT id FROM public.referrals WHERE friend_customer_id = p_customer)
     AND w.status NOT IN ('rejected','reversed','clawed_back','expired');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.referral_message_outbox SET status = 'suppressed', last_error = 'manual_hold'
   WHERE status = 'pending' AND (referral_id IN (SELECT id FROM public.referrals WHERE friend_customer_id = p_customer)
     OR reward_id IN (SELECT w.id FROM public.referral_rewards w JOIN public.referrals f ON f.id = w.referral_id WHERE f.friend_customer_id = p_customer));
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.referral_standing_event_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind IN ('dd_returned','bank_recall') THEN
    PERFORM public.referral_hold_for_friend(NEW.customer_id, 'bank_dispute:' || NEW.kind);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_standing_event_hold ON public.customer_standing_events;
CREATE TRIGGER trg_standing_event_hold AFTER INSERT ON public.customer_standing_events
  FOR EACH ROW EXECUTE FUNCTION public.referral_standing_event_added();

CREATE OR REPLACE FUNCTION public.referral_capture_standing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer uuid; v_kind text; v_details jsonb;
BEGIN
  BEGIN
    -- One branch per table: NEW only has the columns of the table that fired.
    IF TG_TABLE_NAME = 'services' THEN
      IF NEW.status::text = 'suspended' AND OLD.status::text IS DISTINCT FROM 'suspended' THEN
        v_customer := NEW.user_id; v_kind := 'suspended'; v_details := jsonb_build_object('service_id', NEW.id, 'reason', NEW.suspension_reason);
      END IF;
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      IF NEW.suspended_at IS NOT NULL AND OLD.suspended_at IS NULL THEN
        v_customer := NEW.id; v_kind := 'suspended'; v_details := jsonb_build_object('profile', true);
      END IF;
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      IF NEW.status::text = 'overdue' AND OLD.status::text IS DISTINCT FROM 'overdue' THEN
        v_customer := NEW.user_id; v_kind := 'overdue_notice'; v_details := jsonb_build_object('invoice_id', NEW.id, 'invoice_number', NEW.invoice_number);
      END IF;
    ELSIF TG_TABLE_NAME = 'payment_attempts' THEN
      IF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'failed') THEN
        v_customer := NEW.user_id; v_kind := 'dd_returned'; v_details := jsonb_build_object('payment_attempt_id', NEW.id, 'invoice_id', NEW.invoice_id, 'reason', NEW.reason);
      END IF;
    END IF;
    IF v_customer IS NOT NULL THEN
      INSERT INTO public.customer_standing_events(customer_id, kind, source, details) VALUES (v_customer, v_kind, TG_TABLE_NAME, v_details);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.referral_binding_errors(error) VALUES ('standing_capture:' || TG_TABLE_NAME || ':' || left(SQLERRM, 400));
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_referral_standing_services ON public.services;
CREATE TRIGGER zz_referral_standing_services AFTER UPDATE OF status ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.referral_capture_standing();
DROP TRIGGER IF EXISTS zz_referral_standing_profiles ON public.profiles;
CREATE TRIGGER zz_referral_standing_profiles AFTER UPDATE OF suspended_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.referral_capture_standing();
DROP TRIGGER IF EXISTS zz_referral_standing_invoices ON public.invoices;
CREATE TRIGGER zz_referral_standing_invoices AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.referral_capture_standing();
DROP TRIGGER IF EXISTS zz_referral_standing_attempts ON public.payment_attempts;
CREATE TRIGGER zz_referral_standing_attempts AFTER INSERT OR UPDATE OF status ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.referral_capture_standing();

-- ---------------------------------------------------------------------------
-- Credit ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_credit_balance(p_reward uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(CASE kind WHEN 'booked' THEN amount_minor WHEN 'unapplied' THEN amount_minor ELSE -amount_minor END), 0)::int
  FROM public.referral_credit_movements WHERE reward_id = p_reward;
$$;

CREATE OR REPLACE FUNCTION public.referral_refresh_ledger_status(p_reward uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referral_rewards%ROWTYPE; v_bal int; v_next text; v_prev text := current_setting('referral.actor_kind', true);
BEGIN
  SELECT * INTO r FROM public.referral_rewards WHERE id = p_reward FOR UPDATE;
  IF r.status NOT IN ('booked','partly_applied','applied') THEN RETURN r.status; END IF;
  v_bal := public.referral_credit_balance(p_reward);
  v_next := CASE WHEN v_bal <= 0 THEN 'applied' WHEN v_bal < r.credit_gross_minor THEN 'partly_applied' ELSE 'booked' END;
  IF v_next <> r.status THEN
    PERFORM set_config('referral.actor_kind', 'ledger', true);
    UPDATE public.referral_rewards SET status = v_next, status_reason = 'ledger_balance:' || v_bal WHERE id = p_reward;
    PERFORM set_config('referral.actor_kind', coalesce(v_prev, ''), true);
  END IF;
  RETURN v_next;
END $$;

-- Apply available credit to a freshly created (draft, unsent) invoice.
-- Idempotent: an invoice that already carries credit returns what it has.
-- The credit never exceeds the bill, so an invoice can't go negative.
-- Line VAT uses the same rounding as itemiseInvoice / billLinesFromStored.
CREATE OR REPLACE FUNCTION public.referral_apply_credit_to_invoice(p_invoice uuid, p_apply boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.invoices%ROWTYPE; r record; v_left int; v_take int; v_rate numeric; v_net int; v_line uuid;
  v_out jsonb := '[]'; v_desc text; v_sub int := 0; v_vat int := 0; v_gross int := 0; v_facct text; v_forder text;
BEGIN
  SELECT * INTO i FROM public.invoices WHERE id = p_invoice FOR UPDATE;
  IF i.id IS NULL THEN RETURN '[]'; END IF;
  v_rate := CASE WHEN coalesce(i.vat_enabled, true) THEN coalesce(i.vat_rate, 20) ELSE 0 END;
  IF v_rate > 0 AND v_rate <= 1 THEN v_rate := v_rate * 100; END IF;

  IF EXISTS (SELECT 1 FROM public.referral_credit_movements m WHERE m.invoice_id = i.id AND m.kind = 'applied') THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('reward_id', m.reward_id, 'invoice_line_id', m.invoice_line_id,
      'description', l.description, 'gross_minor', -m.amount_minor,
      'net_minor', CASE WHEN v_rate > 0 THEN floor(-m.amount_minor / (1 + v_rate / 100) + 0.5)::int ELSE -m.amount_minor END,
      'vat_rate', v_rate) ORDER BY m.id), '[]') INTO v_out
    FROM public.referral_credit_movements m LEFT JOIN public.invoice_lines l ON l.id = m.invoice_line_id
    WHERE m.invoice_id = i.id AND m.kind = 'applied'
      AND NOT EXISTS (SELECT 1 FROM public.referral_credit_movements u WHERE u.invoice_id = i.id AND u.reward_id = m.reward_id AND u.kind = 'unapplied');
    RETURN v_out;
  END IF;
  -- Read-only callers (a retry of an invoice created earlier) only see what is
  -- already on it: adding credit after its PDF exists would make them disagree.
  IF NOT p_apply OR i.pdf_storage_key IS NOT NULL THEN RETURN '[]'; END IF;
  IF i.status::text <> 'draft' OR i.email_sent_at IS NOT NULL OR coalesce(i.total, 0) <= 0 THEN RETURN '[]'; END IF;

  v_left := round(i.total * 100)::int;
  PERFORM set_config('referral.actor_kind', 'ledger', true);
  FOR r IN SELECT w.* FROM public.referral_rewards w
           WHERE w.customer_id = i.user_id AND w.status IN ('booked','partly_applied') AND NOT w.manual_hold
             AND (w.expires_at IS NULL OR w.expires_at > now())
           ORDER BY w.expires_at NULLS LAST, w.booked_at, w.id FOR UPDATE LOOP
    EXIT WHEN v_left <= 0;
    v_take := least(public.referral_credit_balance(r.id), v_left);
    CONTINUE WHEN v_take <= 0;
    v_facct := NULL; v_forder := NULL;
    SELECT (SELECT p.account_number FROM public.profiles p WHERE p.id = x.friend_customer_id),
           (SELECT o.occta_order_number FROM public.orders o WHERE o.id = x.friend_order_id)
      INTO v_facct, v_forder FROM public.referrals x WHERE x.id = r.referral_id;
    v_desc := CASE r.role
      WHEN 'referrer' THEN 'Referral credit – friend ' || coalesce(v_facct, v_forder, 'referral') || ' (ref ' || r.ref || ')'
      WHEN 'friend' THEN 'Welcome credit – referred by a friend (ref ' || r.ref || ')'
      ELSE 'Goodwill credit (ref ' || r.ref || ')' END;
    v_net := CASE WHEN v_rate > 0 THEN floor(-v_take / (1 + v_rate / 100) + 0.5)::int ELSE -v_take END;
    INSERT INTO public.invoice_lines(invoice_id, description, qty, unit_price, line_total, vat_rate, metadata)
    VALUES (i.id, v_desc, 1, -v_take / 100.0, -v_take / 100.0, v_rate,
      jsonb_build_object('kind', 'referral_credit', 'referral_reward_id', r.id, 'reward_ref', r.ref))
    RETURNING id INTO v_line;
    INSERT INTO public.referral_credit_movements(reward_id, customer_id, kind, amount_minor, invoice_id, invoice_line_id, reason)
    VALUES (r.id, r.customer_id, 'applied', v_take, i.id, v_line, 'invoice ' || coalesce(i.invoice_number, i.id::text));
    PERFORM public.referral_refresh_ledger_status(r.id);
    v_left := v_left - v_take;
    v_gross := v_gross - v_take; v_sub := v_sub + v_net; v_vat := v_vat + (-v_take - v_net);
    v_out := v_out || jsonb_build_array(jsonb_build_object('reward_id', r.id, 'invoice_line_id', v_line,
      'description', v_desc, 'gross_minor', -v_take, 'net_minor', v_net, 'vat_rate', v_rate));
  END LOOP;
  IF v_gross <> 0 THEN
    UPDATE public.invoices SET
      subtotal = round(subtotal * 100 + v_sub) / 100.0,
      vat_total = round(coalesce(vat_total, 0) * 100 + v_vat) / 100.0,
      total = round(total * 100 + v_gross) / 100.0
    WHERE id = i.id;
  END IF;
  RETURN v_out;
END $$;

-- A cancelled or voided invoice gives its credit back.
CREATE OR REPLACE FUNCTION public.referral_invoice_cancelled() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  IF NEW.status::text IN ('cancelled','void','voided') AND OLD.status::text NOT IN ('cancelled','void','voided') THEN
    FOR m IN SELECT * FROM public.referral_credit_movements a WHERE a.invoice_id = NEW.id AND a.kind = 'applied'
             AND NOT EXISTS (SELECT 1 FROM public.referral_credit_movements u WHERE u.invoice_id = NEW.id AND u.reward_id = a.reward_id AND u.kind = 'unapplied') LOOP
      INSERT INTO public.referral_credit_movements(reward_id, customer_id, kind, amount_minor, invoice_id, invoice_line_id, reason)
      VALUES (m.reward_id, m.customer_id, 'unapplied', m.amount_minor, NEW.id, m.invoice_line_id, 'invoice ' || NEW.status::text);
      PERFORM public.referral_refresh_ledger_status(m.reward_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_referral_invoice_cancelled ON public.invoices;
CREATE TRIGGER zz_referral_invoice_cancelled AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.referral_invoice_cancelled();

-- ---------------------------------------------------------------------------
-- Admin actions (RPC, via the signed-in admin's session). Idempotent per
-- request_id. Every action needs a written reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_admin_action(p_request_id uuid, p_action text, p_reward_id uuid,
  p_expected_version integer, p_reason text, p_notify boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); r public.referral_rewards%ROWTYPE; f public.referrals%ROWTYPE; v_prior public.referral_reward_events%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, '')); v_bal int; v_result jsonb; v_months int; v_email text; v_new text;
BEGIN
  IF v_actor IS NULL OR NOT public.referral_is_finance(v_actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF p_request_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'request_id_required'); END IF;
  IF length(v_reason) NOT BETWEEN 10 AND 1000 THEN RETURN jsonb_build_object('ok', false, 'error', 'reason_required'); END IF;
  SELECT * INTO v_prior FROM public.referral_reward_events WHERE request_id = p_request_id;
  IF v_prior.id IS NOT NULL THEN
    IF v_prior.actor_id IS DISTINCT FROM v_actor OR v_prior.details->>'action' IS DISTINCT FROM p_action
       OR v_prior.reward_id IS DISTINCT FROM p_reward_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'idempotency_conflict'); END IF;
    RETURN v_prior.details->'result';
  END IF;
  SELECT * INTO r FROM public.referral_rewards WHERE id = p_reward_id FOR UPDATE;
  IF r.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'reward_not_found'); END IF;
  IF p_expected_version IS DISTINCT FROM r.version THEN RETURN jsonb_build_object('ok', false, 'error', 'stale_reward', 'version', r.version); END IF;
  SELECT * INTO f FROM public.referrals WHERE id = r.referral_id;
  PERFORM set_config('referral.actor', v_actor::text, true);
  PERFORM set_config('referral.actor_kind', 'admin', true);
  SELECT email INTO v_email FROM public.profiles WHERE id = r.customer_id;

  IF p_action = 'approve' THEN
    IF r.status <> 'approved_awaiting_admin' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_awaiting_approval', 'status', r.status); END IF;
    IF r.manual_hold THEN RETURN jsonb_build_object('ok', false, 'error', 'on_hold'); END IF;
    -- Re-check everything at the moment of approval.
    PERFORM set_config('referral.actor_kind', 'system', true);
    PERFORM public.referral_evaluate(r.referral_id);
    PERFORM set_config('referral.actor_kind', 'admin', true);
    SELECT * INTO r FROM public.referral_rewards WHERE id = p_reward_id FOR UPDATE;
    IF r.status <> 'approved_awaiting_admin' THEN RETURN jsonb_build_object('ok', false, 'error', 'no_longer_qualifies', 'status', r.status, 'reason', r.status_reason); END IF;
    v_months := (f.rules->>'credit_expiry_months')::int;
    UPDATE public.referral_rewards SET status = 'booked', status_reason = v_reason, approved_at = now(), approved_by = v_actor,
      booked_at = now(), expires_at = now() + make_interval(months => v_months) WHERE id = r.id;
    INSERT INTO public.referral_credit_movements(reward_id, customer_id, kind, amount_minor, actor_id, reason)
    VALUES (r.id, r.customer_id, 'booked', r.credit_gross_minor, v_actor, v_reason);
    INSERT INTO public.referral_message_outbox(customer_id, reward_id, referral_id, template, payload, idempotency_key)
    VALUES (r.customer_id, r.id, r.referral_id, 'reward_credited', jsonb_build_object(
      'reward_ref', r.ref, 'role', r.role, 'amount', r.amount, 'amount_basis', r.amount_basis,
      'expires_at', now() + make_interval(months => v_months), 'terms_version', r.terms_version, 'recipient_email', v_email),
      'credited:' || r.id);
    v_new := 'booked';
  ELSIF p_action = 'reject' THEN
    IF r.status NOT IN ('tracked','pending','qualifying','approved_awaiting_admin') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition'); END IF;
    UPDATE public.referral_rewards SET status = 'rejected', status_reason = v_reason WHERE id = r.id; v_new := 'rejected';
  ELSIF p_action = 'reinstate' THEN
    IF r.status <> 'rejected' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition'); END IF;
    UPDATE public.referral_rewards SET status = 'tracked', status_reason = v_reason WHERE id = r.id;
    PERFORM set_config('referral.actor_kind', 'system', true);
    PERFORM public.referral_evaluate(r.referral_id);
    PERFORM set_config('referral.actor_kind', 'admin', true);
    v_new := (SELECT status FROM public.referral_rewards WHERE id = r.id);
  ELSIF p_action IN ('reverse','claw_back') THEN
    IF r.status NOT IN ('booked','partly_applied','applied') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_transition'); END IF;
    v_bal := public.referral_credit_balance(r.id);
    IF v_bal > 0 THEN
      INSERT INTO public.referral_credit_movements(reward_id, customer_id, kind, amount_minor, actor_id, reason)
      VALUES (r.id, r.customer_id, CASE WHEN p_action = 'reverse' THEN 'reversed' ELSE 'clawed_back' END, v_bal, v_actor, v_reason);
    END IF;
    -- Decision D: used credit is never charged back unless the terms say so.
    UPDATE public.referral_rewards SET status = CASE WHEN p_action = 'reverse' THEN 'reversed' ELSE 'clawed_back' END,
      status_reason = v_reason, needs_review = false WHERE id = r.id;
    v_new := CASE WHEN p_action = 'reverse' THEN 'reversed' ELSE 'clawed_back' END;
  ELSIF p_action = 'hold' THEN
    UPDATE public.referral_rewards SET manual_hold = true, hold_reason = v_reason WHERE id = r.id;
    UPDATE public.referral_message_outbox SET status = 'suppressed', last_error = 'manual_hold'
      WHERE status = 'pending' AND (reward_id = r.id OR (referral_id = r.referral_id AND reward_id IS NULL));
    v_new := r.status;
  ELSIF p_action = 'release' THEN
    IF NOT r.manual_hold THEN RETURN jsonb_build_object('ok', false, 'error', 'not_on_hold'); END IF;
    UPDATE public.referral_rewards SET manual_hold = false, hold_reason = v_reason WHERE id = r.id;
    v_new := r.status;
  ELSIF p_action = 'clear_review' THEN
    UPDATE public.referral_rewards SET needs_review = false, review_reasons = '{}' WHERE id = r.id;
    v_new := r.status;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_action');
  END IF;

  IF p_notify AND v_new IN ('rejected','reversed','clawed_back') THEN
    INSERT INTO public.referral_message_outbox(customer_id, reward_id, referral_id, template, payload, idempotency_key)
    VALUES (r.customer_id, r.id, r.referral_id, 'reward_withdrawn', jsonb_build_object(
      'reward_ref', r.ref, 'role', r.role, 'amount', r.amount, 'amount_basis', r.amount_basis,
      'reason', v_reason, 'terms_version', r.terms_version, 'recipient_email', v_email),
      'withdrawn:' || r.id || ':' || v_new);
  END IF;

  SELECT jsonb_build_object('ok', true, 'status', status, 'version', version, 'balance_minor', public.referral_credit_balance(id))
    INTO v_result FROM public.referral_rewards WHERE id = r.id;
  INSERT INTO public.referral_reward_events(reward_id, referral_id, actor_id, actor_kind, event_type, reason, terms_version, request_id, details)
  VALUES (r.id, r.referral_id, v_actor, 'admin', 'admin_' || p_action, v_reason, r.terms_version, p_request_id,
    jsonb_build_object('action', p_action, 'notify', p_notify, 'result', v_result));
  RETURN v_result;
END $$;

-- Admin attaches a code to an order placed within the last N days.
CREATE OR REPLACE FUNCTION public.referral_admin_manual_attach(p_request_id uuid, p_order uuid, p_code text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); o public.orders%ROWTYPE; c public.referral_codes%ROWTYPE; v_id uuid; v_days int; v_reason text := btrim(coalesce(p_reason,''));
BEGIN
  IF v_actor IS NULL OR NOT public.referral_is_finance(v_actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF length(v_reason) < 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'reason_required'); END IF;
  IF EXISTS (SELECT 1 FROM public.referral_reward_events WHERE request_id = p_request_id) THEN
    RETURN (SELECT details->'result' FROM public.referral_reward_events WHERE request_id = p_request_id); END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order;
  IF o.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'order_not_found'); END IF;
  SELECT * INTO c FROM public.referral_codes WHERE code = upper(btrim(p_code)) AND customer_id IS NOT NULL;
  IF c.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'code_not_found'); END IF;
  v_days := (SELECT (rules->>'manual_attach_days')::int FROM public.referral_terms_versions t
             JOIN public.referral_settings s ON s.current_terms_version = t.version);
  IF o.created_at < now() - make_interval(days => v_days) THEN RETURN jsonb_build_object('ok', false, 'error', 'outside_manual_window'); END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE friend_order_id = o.id) THEN RETURN jsonb_build_object('ok', false, 'error', 'already_attributed'); END IF;
  v_id := public.referral_create(o.id, c.id, 'admin_manual', NULL, NULL,
    jsonb_build_object('order_created_at', o.created_at, 'attached_at', now(), 'attached_by', v_actor, 'reason', v_reason),
    v_actor, v_reason);
  PERFORM public.referral_evaluate(v_id);
  INSERT INTO public.referral_reward_events(referral_id, actor_id, actor_kind, event_type, reason, request_id, details)
  VALUES (v_id, v_actor, 'admin', 'admin_manual_attach', v_reason, p_request_id,
    jsonb_build_object('order_id', o.id, 'code', c.code, 'result', jsonb_build_object('ok', true, 'referral_id', v_id)));
  RETURN jsonb_build_object('ok', true, 'referral_id', v_id);
END $$;

-- Goodwill credit: separate, reasoned, within a monthly budget.
CREATE OR REPLACE FUNCTION public.referral_admin_goodwill(p_request_id uuid, p_customer uuid, p_amount numeric, p_reason text, p_dispute uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_budget numeric; v_used numeric; v_id uuid; v_reason text := btrim(coalesce(p_reason,'')); v_terms text; v_email text;
BEGIN
  IF v_actor IS NULL OR NOT public.referral_is_finance(v_actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF length(v_reason) < 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'reason_required'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100 THEN RETURN jsonb_build_object('ok', false, 'error', 'amount_out_of_range'); END IF;
  IF EXISTS (SELECT 1 FROM public.referral_reward_events WHERE request_id = p_request_id) THEN
    RETURN (SELECT details->'result' FROM public.referral_reward_events WHERE request_id = p_request_id); END IF;
  SELECT goodwill_monthly_budget, current_terms_version INTO v_budget, v_terms FROM public.referral_settings WHERE singleton;
  SELECT coalesce(sum(amount), 0) INTO v_used FROM public.referral_rewards
   WHERE role = 'goodwill' AND created_at >= date_trunc('month', now()) AND status NOT IN ('rejected');
  IF v_used + p_amount > v_budget THEN RETURN jsonb_build_object('ok', false, 'error', 'monthly_goodwill_budget_exceeded', 'used', v_used, 'budget', v_budget); END IF;
  PERFORM set_config('referral.actor', v_actor::text, true);
  PERFORM set_config('referral.actor_kind', 'admin', true);
  INSERT INTO public.referral_rewards(customer_id, role, amount, amount_basis, credit_gross_minor, terms_version, status, status_reason,
    approved_at, approved_by, booked_at, expires_at, dispute_id)
  VALUES (p_customer, 'goodwill', p_amount, 'gross', round(p_amount * 100)::int, v_terms, 'booked', v_reason,
    now(), v_actor, now(), now() + interval '12 months', p_dispute) RETURNING id INTO v_id;
  INSERT INTO public.referral_credit_movements(reward_id, customer_id, kind, amount_minor, actor_id, reason)
  VALUES (v_id, p_customer, 'booked', round(p_amount * 100)::int, v_actor, v_reason);
  SELECT email INTO v_email FROM public.profiles WHERE id = p_customer;
  INSERT INTO public.referral_message_outbox(customer_id, reward_id, template, payload, idempotency_key)
  SELECT p_customer, v_id, 'reward_credited', jsonb_build_object('reward_ref', ref, 'role', 'goodwill', 'amount', p_amount,
    'amount_basis', 'gross', 'expires_at', expires_at, 'terms_version', v_terms, 'recipient_email', v_email), 'credited:' || v_id
  FROM public.referral_rewards WHERE id = v_id;
  INSERT INTO public.referral_reward_events(reward_id, actor_id, actor_kind, event_type, reason, request_id, details)
  VALUES (v_id, v_actor, 'admin', 'admin_goodwill', v_reason, p_request_id,
    jsonb_build_object('amount', p_amount, 'dispute_id', p_dispute, 'result', jsonb_build_object('ok', true, 'reward_id', v_id)));
  RETURN jsonb_build_object('ok', true, 'reward_id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.referral_admin_dispute(p_action text, p_dispute uuid, p_customer uuid, p_referral uuid,
  p_kind text, p_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_id uuid; d public.referral_disputes%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.referral_is_staff(v_actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF length(btrim(coalesce(p_text,''))) < 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'reason_required'); END IF;
  IF p_action = 'open' THEN
    INSERT INTO public.referral_disputes(customer_id, referral_id, kind, details, opened_by)
    VALUES (p_customer, p_referral, p_kind, btrim(p_text), v_actor) RETURNING id INTO v_id;
    INSERT INTO public.referral_reward_events(referral_id, actor_id, actor_kind, event_type, reason, details)
    VALUES (p_referral, v_actor, 'admin', 'dispute_opened', btrim(p_text), jsonb_build_object('dispute_id', v_id, 'kind', p_kind));
    RETURN jsonb_build_object('ok', true, 'dispute_id', v_id);
  ELSIF p_action IN ('upheld','rejected','goodwill') THEN
    IF NOT public.referral_is_finance(v_actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
    SELECT * INTO d FROM public.referral_disputes WHERE id = p_dispute FOR UPDATE;
    IF d.id IS NULL OR d.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'error', 'dispute_not_open'); END IF;
    UPDATE public.referral_disputes SET status = p_action, outcome_reason = btrim(p_text), resolved_by = v_actor, resolved_at = now() WHERE id = d.id;
    INSERT INTO public.referral_reward_events(referral_id, actor_id, actor_kind, event_type, reason, details)
    VALUES (d.referral_id, v_actor, 'admin', 'dispute_' || p_action, btrim(p_text), jsonb_build_object('dispute_id', d.id));
    RETURN jsonb_build_object('ok', true);
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'unknown_action');
END $$;

CREATE OR REPLACE FUNCTION public.referral_admin_record_standing(p_customer uuid, p_kind text, p_occurred_at timestamptz, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.referral_is_finance(v_actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF p_kind NOT IN ('payment_arrangement','bank_recall','dd_returned','manual_arrears','leaving_request','suspended') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_kind'); END IF;
  IF length(btrim(coalesce(p_note,''))) < 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'reason_required'); END IF;
  INSERT INTO public.customer_standing_events(customer_id, kind, occurred_at, source, details, recorded_by)
  VALUES (p_customer, p_kind, coalesce(p_occurred_at, now()), 'admin', jsonb_build_object('note', btrim(p_note)), v_actor);
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------------------------
-- Expiry, expiry warnings and nightly reconciliation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_expire_credits() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_bal int; n_exp int := 0; n_warn int := 0;
BEGIN
  FOR r IN SELECT w.* FROM public.referral_rewards w WHERE w.status IN ('booked','partly_applied') AND w.expires_at <= now() FOR UPDATE LOOP
    v_bal := public.referral_credit_balance(r.id);
    PERFORM set_config('referral.actor_kind', 'ledger', true);
    IF v_bal > 0 THEN
      INSERT INTO public.referral_credit_movements(reward_id, customer_id, kind, amount_minor, reason)
      VALUES (r.id, r.customer_id, 'expired', v_bal, 'unused after 12 months');
    END IF;
    UPDATE public.referral_rewards SET status = 'expired', status_reason = 'credit_expired_unused' WHERE id = r.id;
    n_exp := n_exp + 1;
  END LOOP;
  PERFORM set_config('referral.actor_kind', 'system', true);
  INSERT INTO public.referral_message_outbox(customer_id, reward_id, referral_id, template, payload, idempotency_key)
  SELECT w.customer_id, w.id, w.referral_id, 'credit_expiring', jsonb_build_object('reward_ref', w.ref, 'role', w.role,
      'balance_minor', public.referral_credit_balance(w.id), 'expires_at', w.expires_at,
      'recipient_email', (SELECT email FROM public.profiles WHERE id = w.customer_id)), 'expiring:' || w.id
  FROM public.referral_rewards w
  WHERE w.status IN ('booked','partly_applied') AND NOT w.manual_hold
    AND w.expires_at <= now() + interval '30 days' AND public.referral_credit_balance(w.id) > 0
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS n_warn = ROW_COUNT;
  RETURN jsonb_build_object('expired', n_exp, 'warned', n_warn);
END $$;

CREATE OR REPLACE FUNCTION public.referral_reconcile(p_kind text DEFAULT 'nightly') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb := '[]'; n int;
BEGIN
  -- 1. Balance identity and status consistency per reward.
  v := v || coalesce((SELECT jsonb_agg(jsonb_build_object('check', 'balance', 'reward', w.ref, 'status', w.status,
           'balance_minor', public.referral_credit_balance(w.id), 'credit_minor', w.credit_gross_minor))
    FROM public.referral_rewards w
    WHERE (w.status IN ('booked','partly_applied','applied','expired','reversed','clawed_back')
           AND NOT EXISTS (SELECT 1 FROM public.referral_credit_movements m WHERE m.reward_id = w.id AND m.kind = 'booked'))
       OR public.referral_credit_balance(w.id) < 0
       OR public.referral_credit_balance(w.id) > w.credit_gross_minor
       OR (w.status = 'applied' AND public.referral_credit_balance(w.id) <> 0)
       OR (w.status IN ('expired','reversed','clawed_back') AND public.referral_credit_balance(w.id) <> 0)
       OR (w.status IN ('tracked','pending','qualifying','approved_awaiting_admin','rejected')
           AND EXISTS (SELECT 1 FROM public.referral_credit_movements m WHERE m.reward_id = w.id))), '[]');
  -- 2. Every applied movement ties to a matching invoice line.
  v := v || coalesce((SELECT jsonb_agg(jsonb_build_object('check', 'invoice_line', 'movement', m.id, 'invoice', i.invoice_number,
           'line_minor', round(l.line_total * 100), 'movement_minor', m.amount_minor))
    FROM public.referral_credit_movements m
    LEFT JOIN public.invoice_lines l ON l.id = m.invoice_line_id
    LEFT JOIN public.invoices i ON i.id = m.invoice_id
    WHERE m.kind = 'applied' AND (l.id IS NULL OR round(l.line_total * 100) <> -m.amount_minor OR l.invoice_id <> m.invoice_id)), '[]');
  -- 3. Every referral credit line has a ledger movement.
  v := v || coalesce((SELECT jsonb_agg(jsonb_build_object('check', 'orphan_line', 'line', l.id, 'invoice_id', l.invoice_id))
    FROM public.invoice_lines l WHERE l.metadata->>'kind' = 'referral_credit'
      AND NOT EXISTS (SELECT 1 FROM public.referral_credit_movements m WHERE m.invoice_line_id = l.id AND m.kind = 'applied')), '[]');
  -- 4. Credit used on an invoice that is past due and unpaid.
  v := v || coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('check', 'credit_on_unpaid_invoice', 'invoice', i.invoice_number, 'due', i.due_date))
    FROM public.referral_credit_movements m JOIN public.invoices i ON i.id = m.invoice_id
    WHERE m.kind = 'applied' AND i.total > 0 AND i.status::text NOT IN ('paid','cancelled','void','voided') AND i.due_date < current_date), '[]');
  -- 5. Invoice header equals its lines.
  v := v || coalesce((SELECT jsonb_agg(jsonb_build_object('check', 'invoice_total', 'invoice', i.invoice_number,
           'total', i.total, 'lines', s.lines))
    FROM public.invoices i JOIN LATERAL (SELECT sum(l.line_total) AS lines FROM public.invoice_lines l WHERE l.invoice_id = i.id) s ON true
    WHERE EXISTS (SELECT 1 FROM public.referral_credit_movements m WHERE m.invoice_id = i.id)
      AND round(i.total * 100) <> round(s.lines * 100)), '[]');
  n := jsonb_array_length(v);
  INSERT INTO public.referral_recon_runs(kind, issues, findings) VALUES (p_kind, n, v);
  RETURN jsonb_build_object('issues', n, 'findings', v);
END $$;

CREATE OR REPLACE FUNCTION public.referral_nightly() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.referral_enabled() AND NOT EXISTS (SELECT 1 FROM public.referral_rewards) THEN RETURN '{"skipped":true}'; END IF;
  v := public.referral_expire_credits();
  RETURN v || jsonb_build_object('reconcile', public.referral_reconcile('nightly'));
END $$;

-- Monthly figures for finance (CSV and admin screen use the same rows).
CREATE OR REPLACE FUNCTION public.referral_monthly_report(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_from timestamptz := date_trunc('month', p_month)::timestamptz; v_to timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamptz;
  v jsonb; v_acq int; v_cost int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.referral_is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_object_agg(kind, total) INTO v FROM (
    SELECT k.kind, coalesce((SELECT sum(amount_minor) FROM public.referral_credit_movements m
      WHERE m.kind = k.kind AND m.created_at >= v_from AND m.created_at < v_to), 0) AS total
    FROM unnest(ARRAY['booked','applied','unapplied','expired','reversed','clawed_back']) k(kind)) x;
  SELECT count(DISTINCT w.referral_id), coalesce(sum(m.amount_minor), 0) INTO v_acq, v_cost
  FROM public.referral_credit_movements m JOIN public.referral_rewards w ON w.id = m.reward_id
  WHERE m.kind = 'booked' AND w.role IN ('referrer','friend') AND m.created_at >= v_from AND m.created_at < v_to;
  RETURN jsonb_build_object(
    'month', to_char(v_from, 'YYYY-MM'),
    'minor', v,
    'liability_minor_at_month_end', (SELECT coalesce(sum(CASE kind WHEN 'booked' THEN amount_minor WHEN 'unapplied' THEN amount_minor ELSE -amount_minor END), 0)
       FROM public.referral_credit_movements WHERE created_at < v_to),
    'customers_acquired', v_acq,
    'cost_per_acquired_customer_minor', CASE WHEN v_acq > 0 THEN round(v_cost::numeric / v_acq) END,
    'goodwill_booked_minor', (SELECT coalesce(sum(m.amount_minor), 0) FROM public.referral_credit_movements m
       JOIN public.referral_rewards w ON w.id = m.reward_id WHERE w.role = 'goodwill' AND m.kind = 'booked'
       AND m.created_at >= v_from AND m.created_at < v_to),
    'awaiting_review_now', (SELECT count(*) FROM public.referral_rewards WHERE status = 'approved_awaiting_admin' OR needs_review OR manual_hold),
    'open_disputes_now', (SELECT count(*) FROM public.referral_disputes WHERE status = 'open'));
END $$;

-- What would happen today, without changing anything. For go-live checks.
CREATE OR REPLACE FUNCTION public.referral_dry_run() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.referral_is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'rewards_enabled', public.referral_enabled(),
    'terms_version', (SELECT current_terms_version FROM public.referral_settings WHERE singleton),
    'codes', (SELECT count(*) FROM public.referral_codes WHERE customer_id IS NOT NULL),
    'referrals', (SELECT count(*) FROM public.referrals),
    'rewards_by_status', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM public.referral_rewards GROUP BY status) x),
    'customers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'account', p.account_number, 'type', public.referral_customer_type(p.id),
        'live', public.referral_customer_live(p.id),
        'payment_issue_last_12m', public.referral_payment_history_issue(p.id, now() - interval '12 months', now(), 0),
        'could_get_code_today', public.referral_customer_live(p.id)
           AND public.referral_payment_history_issue(p.id, now() - interval '90 days', now(), 0) IS NULL,
        'would_reward_today', 0) ORDER BY p.account_number), '[]')
      FROM public.profiles p WHERE EXISTS (SELECT 1 FROM public.services s WHERE s.user_id = p.id)));
END $$;

-- ---------------------------------------------------------------------------
-- Customer-facing RPCs
-- ---------------------------------------------------------------------------
-- Get (or create) my code. Only live customers with a clean recent record.
CREATE OR REPLACE FUNCTION public.referral_my_code() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); c public.referral_codes%ROWTYPE; v_code text; v_terms public.referral_terms_versions%ROWTYPE;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; v_issue text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required'); END IF;
  SELECT t.* INTO v_terms FROM public.referral_terms_versions t JOIN public.referral_settings s ON s.current_terms_version = t.version;
  SELECT * INTO c FROM public.referral_codes WHERE customer_id = v_uid AND status = 'active' ORDER BY created_at LIMIT 1;
  IF c.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'code', c.code, 'terms_version', coalesce(c.terms_version, v_terms.version),
      'summary', v_terms.summary, 'terms_url', v_terms.terms_url);
  END IF;
  IF NOT public.referral_enabled() THEN RETURN jsonb_build_object('ok', false, 'error', 'scheme_not_open'); END IF;
  IF NOT public.referral_customer_live(v_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'needs_live_service'); END IF;
  v_issue := public.referral_payment_history_issue(v_uid, now() - interval '90 days', now(), 0);
  IF v_issue IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'account_not_up_to_date'); END IF;
  FOR attempt IN 1..8 LOOP
    v_code := '';
    FOR i IN 1..8 LOOP v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1); END LOOP;
    BEGIN
      INSERT INTO public.referral_codes(customer_id, code, status, terms_version, terms_shown_at, customer_type)
      VALUES (v_uid, v_code, 'active', v_terms.version, now(), public.referral_customer_type(v_uid)) RETURNING * INTO c;
      EXIT;
    EXCEPTION WHEN unique_violation THEN c.id := NULL;
    END;
  END LOOP;
  IF c.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'code_generation_failed'); END IF;
  PERFORM set_config('referral.actor_kind', 'customer', true);
  INSERT INTO public.referral_message_outbox(customer_id, template, payload, idempotency_key)
  VALUES (v_uid, 'your_code', jsonb_build_object('code', c.code, 'summary', v_terms.summary, 'terms_url', v_terms.terms_url,
    'terms_version', v_terms.version, 'recipient_email', (SELECT email FROM public.profiles WHERE id = v_uid)), 'code:' || c.id);
  RETURN jsonb_build_object('ok', true, 'code', c.code, 'terms_version', v_terms.version, 'summary', v_terms.summary, 'terms_url', v_terms.terms_url);
END $$;

-- Everything the dashboard tab shows, in plain English.
CREATE OR REPLACE FUNCTION public.referral_my_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN jsonb_build_object('ok', true,
    'enabled', public.referral_enabled(),
    'code', (SELECT code FROM public.referral_codes WHERE customer_id = v_uid AND status = 'active' ORDER BY created_at LIMIT 1),
    'terms', (SELECT jsonb_build_object('version', t.version, 'summary', t.summary, 'url', t.terms_url, 'rules', t.rules)
              FROM public.referral_terms_versions t JOIN public.referral_settings s ON s.current_terms_version = t.version),
    'balance_minor', (SELECT coalesce(sum(public.referral_credit_balance(id)), 0) FROM public.referral_rewards
                      WHERE customer_id = v_uid AND status IN ('booked','partly_applied')),
    'rewards', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'ref', w.ref, 'role', w.role, 'status', w.status, 'amount', w.amount, 'amount_basis', w.amount_basis,
        'on_hold', w.manual_hold, 'live_at', w.live_at, 'booked_at', w.booked_at, 'expires_at', w.expires_at,
        'qualifies_from', CASE WHEN w.live_at IS NOT NULL THEN w.live_at + make_interval(days => (f.rules->>'qualify_days')::int) END,
        'balance_minor', public.referral_credit_balance(w.id), 'terms_version', w.terms_version,
        -- Machine reason codes only; an admin's free-text note never leaks here.
        'reason', CASE WHEN w.status IN ('rejected','reversed','clawed_back') AND coalesce(w.status_reason,'') ~ '^[a-z_]+(:|$)'
                       THEN split_part(w.status_reason, ':', 1) END,
        'created_at', w.created_at) ORDER BY w.created_at DESC), '[]')
      FROM public.referral_rewards w LEFT JOIN public.referrals f ON f.id = w.referral_id WHERE w.customer_id = v_uid),
    'history', (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', m.kind, 'amount_minor', m.amount_minor,
        'reward_ref', w.ref, 'invoice_number', i.invoice_number, 'at', m.created_at) ORDER BY m.id DESC), '[]')
      FROM public.referral_credit_movements m JOIN public.referral_rewards w ON w.id = m.reward_id
      LEFT JOIN public.invoices i ON i.id = m.invoice_id WHERE m.customer_id = v_uid));
END $$;

-- Public: record a link click (evidence only; grants nothing).
CREATE OR REPLACE FUNCTION public.referral_record_click(p_code text, p_landing_url text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.referral_codes%ROWTYPE; v_headers jsonb; v_ip text; v_ua text; v_hash text; v_id uuid;
BEGIN
  SELECT * INTO c FROM public.referral_codes WHERE code = upper(btrim(coalesce(p_code,''))) AND customer_id IS NOT NULL AND status = 'active';
  IF c.id IS NULL OR (c.expires_at IS NOT NULL AND c.expires_at < now()) THEN RETURN NULL; END IF;
  BEGIN v_headers := nullif(current_setting('request.headers', true), '')::jsonb; EXCEPTION WHEN OTHERS THEN v_headers := NULL; END;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-real-ip', v_headers->>'x-forwarded-for');
  v_ua := left(v_headers->>'user-agent', 500);
  v_hash := public.referral_ip_hash(v_ip);
  IF (SELECT count(*) FROM public.referral_clicks WHERE referral_code_id = c.id AND ip_hash IS NOT DISTINCT FROM v_hash
        AND created_at > now() - interval '1 hour') >= 20 THEN RETURN NULL; END IF;
  INSERT INTO public.referral_clicks(referral_code_id, code, landing_url, user_agent, ip_hash)
  VALUES (c.id, c.code, left(p_landing_url, 500), v_ua, v_hash) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Public: is this a referral code, and what does the friend get? No referrer details.
CREATE OR REPLACE FUNCTION public.referral_check_code(p_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN c.id IS NULL OR NOT public.referral_enabled() THEN jsonb_build_object('referral', false)
    ELSE jsonb_build_object('referral', true, 'code', c.code, 'terms_version', t.version, 'terms_url', t.terms_url,
      'friend_reward', t.rules->'rewards', 'qualify_days', t.rules->'qualify_days', 'invoices_required', t.rules->'invoices_required',
      'stacking_allowed', t.rules->'allow_promotion_stacking') END
  FROM (SELECT 1) one
  LEFT JOIN public.referral_codes c ON c.code = upper(btrim(coalesce(p_code,''))) AND c.customer_id IS NOT NULL AND c.status = 'active'
       AND (c.expires_at IS NULL OR c.expires_at > now())
  LEFT JOIN public.referral_settings s ON s.singleton
  LEFT JOIN public.referral_terms_versions t ON t.version = s.current_terms_version;
$$;

CREATE OR REPLACE FUNCTION public.referral_public_terms() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('current', s.current_terms_version, 'enabled', public.referral_enabled(),
    'versions', (SELECT jsonb_agg(jsonb_build_object('version', version, 'effective_from', effective_from, 'summary', summary, 'rules', rules)
       ORDER BY effective_from DESC) FROM public.referral_terms_versions))
  FROM public.referral_settings s WHERE s.singleton;
$$;

-- ---------------------------------------------------------------------------
-- Admin read RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_admin_list(p_filter text DEFAULT 'all') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.referral_is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(row ORDER BY (row->>'created_at') DESC), '[]') FROM (
    SELECT jsonb_build_object('referral_id', f.id, 'ref', f.ref, 'created_at', f.created_at, 'method', f.attribution_method,
      'has_click', f.click_id IS NOT NULL, 'terms_version', f.terms_version, 'friend_type', f.friend_type,
      'referrer', jsonb_build_object('id', f.referrer_id, 'account', rp.account_number, 'name', rp.full_name),
      'friend', jsonb_build_object('id', f.friend_customer_id, 'account', fp.account_number, 'name', fp.full_name),
      'order_number', o.occta_order_number,
      'rewards', (SELECT jsonb_agg(jsonb_build_object('id', w.id, 'ref', w.ref, 'role', w.role, 'status', w.status,
          'reason', w.status_reason, 'amount', w.amount, 'basis', w.amount_basis, 'hold', w.manual_hold,
          'needs_review', w.needs_review, 'review_reasons', w.review_reasons, 'version', w.version,
          'balance_minor', public.referral_credit_balance(w.id)) ORDER BY w.role DESC)
        FROM public.referral_rewards w WHERE w.referral_id = f.id)) AS row
    FROM public.referrals f
    LEFT JOIN public.profiles rp ON rp.id = f.referrer_id
    LEFT JOIN public.profiles fp ON fp.id = f.friend_customer_id
    LEFT JOIN public.orders o ON o.id = f.friend_order_id
    WHERE p_filter = 'all' OR EXISTS (SELECT 1 FROM public.referral_rewards w WHERE w.referral_id = f.id AND (
      (p_filter = 'review' AND (w.status = 'approved_awaiting_admin' OR w.needs_review OR w.manual_hold)) OR
      (p_filter = 'active' AND w.status IN ('tracked','pending','qualifying')) OR
      (p_filter = 'credit' AND w.status IN ('booked','partly_applied','applied')) OR
      (p_filter = 'closed' AND w.status IN ('rejected','reversed','clawed_back','expired'))))
    UNION ALL
    SELECT jsonb_build_object('referral_id', NULL, 'ref', w.ref, 'created_at', w.created_at, 'method', 'goodwill',
      'referrer', jsonb_build_object('id', w.customer_id, 'account', p.account_number, 'name', p.full_name),
      'rewards', jsonb_build_array(jsonb_build_object('id', w.id, 'ref', w.ref, 'role', w.role, 'status', w.status,
          'reason', w.status_reason, 'amount', w.amount, 'basis', w.amount_basis, 'hold', w.manual_hold,
          'needs_review', w.needs_review, 'review_reasons', w.review_reasons, 'version', w.version,
          'balance_minor', public.referral_credit_balance(w.id))))
    FROM public.referral_rewards w LEFT JOIN public.profiles p ON p.id = w.customer_id
    WHERE w.role = 'goodwill' AND p_filter IN ('all','credit')) q);
END $$;

CREATE OR REPLACE FUNCTION public.referral_admin_detail(p_referral uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.referrals%ROWTYPE;
BEGIN
  IF NOT public.referral_is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO f FROM public.referrals WHERE id = p_referral;
  IF f.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'referral', to_jsonb(f),
    'code', (SELECT jsonb_build_object('code', code, 'terms_version', terms_version, 'terms_shown_at', terms_shown_at) FROM public.referral_codes WHERE id = f.referral_code_id),
    'click', (SELECT to_jsonb(k) FROM public.referral_clicks k WHERE k.id = f.click_id),
    'terms', (SELECT jsonb_build_object('version', version, 'summary', summary, 'effective_from', effective_from) FROM public.referral_terms_versions WHERE version = f.terms_version),
    'order', (SELECT jsonb_build_object('id', o.id, 'number', o.occta_order_number, 'created_at', o.created_at,
        'lifecycle', o.lifecycle_status, 'live_at', o.actual_service_live_at_utc, 'campaign', o.campaign_code,
        'postcode', o.postcode) FROM public.orders o WHERE o.id = f.friend_order_id),
    'friend_invoices', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.referral_first_invoices(f.friend_customer_id, f.friend_order_id,
        (f.rules->>'invoices_required')::int, coalesce((f.rules->>'payment_grace_days')::int, 0)) x),
    'checks', jsonb_build_object(
      'self_referral', public.referral_self_referral(f.referrer_id, f.friend_order_id, f.friend_customer_id),
      'prior_footprint', CASE WHEN f.friend_customer_id IS NOT NULL THEN public.referral_friend_prior_footprint(f.friend_order_id, f.friend_customer_id, (f.rules->>'new_customer_lookback_months')::int) END,
      'friend_leaving', public.referral_friend_leaving(f.friend_order_id, f.friend_customer_id),
      'friend_payment_history', CASE WHEN f.friend_customer_id IS NOT NULL THEN public.referral_payment_history_issue(f.friend_customer_id, f.order_created_at, now(), 0) END,
      'referrer_payment_history', public.referral_payment_history_issue(f.referrer_id, f.order_created_at, now(), 0),
      'referrer_live', public.referral_customer_live(f.referrer_id),
      'review_signals', to_jsonb(public.referral_review_signals(f.id))),
    'rewards', (SELECT jsonb_agg(to_jsonb(w) || jsonb_build_object('balance_minor', public.referral_credit_balance(w.id)) ORDER BY w.role DESC)
                FROM public.referral_rewards w WHERE w.referral_id = f.id),
    'timeline', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id), '[]') FROM public.referral_reward_events e WHERE e.referral_id = f.id),
    'ledger', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id), '[]') FROM public.referral_credit_movements m
               JOIN public.referral_rewards w ON w.id = m.reward_id WHERE w.referral_id = f.id),
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('template', template, 'status', status, 'sent_at', sent_at, 'created_at', created_at, 'last_error', last_error) ORDER BY created_at), '[]')
                 FROM public.referral_message_outbox WHERE referral_id = f.id),
    'disputes', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.created_at), '[]') FROM public.referral_disputes d WHERE d.referral_id = f.id));
END $$;

CREATE OR REPLACE FUNCTION public.referral_admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.referral_is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'enabled', public.referral_enabled(),
    'settings', (SELECT jsonb_build_object('terms_version', current_terms_version, 'goodwill_monthly_budget', goodwill_monthly_budget) FROM public.referral_settings WHERE singleton),
    'counts', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM public.referral_rewards GROUP BY status) x),
    'awaiting_admin', (SELECT count(*) FROM public.referral_rewards WHERE status = 'approved_awaiting_admin'),
    'needs_review', (SELECT count(*) FROM public.referral_rewards WHERE needs_review OR manual_hold),
    'liability_minor', (SELECT coalesce(sum(CASE kind WHEN 'booked' THEN amount_minor WHEN 'unapplied' THEN amount_minor ELSE -amount_minor END), 0) FROM public.referral_credit_movements),
    'goodwill_used_this_month', (SELECT coalesce(sum(amount), 0) FROM public.referral_rewards WHERE role = 'goodwill' AND created_at >= date_trunc('month', now())),
    'open_disputes', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.created_at), '[]') FROM public.referral_disputes d WHERE d.status = 'open'),
    'last_recon', (SELECT to_jsonb(r) FROM public.referral_recon_runs r ORDER BY id DESC LIMIT 1),
    'binding_errors', (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id DESC), '[]') FROM (SELECT * FROM public.referral_binding_errors ORDER BY id DESC LIMIT 20) b),
    'outbox', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM public.referral_message_outbox GROUP BY status) y));
END $$;

-- ---------------------------------------------------------------------------
-- Outbox workers (lease pattern copied from SWITCH50)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.referral_claim_messages(p_limit integer DEFAULT 10)
RETURNS SETOF public.referral_message_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Re-check holds at send time: a hold placed after queueing still wins.
  UPDATE public.referral_message_outbox m SET status = 'suppressed', last_error = 'manual_hold'
   WHERE m.status IN ('pending','processing') AND (
     EXISTS (SELECT 1 FROM public.referral_rewards w WHERE w.id = m.reward_id AND w.manual_hold)
     OR EXISTS (SELECT 1 FROM public.referral_rewards w WHERE m.referral_id IS NOT NULL AND w.referral_id = m.referral_id AND w.manual_hold));
  UPDATE public.referral_message_outbox SET status = 'failed', last_error = 'delivery_window_exceeded'
   WHERE status IN ('pending','processing') AND (first_attempt_at < now() - interval '23 hours' OR (attempts >= 6 AND locked_until < now()));
  RETURN QUERY WITH due AS (
    SELECT m.id FROM public.referral_message_outbox m
    WHERE (m.status = 'pending' OR (m.status = 'processing' AND m.locked_until < now()))
      AND m.next_attempt_at <= now() AND m.attempts < 6
    ORDER BY m.created_at LIMIT least(greatest(p_limit, 1), 50) FOR UPDATE SKIP LOCKED
  ) UPDATE public.referral_message_outbox m SET status = 'processing', attempts = m.attempts + 1,
      lease_token = gen_random_uuid(), locked_until = now() + interval '5 minutes', first_attempt_at = coalesce(m.first_attempt_at, now())
    FROM due WHERE m.id = due.id RETURNING m.*;
END $$;

CREATE OR REPLACE FUNCTION public.referral_message_still_relevant(p_message uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE m.template
    WHEN 'reward_credited' THEN w.status IN ('booked','partly_applied','applied') AND NOT w.manual_hold
    WHEN 'credit_expiring' THEN w.status IN ('booked','partly_applied') AND NOT w.manual_hold
    WHEN 'reward_withdrawn' THEN w.status IN ('rejected','reversed','clawed_back')
    WHEN 'friend_joined' THEN NOT EXISTS (SELECT 1 FROM public.referral_rewards x WHERE x.referral_id = m.referral_id AND x.manual_hold)
    ELSE true END
  FROM public.referral_message_outbox m LEFT JOIN public.referral_rewards w ON w.id = m.reward_id WHERE m.id = p_message;
$$;

CREATE OR REPLACE FUNCTION public.referral_finish_message(p_id uuid, p_lease uuid, p_provider_id text DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.referral_message_outbox%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.referral_message_outbox WHERE id = p_id AND lease_token = p_lease AND status = 'processing' FOR UPDATE;
  IF m.id IS NULL THEN RETURN false; END IF;
  UPDATE public.referral_message_outbox SET
    status = CASE WHEN p_error = 'superseded' THEN 'suppressed' WHEN p_provider_id IS NOT NULL THEN 'sent' WHEN attempts >= 6 THEN 'failed' ELSE 'pending' END,
    provider_message_id = p_provider_id, last_error = left(p_error, 200), locked_until = NULL,
    sent_at = CASE WHEN p_provider_id IS NOT NULL THEN now() END,
    next_attempt_at = now() + make_interval(mins => least(60, attempts * attempts)) WHERE id = p_id;
  INSERT INTO public.referral_reward_events(reward_id, referral_id, event_type, details)
  VALUES (m.reward_id, m.referral_id, CASE WHEN p_error = 'superseded' THEN 'message_suppressed'
      WHEN p_provider_id IS NOT NULL THEN 'message_sent' ELSE 'message_attempt_failed' END,
    jsonb_build_object('message_id', m.id, 'template', m.template, 'attempt', m.attempts, 'provider_id', p_provider_id, 'error', p_error));
  RETURN true;
END $$;

-- Missing worker config makes this a no-op; the outbox stays durable.
CREATE OR REPLACE FUNCTION public.referral_dispatch_messages() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
DECLARE v_url text; v_secret text;
BEGIN
  IF NOT public.referral_enabled() THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.referral_message_outbox WHERE status IN ('pending','processing')) THEN RETURN false; END IF;
  BEGIN
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''referral_worker_url'' LIMIT 1' INTO v_url;
    EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''referral_worker_secret'' LIMIT 1' INTO v_secret;
  EXCEPTION WHEN OTHERS THEN RETURN false;
  END;
  IF v_url IS NULL OR v_secret IS NULL OR length(v_secret) < 32 THEN RETURN false; END IF;
  IF v_url !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/referral-message-worker$' THEN RAISE EXCEPTION 'invalid_referral_worker_url'; END IF;
  EXECUTE 'SELECT net.http_post(url => $1, headers => $2, body => ''{}''::jsonb, timeout_milliseconds => 1000)'
    USING v_url, jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret);
  RETURN true;
END $body$;

-- ---------------------------------------------------------------------------
-- Schedules (each is a no-op while rewards_enabled is false)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  PERFORM cron.unschedule('referral-evaluate') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'referral-evaluate');
  PERFORM cron.unschedule('referral-nightly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'referral-nightly');
  PERFORM cron.unschedule('referral-messages') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'referral-messages');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('referral-evaluate', '25 * * * *', 'SELECT public.referral_evaluate_all()');
SELECT cron.schedule('referral-nightly', '40 2 * * *', 'SELECT public.referral_nightly()');
SELECT cron.schedule('referral-messages', '*/5 * * * *', 'SELECT public.referral_dispatch_messages()');

-- ---------------------------------------------------------------------------
-- Grants: tables are reached only through the functions above.
-- ---------------------------------------------------------------------------
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['referral_terms_versions','referral_settings','referral_clicks','referrals','referral_rewards',
    'referral_reward_events','referral_credit_movements','referral_message_outbox','customer_standing_events',
    'referral_disputes','referral_recon_runs','referral_binding_errors'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
  END LOOP;
END $$;
-- Finance tables change only through the functions (SECURITY DEFINER).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.referral_rewards, public.referral_credit_movements,
  public.referral_reward_events, public.referrals, public.referral_message_outbox FROM service_role;
GRANT SELECT ON public.referral_terms_versions TO anon, authenticated;
DROP POLICY IF EXISTS referral_terms_public_read ON public.referral_terms_versions;
CREATE POLICY referral_terms_public_read ON public.referral_terms_versions FOR SELECT TO anon, authenticated USING (true);

DO $$ DECLARE fn text; BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'referral_terms_immutable()','referral_code_guard()','referral_append_only()','referral_row_guard()','referral_reward_guard()',
    'referral_reward_audit()','referral_outbox_guard()','referral_order_changed()','referral_standing_event_added()',
    'referral_capture_standing()','referral_invoice_cancelled()',
    'referral_evaluate(uuid)','referral_evaluate_all()','referral_create(uuid,uuid,text,uuid,uuid,jsonb,uuid,text)',
    'referral_ensure_friend_reward(uuid)','referral_bind_order(uuid)','referral_hold_for_friend(uuid,text)',
    'referral_refresh_ledger_status(uuid)','referral_apply_credit_to_invoice(uuid,boolean)','referral_expire_credits()',
    'referral_reconcile(text)','referral_nightly()','referral_claim_messages(integer)',
    'referral_message_still_relevant(uuid)','referral_finish_message(uuid,uuid,text,text)','referral_dispatch_messages()',
    'referral_payment_history_issue(uuid,timestamptz,timestamptz,integer)','referral_first_invoices(uuid,uuid,integer,integer)',
    'referral_friend_leaving(uuid,uuid)','referral_friend_prior_footprint(uuid,uuid,integer)','referral_self_referral(uuid,uuid,uuid)',
    'referral_review_signals(uuid)','referral_ip_hash(text)','referral_customer_live(uuid)','referral_customer_type(uuid)',
    'referral_credit_balance(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
  -- Signed-in RPCs check roles themselves.
  FOREACH fn IN ARRAY ARRAY[
    'referral_admin_action(uuid,text,uuid,integer,text,boolean)','referral_admin_manual_attach(uuid,uuid,text,text)',
    'referral_admin_goodwill(uuid,uuid,numeric,text,uuid)','referral_admin_dispute(text,uuid,uuid,uuid,text,text)',
    'referral_admin_record_standing(uuid,text,timestamptz,text)','referral_monthly_report(date)','referral_dry_run()',
    'referral_admin_list(text)','referral_admin_detail(uuid)','referral_admin_overview()',
    'referral_my_code()','referral_my_overview()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['referral_record_click(text,text)','referral_check_code(text)','referral_public_terms()',
    'referral_enabled()','referral_is_finance(uuid)','referral_is_staff(uuid)','referral_addr_key(text,text,text)','referral_norm_phone(text)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
  END LOOP;
END $$;

COMMIT;
