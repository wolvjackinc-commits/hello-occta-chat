-- SWITCH50 hardening: server guards, short Contract Summary disclosure,
-- privacy-safe reporting and deterministic eligibility accounting.

-- Never grant campaign funnel/business performance data directly to customers.
REVOKE ALL ON public.switch50_campaign_funnel FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.switch50_campaign_funnel TO service_role;

-- Replace the funnel view with independent aggregates so rewards are not
-- multiplied by joins across sessions, quotes and orders.
CREATE OR REPLACE VIEW public.switch50_campaign_funnel AS
SELECT
  c.code,
  c.active,
  c.starts_at,
  c.ends_at,
  (SELECT count(*) FROM public.customer_journey_sessions s WHERE s.campaign_code = c.code) AS sessions,
  (SELECT count(*) FROM public.quotes q WHERE q.campaign_code = c.code) AS quotes,
  (SELECT count(*) FROM public.orders o WHERE o.campaign_code = c.code) AS orders,
  (SELECT count(*) FROM public.promotion_rewards pr WHERE pr.campaign_code = c.code AND pr.status = 'eligible') AS rewards_eligible,
  (SELECT count(*) FROM public.promotion_rewards pr WHERE pr.campaign_code = c.code AND pr.status = 'payout_queued') AS rewards_payout_queued,
  (SELECT count(*) FROM public.promotion_rewards pr WHERE pr.campaign_code = c.code AND pr.status = 'issued') AS rewards_issued,
  (SELECT coalesce(sum(pr.reward_amount), 0)::numeric(12,2)
     FROM public.promotion_rewards pr
    WHERE pr.campaign_code = c.code AND pr.status = 'issued') AS rewards_paid
FROM public.offer_campaigns c
WHERE c.code = 'SWITCH50';
REVOKE ALL ON public.switch50_campaign_funnel FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.switch50_campaign_funnel TO service_role;

-- A reward may only be minted from a contractual, eligible campaign snapshot
-- for an order placed while the campaign was active and inside its order window.
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
  IF NEW.campaign_code <> 'SWITCH50'
     OR NEW.service_type <> 'broadband'
     OR coalesce(NEW.plan_name, '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM public.offer_campaigns WHERE code = NEW.campaign_code;
  IF c IS NULL OR c.active IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.created_at < c.starts_at OR NEW.created_at > c.ends_at THEN RETURN NEW; END IF;

  -- Snapshot must match the immutable approved economics. The cash value is
  -- always read from the authoritative campaign row, not from client input.
  IF coalesce(NEW.promotion_snapshot ->> 'code', '') <> c.code
     OR coalesce(NEW.promotion_snapshot ->> 'terms_version', '') <> c.terms_version
     OR coalesce((NEW.promotion_snapshot ->> 'reward_amount')::numeric, -1) <> c.reward_amount THEN
    RETURN NEW;
  END IF;

  address_key := md5(
    regexp_replace(lower(coalesce(NEW.address_line1, '')), '\s+', '', 'g') || '|' ||
    regexp_replace(upper(coalesce(NEW.postcode, '')), '\s+', '', 'g')
  );
  IF address_key = md5('|') THEN RETURN NEW; END IF;

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
REVOKE ALL ON FUNCTION public.create_promotion_reward_from_order() FROM PUBLIC, anon, authenticated;

-- Robust evaluator. It deliberately does not send money: it changes a reward
-- from pending -> eligible only after all billing/service gates are satisfied.
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
  row_changed integer := 0;
BEGIN
  FOR r IN
    SELECT pr.*, o.lifecycle_status, o.status AS order_status,
           o.actual_service_live_at_utc, o.actual_activation_date,
           o.created_at AS order_created_at, o.service_type
      FROM public.promotion_rewards pr
      JOIN public.orders o ON o.id = pr.order_id
     WHERE pr.status IN ('pending','eligible')
     ORDER BY pr.created_at
  LOOP
    SELECT * INTO c FROM public.offer_campaigns WHERE code = r.campaign_code;
    IF c IS NULL THEN
      UPDATE public.promotion_rewards SET status='blocked', blocked_reason='campaign_missing', updated_at=now()
       WHERE id=r.id AND status <> 'blocked';
      GET DIAGNOSTICS row_changed = ROW_COUNT;
      changed := changed + row_changed;
      CONTINUE;
    END IF;

    lifecycle := lower(coalesce(r.lifecycle_status, r.order_status, ''));
    IF lifecycle LIKE '%cancel%' OR lifecycle LIKE '%cease%'
       OR lifecycle IN ('failed','rejected','closed','cancelled','ceased') THEN
      UPDATE public.promotion_rewards
         SET status='blocked', blocked_reason='service_cancelled_or_ceased', updated_at=now()
       WHERE id=r.id AND status <> 'blocked';
      GET DIAGNOSTICS row_changed = ROW_COUNT;
      changed := changed + row_changed;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.orders prev
       WHERE prev.customer_id = r.customer_id
         AND prev.id <> r.order_id
         AND prev.service_type = 'broadband'
         AND prev.created_at < r.order_created_at
         AND (
           lower(coalesce(prev.lifecycle_status, '')) = 'live'
           OR (prev.actual_service_live_at_utc IS NOT NULL AND lower(coalesce(prev.lifecycle_status, '')) NOT LIKE '%cancel%')
         )
    ) INTO old_live_broadband;

    IF old_live_broadband THEN
      UPDATE public.promotion_rewards
         SET status='blocked', blocked_reason='existing_broadband_customer', updated_at=now()
       WHERE id=r.id AND status <> 'blocked';
      GET DIAGNOSTICS row_changed = ROW_COUNT;
      changed := changed + row_changed;
      CONTINUE;
    END IF;

    activation_ts := coalesce(
      r.actual_service_live_at_utc,
      CASE WHEN r.actual_activation_date IS NULL THEN NULL ELSE r.actual_activation_date::timestamptz END
    );

    IF activation_ts IS NULL OR lower(coalesce(r.lifecycle_status, '')) <> 'live' THEN
      UPDATE public.promotion_rewards
         SET activation_at=activation_ts, updated_at=now()
       WHERE id=r.id;
      CONTINUE;
    END IF;

    due_ts := activation_ts + make_interval(days => c.payout_delay_days);

    SELECT i.id INTO paid_invoice
      FROM public.invoices i
     WHERE i.customer_id = r.customer_id
       AND lower(coalesce(i.status::text, '')) = 'paid'
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
      GET DIAGNOSTICS row_changed = ROW_COUNT;
      changed := changed + row_changed;
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

