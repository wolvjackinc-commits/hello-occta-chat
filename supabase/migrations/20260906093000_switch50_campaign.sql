-- ============================================================
-- SWITCH50 acquisition campaign
-- Production-safe campaign configuration, attribution, reward
-- lifecycle, customer visibility and finance payout queue.
-- ============================================================

-- 1) Authoritative offer configuration / kill switch.
CREATE TABLE IF NOT EXISTS public.offer_campaigns (
  code text PRIMARY KEY,
  title text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  customer_type text NOT NULL DEFAULT 'residential',
  speed_bucket text NOT NULL,
  plan_term text NOT NULL,
  reward_type text NOT NULL DEFAULT 'cashback',
  reward_amount numeric(12,2) NOT NULL CHECK (reward_amount >= 0),
  reward_currency text NOT NULL DEFAULT 'GBP',
  payout_delay_days integer NOT NULL DEFAULT 30 CHECK (payout_delay_days BETWEEN 0 AND 365),
  require_first_paid_invoice boolean NOT NULL DEFAULT true,
  one_per_address boolean NOT NULL DEFAULT true,
  landing_path text NOT NULL DEFAULT '/broadband',
  terms_version text NOT NULL,
  terms_text text NOT NULL,
  internal_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

GRANT SELECT ON public.offer_campaigns TO authenticated;
GRANT ALL ON public.offer_campaigns TO service_role;
ALTER TABLE public.offer_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offer_campaigns_staff_select ON public.offer_campaigns;
CREATE POLICY offer_campaigns_staff_select ON public.offer_campaigns
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

INSERT INTO public.offer_campaigns (
  code, title, active, starts_at, ends_at, customer_type, speed_bucket, plan_term,
  reward_type, reward_amount, reward_currency, payout_delay_days,
  require_first_paid_invoice, one_per_address, landing_path, terms_version,
  terms_text, internal_notes
) VALUES (
  'SWITCH50',
  'OCCTA £50 Switch Cash',
  true,
  '2026-09-06 00:00:00 Europe/London',
  '2026-10-31 23:59:59 Europe/London',
  'residential',
  'essential',
  'price_lock_24',
  'cashback',
  50.00,
  'GBP',
  30,
  true,
  true,
  '/broadband?offer=SWITCH50',
  'switch50-2026-09-06-v1',
  'New residential customers only. SWITCH50 applies only to an eligible Essential Fibre Price Lock 24 order placed by 31 October 2026. The £50 reward is separate from the broadband price and does not reduce the £34.99 monthly price. Availability, estimated speed, setup requirements, router/equipment choices, one-off charges and the final price are confirmed for the customer address before order. One SWITCH50 reward per eligible service address. The service must activate, remain live and not be in arrears or cancellation/cease status when eligibility is checked. The first broadband invoice must have been paid. The reward becomes eligible 30 days after service activation once all eligibility conditions are met. OCCTA may withhold or reverse a reward for duplicate, fraudulent, cancelled, ceased, unpaid or otherwise ineligible orders. Reward payment is recorded against the order and customer account. Statutory rights are unaffected.',
  'Launch offer approved for Essential Fibre Price Lock 24 only. Do not apply to Flex 30, Superfast, Ultrafast, business orders or expired/inactive campaigns.'
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  customer_type = EXCLUDED.customer_type,
  speed_bucket = EXCLUDED.speed_bucket,
  plan_term = EXCLUDED.plan_term,
  reward_type = EXCLUDED.reward_type,
  reward_amount = EXCLUDED.reward_amount,
  reward_currency = EXCLUDED.reward_currency,
  payout_delay_days = EXCLUDED.payout_delay_days,
  require_first_paid_invoice = EXCLUDED.require_first_paid_invoice,
  one_per_address = EXCLUDED.one_per_address,
  landing_path = EXCLUDED.landing_path,
  terms_version = EXCLUDED.terms_version,
  terms_text = EXCLUDED.terms_text,
  internal_notes = EXCLUDED.internal_notes,
  updated_at = now();

-- 2) Carry server-validated campaign state through Journey 2 and the order.
ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS campaign_code text,
  ADD COLUMN IF NOT EXISTS campaign_snapshot jsonb;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS campaign_code text,
  ADD COLUMN IF NOT EXISTS campaign_snapshot jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS campaign_code text,
  ADD COLUMN IF NOT EXISTS promotion_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_j2_campaign_code
  ON public.customer_journey_sessions(campaign_code) WHERE campaign_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_campaign_code
  ON public.quotes(campaign_code) WHERE campaign_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_campaign_code
  ON public.orders(campaign_code) WHERE campaign_code IS NOT NULL;

-- 3) Dedicated cash-promotion ledger. This is intentionally separate from the
-- points/bill-credit rewards ledger: SWITCH50 is real cash and must never be
-- converted into points or silently netted off the monthly broadband price.
CREATE TABLE IF NOT EXISTS public.promotion_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text NOT NULL REFERENCES public.offer_campaigns(code),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_address_key text NOT NULL,
  reward_type text NOT NULL DEFAULT 'cashback',
  reward_amount numeric(12,2) NOT NULL,
  reward_currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','eligible','payout_queued','issued','blocked','reversed','expired')),
  activation_at timestamptz,
  eligibility_due_at timestamptz,
  first_paid_invoice_id uuid,
  eligible_at timestamptz,
  payout_queued_at timestamptz,
  issued_at timestamptz,
  payout_reference text,
  payout_method text,
  blocked_reason text,
  reversal_reason text,
  campaign_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_code, order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_promotion_reward_campaign_address
  ON public.promotion_rewards(campaign_code, service_address_key);
CREATE INDEX IF NOT EXISTS idx_promotion_rewards_customer
  ON public.promotion_rewards(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_rewards_status
  ON public.promotion_rewards(status, eligibility_due_at);

GRANT SELECT ON public.promotion_rewards TO authenticated;
GRANT ALL ON public.promotion_rewards TO service_role;
ALTER TABLE public.promotion_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promotion_rewards_staff_select ON public.promotion_rewards;
CREATE POLICY promotion_rewards_staff_select ON public.promotion_rewards
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 4) Sync the immutable server-side campaign snapshot onto the canonical order.
CREATE OR REPLACE FUNCTION public.sync_order_campaign_from_journey2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  s record;
BEGIN
  IF NEW.checkout_session_id IS NULL THEN RETURN NEW; END IF;

  SELECT campaign_code, campaign_snapshot
    INTO s
    FROM public.customer_journey_sessions
   WHERE checkout_session_id = NEW.checkout_session_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF s IS NOT NULL
     AND s.campaign_code IS NOT NULL
     AND coalesce((s.campaign_snapshot ->> 'eligible')::boolean, false) IS TRUE THEN
    NEW.campaign_code := s.campaign_code;
    NEW.promotion_snapshot := s.campaign_snapshot;
  ELSE
    NEW.campaign_code := NULL;
    NEW.promotion_snapshot := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_sync_campaign ON public.orders;
CREATE TRIGGER trg_orders_sync_campaign
  BEFORE INSERT OR UPDATE OF checkout_session_id, customer_id, quote_id
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_campaign_from_journey2();

REVOKE ALL ON FUNCTION public.sync_order_campaign_from_journey2() FROM PUBLIC, anon, authenticated;