-- Ensure the short Ofcom-style Contract Summary visibly records SWITCH50. The
-- existing CS UI and PDF both render speed_notes, so the disclosure appears in
-- every channel without changing price fields or billing totals.
CREATE OR REPLACE FUNCTION public.contract_summary_append_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  q record;
  p jsonb;
  reward numeric;
  campaign_note text;
BEGIN
  IF NEW.quote_id IS NULL THEN RETURN NEW; END IF;
  SELECT campaign_code, campaign_snapshot, monthly_gross
    INTO q
    FROM public.quotes
   WHERE id = NEW.quote_id;
  IF q.campaign_code <> 'SWITCH50' OR q.campaign_snapshot IS NULL THEN RETURN NEW; END IF;
  p := q.campaign_snapshot;
  IF coalesce((p ->> 'eligible')::boolean, false) IS NOT TRUE THEN RETURN NEW; END IF;

  reward := coalesce((p ->> 'reward_amount')::numeric, 50);
  campaign_note := E'\n\nSWITCH50 PROMOTION — £' || to_char(reward, 'FM999990.00') ||
    E' Switch Cash. This cash reward is separate from your broadband bill and does not reduce the monthly broadband price of £' ||
    to_char(coalesce(q.monthly_gross, NEW.monthly_price_incl_vat), 'FM999990.00') ||
    E'. Eligibility is checked 30 days after service activation once the first broadband invoice has been paid and the account remains eligible. One reward per eligible service address. Promotion terms version: ' ||
    coalesce(p ->> 'terms_version', 'switch50-2026-09-06-v1') || '.';

  IF position('SWITCH50 PROMOTION' in coalesce(NEW.speed_notes, '')) = 0 THEN
    NEW.speed_notes := coalesce(NEW.speed_notes, '') || campaign_note;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_summary_append_promotion ON public.contract_summaries;
CREATE TRIGGER trg_contract_summary_append_promotion
  BEFORE INSERT OR UPDATE OF quote_id, speed_notes
  ON public.contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.contract_summary_append_promotion();
REVOKE ALL ON FUNCTION public.contract_summary_append_promotion() FROM PUBLIC, anon, authenticated;

-- Keep the human-readable quote field deliberately concise for legacy views and
-- validators that historically treated it as a short note.
UPDATE public.quotes
   SET reward_eligibility = 'SWITCH50: £50 cash reward; monthly broadband price unchanged; checked D+30 after activation once first bill is paid, subject to terms.'
 WHERE campaign_code = 'SWITCH50'
   AND coalesce((campaign_snapshot ->> 'eligible')::boolean, false) IS TRUE;