-- 5) Create exactly one cash reward after the accepted-order account has been
-- linked to a real customer. Duplicate service-address rewards are prevented by
-- the unique address key for this campaign.
CREATE OR REPLACE FUNCTION public.create_promotion_reward_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  c public.offer_campaigns%ROWTYPE;
  address_key text;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.campaign_code IS NULL OR NEW.promotion_snapshot IS NULL THEN
    RETURN NEW;
  END IF;
  IF coalesce((NEW.promotion_snapshot ->> 'eligible')::boolean, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM public.offer_campaigns WHERE code = NEW.campaign_code;
  IF c IS NULL THEN RETURN NEW; END IF;

  address_key := md5(
    regexp_replace(lower(coalesce(NEW.address_line1, '')), '\s+', '', 'g') || '|' ||
    regexp_replace(upper(coalesce(NEW.postcode, '')), '\s+', '', 'g')
  );

  INSERT INTO public.promotion_rewards (
    campaign_code, order_id, customer_id, service_address_key,
    reward_type, reward_amount, reward_currency, campaign_snapshot
  ) VALUES (
    c.code, NEW.id, NEW.customer_id, address_key,
    c.reward_type, c.reward_amount, c.reward_currency, NEW.promotion_snapshot
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_create_promotion_reward ON public.orders;
CREATE TRIGGER trg_orders_create_promotion_reward
  AFTER INSERT OR UPDATE OF customer_id, campaign_code, promotion_snapshot
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_promotion_reward_from_order();

REVOKE ALL ON FUNCTION public.create_promotion_reward_from_order() FROM PUBLIC, anon, authenticated;

-- 6) Eligibility engine: service live + D+30 + first paid invoice + new customer
-- + no cancellation/cease + one reward per address. This never sends money.
-- It only moves the reward into the finance payout queue.
CREATE OR REPLACE FUNCTION public.evaluate_promotion_rewards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  r record;
  c public.offer_campaigns%ROWTYPE;
  activation_ts timestamptz;
  due_ts timestamptz;
  paid_invoice uuid;
  old_live_broadband boolean;
  lifecycle text;
  changed integer := 0;
BEGIN
  FOR r IN
    SELECT pr.*, o.lifecycle_status, o.actual_service_live_at_utc,
           o.actual_activation_date, o.created_at AS order_created_at,
           o.service_type
      FROM public.promotion_rewards pr
      JOIN public.orders o ON o.id = pr.order_id
     WHERE pr.status IN ('pending','eligible')
     ORDER BY pr.created_at
  LOOP
    SELECT * INTO c FROM public.offer_campaigns WHERE code = r.campaign_code;
    IF c IS NULL THEN
      UPDATE public.promotion_rewards SET status='blocked', blocked_reason='campaign_missing', updated_at=now()
       WHERE id=r.id;
      changed := changed + 1;
      CONTINUE;
    END IF;

    lifecycle := lower(coalesce(r.lifecycle_status, ''));
    IF lifecycle LIKE '%cancel%' OR lifecycle LIKE '%cease%' OR lifecycle IN ('failed','rejected','closed') THEN
      UPDATE public.promotion_rewards
         SET status='blocked', blocked_reason='service_cancelled_or_ceased', updated_at=now()
       WHERE id=r.id AND status <> 'blocked';
      changed := changed + 1;
      CONTINUE;
    END IF;

    -- New-customer guard: a customer with an earlier live broadband order does
    -- not qualify for this acquisition reward.
    SELECT EXISTS (
      SELECT 1 FROM public.orders prev
       WHERE prev.customer_id = r.customer_id
         AND prev.id <> r.order_id
         AND prev.service_type = 'broadband'
         AND prev.created_at < r.order_created_at
         AND lower(coalesce(prev.lifecycle_status, '')) = 'live'
    ) INTO old_live_broadband;

    IF old_live_broadband THEN
      UPDATE public.promotion_rewards
         SET status='blocked', blocked_reason='existing_broadband_customer', updated_at=now()
       WHERE id=r.id AND status <> 'blocked';
      changed := changed + 1;
      CONTINUE;
    END IF;

    activation_ts := coalesce(
      r.actual_service_live_at_utc,
      CASE WHEN r.actual_activation_date IS NULL THEN NULL
           ELSE r.actual_activation_date::timestamptz END
    );

    IF activation_ts IS NULL OR lifecycle <> 'live' THEN
      UPDATE public.promotion_rewards
         SET activation_at=activation_ts, updated_at=now()
       WHERE id=r.id;
      CONTINUE;
    END IF;

    due_ts := activation_ts + make_interval(days => c.payout_delay_days);

    SELECT i.id INTO paid_invoice
      FROM public.invoices i
     WHERE i.customer_id = r.customer_id
       AND i.status = 'paid'
       AND i.issue_date >= r.order_created_at::date
     ORDER BY i.issue_date ASC, i.created_at ASC
     LIMIT 1;

    IF now() >= due_ts
       AND (c.require_first_paid_invoice IS FALSE OR paid_invoice IS NOT NULL) THEN
      UPDATE public.promotion_rewards
         SET status='eligible', activation_at=activation_ts,
             eligibility_due_at=due_ts, first_paid_invoice_id=paid_invoice,
             eligible_at=coalesce(eligible_at, now()), blocked_reason=NULL,
             updated_at=now()
       WHERE id=r.id AND status='pending';
      GET DIAGNOSTICS changed = ROW_COUNT;
    ELSE
      UPDATE public.promotion_rewards
         SET activation_at=activation_ts, eligibility_due_at=due_ts,
             first_paid_invoice_id=paid_invoice, updated_at=now()
       WHERE id=r.id;
    END IF;
  END LOOP;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_promotion_rewards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_promotion_rewards() TO service_role;

-- Hourly evaluation is sufficient; payout still requires finance confirmation.
DO $$
BEGIN
  PERFORM cron.unschedule('switch50-reward-eligibility');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'switch50-reward-eligibility',
  '15 * * * *',
  $$SELECT public.evaluate_promotion_rewards()$$
);

-- 7) Customer-safe read RPC (no bank/payment internals exposed).
CREATE OR REPLACE FUNCTION public.get_my_promotion_rewards()
RETURNS TABLE (
  id uuid,
  campaign_code text,
  order_id uuid,
  reward_amount numeric,
  reward_currency text,
  status text,
  activation_at timestamptz,
  eligibility_due_at timestamptz,
  eligible_at timestamptz,
  issued_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
  SELECT pr.id, pr.campaign_code, pr.order_id, pr.reward_amount,
         pr.reward_currency, pr.status, pr.activation_at,
         pr.eligibility_due_at, pr.eligible_at, pr.issued_at, pr.created_at
    FROM public.promotion_rewards pr
   WHERE pr.customer_id = auth.uid()
   ORDER BY pr.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_promotion_rewards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_promotion_rewards() TO authenticated;

-- 8) Operational reporting view for finance/marketing/admin.
CREATE OR REPLACE VIEW public.switch50_campaign_funnel AS
SELECT
  c.code,
  c.active,
  c.starts_at,
  c.ends_at,
  count(DISTINCT s.id) FILTER (WHERE s.campaign_code = c.code) AS sessions,
  count(DISTINCT q.id) FILTER (WHERE q.campaign_code = c.code) AS quotes,
  count(DISTINCT o.id) FILTER (WHERE o.campaign_code = c.code) AS orders,
  count(DISTINCT pr.id) FILTER (WHERE pr.status = 'eligible') AS rewards_eligible,
  count(DISTINCT pr.id) FILTER (WHERE pr.status = 'issued') AS rewards_issued,
  coalesce(sum(pr.reward_amount) FILTER (WHERE pr.status = 'issued'), 0)::numeric(12,2) AS rewards_paid
FROM public.offer_campaigns c
LEFT JOIN public.customer_journey_sessions s ON s.campaign_code = c.code
LEFT JOIN public.quotes q ON q.campaign_code = c.code
LEFT JOIN public.orders o ON o.campaign_code = c.code
LEFT JOIN public.promotion_rewards pr ON pr.campaign_code = c.code
WHERE c.code = 'SWITCH50'
GROUP BY c.code, c.active, c.starts_at, c.ends_at;

REVOKE ALL ON public.switch50_campaign_funnel FROM PUBLIC, anon;
GRANT SELECT ON public.switch50_campaign_funnel TO authenticated;

-- 9) Seed the existing campaign control centre with an auditable record.
INSERT INTO public.campaign_drafts (
  campaign_type, title, target_audience, draft_copy, offer_terms,
  margin_check_status, compliance_check_status, approval_status,
  published_at, starts_at, ends_at, active, performance_json
)
SELECT
  'contract_saver_offer'::public.campaign_draft_type,
  'SWITCH50 — £50 Switch Cash',
  'New UK residential customers taking eligible Essential Fibre Price Lock 24',
  '£50 BACK. YOUR PRICE STAYS PUT. Essential Fibre £34.99/month incl. VAT, up to 80 Mbps, subject to address availability and exact line estimate.',
  c.terms_text,
  'green'::public.campaign_margin_status,
  'passed'::public.campaign_compliance_status,
  'published'::public.campaign_approval_status,
  now(), c.starts_at, c.ends_at, true,
  jsonb_build_object('campaign_code','SWITCH50','reward_amount',50,'currency','GBP','source','production_offer_campaigns')
FROM public.offer_campaigns c
WHERE c.code='SWITCH50'
AND NOT EXISTS (SELECT 1 FROM public.campaign_drafts d WHERE d.title='SWITCH50 — £50 Switch Cash');
