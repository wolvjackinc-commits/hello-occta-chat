-- Created with Supabase CLI; ordered after the existing 10:15 campaign migration.
-- No transfers or external messages occur in this migration.
BEGIN;

ALTER TABLE public.promotion_rewards
  ADD COLUMN version integer NOT NULL DEFAULT 0,
  ADD COLUMN manual_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN needs_review boolean NOT NULL DEFAULT false;

CREATE TABLE public.promotion_reward_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_code text NOT NULL DEFAULT 'SWITCH50',
  reward_id uuid REFERENCES public.promotion_rewards(id),
  order_id uuid REFERENCES public.orders(id),
  actor_id uuid,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  details jsonb NOT NULL DEFAULT '{}',
  request_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotion_events_reward ON public.promotion_reward_events(reward_id, id);
CREATE INDEX promotion_events_order ON public.promotion_reward_events(order_id, id);
ALTER TABLE public.promotion_reward_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promotion_reward_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.promotion_reward_events TO service_role;

CREATE TABLE public.promotion_message_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id bigint NOT NULL UNIQUE REFERENCES public.promotion_reward_events(id),
  reward_id uuid NOT NULL REFERENCES public.promotion_rewards(id),
  customer_id uuid NOT NULL REFERENCES auth.users(id),
  template text NOT NULL,
  payload jsonb NOT NULL,
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
CREATE INDEX promotion_messages_due ON public.promotion_message_outbox(next_attempt_at)
  WHERE status IN ('pending','processing');
ALTER TABLE public.promotion_message_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promotion_message_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.promotion_message_outbox TO service_role;

-- Service code mutates finance state only through the transactions below.
REVOKE ALL ON public.promotion_rewards, public.offer_campaigns FROM anon, authenticated;
GRANT SELECT ON public.promotion_rewards, public.offer_campaigns TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.promotion_rewards FROM service_role;
CREATE UNIQUE INDEX switch50_transfer_reference ON public.promotion_rewards(campaign_code,lower(trim(payout_reference))) WHERE payout_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS switch50_invoices_order ON public.invoices(order_id, issue_date, created_at);
CREATE INDEX IF NOT EXISTS switch50_invoices_customer_due ON public.invoices(user_id, due_date);

CREATE OR REPLACE FUNCTION public.switch50_audit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'promotion_audit_is_append_only'; END $$;
CREATE TRIGGER promotion_audit_immutable BEFORE UPDATE OR DELETE ON public.promotion_reward_events
  FOR EACH ROW EXECUTE FUNCTION public.switch50_audit_immutable();

CREATE OR REPLACE FUNCTION public.switch50_reward_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.order_id, NEW.customer_id, NEW.campaign_code, NEW.service_address_key,
      NEW.reward_amount, NEW.reward_currency, NEW.campaign_snapshot)
     IS DISTINCT FROM (OLD.order_id, OLD.customer_id, OLD.campaign_code, OLD.service_address_key,
      OLD.reward_amount, OLD.reward_currency, OLD.campaign_snapshot) THEN
    RAISE EXCEPTION 'promotion_economics_are_immutable';
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER switch50_reward_version BEFORE UPDATE ON public.promotion_rewards
  FOR EACH ROW EXECUTE FUNCTION public.switch50_reward_version();

-- Audit and customer notification intent commit or roll back with the reward.
CREATE OR REPLACE FUNCTION public.switch50_reward_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event bigint; v_type text; v_old text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_type := 'order_reward_recorded';
  ELSE
    v_old := OLD.status;
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_type := 'reward_' || NEW.status;
    ELSIF NEW.needs_review IS DISTINCT FROM OLD.needs_review THEN v_type := 'payout_review_required';
    ELSIF OLD.activation_at IS NULL AND NEW.activation_at IS NOT NULL THEN v_type := 'service_activated';
    ELSE RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.promotion_reward_events(reward_id, order_id, actor_id, event_type, from_status, to_status, details)
  VALUES (NEW.id, NEW.order_id, nullif(current_setting('switch50.actor', true), '')::uuid,
    v_type, v_old, NEW.status, jsonb_build_object('reason', NEW.blocked_reason, 'version', NEW.version))
  RETURNING id INTO v_event;
  IF v_type <> 'payout_review_required' THEN
    INSERT INTO public.promotion_message_outbox(event_id, reward_id, customer_id, template, payload)
    VALUES (v_event, NEW.id, NEW.customer_id, v_type,
      jsonb_build_object('amount', NEW.reward_amount, 'currency', NEW.reward_currency,
        'order_id', NEW.order_id, 'due_at', NEW.eligibility_due_at,
        'recipient_email', (SELECT email FROM auth.users WHERE id = NEW.customer_id),
        'delay_days', NEW.campaign_snapshot->'payout_delay_days', 'status', NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER switch50_reward_audit AFTER INSERT OR UPDATE ON public.promotion_rewards
  FOR EACH ROW EXECUTE FUNCTION public.switch50_reward_audit();

-- Bind the order to the signed canonical snapshot, never mutable browser/session
-- promotion fields. A delayed account link preserves the promise already made.
CREATE OR REPLACE FUNCTION public.sync_order_campaign_from_journey2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_snapshot jsonb; v_test boolean; v_campaign public.offer_campaigns%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.promotion_snapshot IS NOT NULL THEN
    NEW.campaign_code := OLD.campaign_code;
    NEW.promotion_snapshot := OLD.promotion_snapshot;
    RETURN NEW;
  END IF;
  NEW.campaign_code := NULL; NEW.promotion_snapshot := NULL;
  IF NEW.checkout_session_id IS NULL THEN RETURN NEW; END IF;
  SELECT snap.snapshot, s.test_session INTO v_snapshot, v_test
    FROM public.customer_journey_sessions s
    JOIN public.journey2_contract_snapshots snap ON snap.id = s.contract_snapshot_id AND snap.session_id = s.id
    WHERE s.checkout_session_id = NEW.checkout_session_id LIMIT 1;
  IF v_snapshot->'promotion'->>'code' IS DISTINCT FROM 'SWITCH50' THEN RETURN NEW; END IF;
  IF coalesce(v_test, true) OR coalesce((v_snapshot->>'test_session')::boolean, true)
    OR v_snapshot->'product'->>'speed_bucket' IS DISTINCT FROM 'essential'
    OR v_snapshot->'product'->>'contract_term' IS DISTINCT FROM 'price_lock_24'
    OR v_snapshot->'promotion'->>'eligible' IS DISTINCT FROM 'true'
    OR NEW.service_type::text <> 'broadband'
    OR NEW.contract_acceptance_id IS NULL THEN
    RAISE EXCEPTION 'switch50_contract_invalid';
  END IF;
  SELECT * INTO v_campaign FROM public.offer_campaigns WHERE code = 'SWITCH50' FOR SHARE;
  IF NOT coalesce(v_campaign.active, false) OR now() < v_campaign.starts_at OR now() > v_campaign.ends_at
    OR (v_snapshot->'promotion'->>'reward_amount')::numeric IS DISTINCT FROM v_campaign.reward_amount
    OR v_snapshot->'promotion'->>'terms_version' IS DISTINCT FROM v_campaign.terms_version THEN
    RAISE EXCEPTION 'switch50_offer_changed_review_contract';
  END IF;
  NEW.campaign_code := 'SWITCH50'; NEW.promotion_snapshot := v_snapshot->'promotion';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_orders_sync_campaign ON public.orders;
CREATE TRIGGER trg_orders_sync_campaign BEFORE INSERT OR UPDATE OF checkout_session_id, customer_id, quote_id, campaign_code, promotion_snapshot
  ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_order_campaign_from_journey2();

CREATE OR REPLACE FUNCTION public.create_promotion_reward_from_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text; v_id uuid; v_conflict uuid;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.campaign_code IS DISTINCT FROM 'SWITCH50'
    OR NEW.promotion_snapshot->>'eligible' IS DISTINCT FROM 'true' THEN RETURN NEW; END IF;
  -- The BEFORE trigger already checked the order-time campaign state. Do not
  -- check today's switch/expiry/economics when account provisioning links it.
  IF NEW.contract_acceptance_id IS NULL OR NEW.service_type::text <> 'broadband'
    OR NEW.created_at < (NEW.promotion_snapshot->>'starts_at')::timestamptz
    OR NEW.created_at > (NEW.promotion_snapshot->>'ends_at')::timestamptz
    OR nullif(trim(NEW.address_line1), '') IS NULL OR nullif(trim(NEW.postcode), '') IS NULL THEN
    RAISE EXCEPTION 'switch50_order_evidence_missing';
  END IF;
  v_key := md5(regexp_replace(lower(NEW.address_line1), '[^a-z0-9]', '', 'g') || '|' ||
    regexp_replace(lower(coalesce(NEW.address_line2, '')), '[^a-z0-9]', '', 'g') || '|' ||
    regexp_replace(upper(NEW.postcode), '[^A-Z0-9]', '', 'g'));
  -- Older campaign rows used a different address hash. Compare their original
  -- order addresses too, without rewriting existing financial records. The
  -- transaction lock serializes competing claims at the normalized address.
  PERFORM pg_advisory_xact_lock(hashtextextended('SWITCH50|' || v_key, 0));
  SELECT pr.id INTO v_conflict FROM public.promotion_rewards pr
    JOIN public.orders existing_order ON existing_order.id=pr.order_id
    WHERE pr.campaign_code='SWITCH50' AND pr.order_id<>NEW.id AND
      md5(regexp_replace(lower(existing_order.address_line1), '[^a-z0-9]', '', 'g') || '|' ||
        regexp_replace(lower(coalesce(existing_order.address_line2, '')), '[^a-z0-9]', '', 'g') || '|' ||
        regexp_replace(upper(existing_order.postcode), '[^A-Z0-9]', '', 'g'))=v_key
    LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.promotion_reward_events WHERE order_id=NEW.id AND event_type='duplicate_address_rejected') THEN
      INSERT INTO public.promotion_reward_events(order_id,event_type,details)
      VALUES(NEW.id,'duplicate_address_rejected',jsonb_build_object('existing_reward_id',v_conflict));
    END IF;
    RETURN NEW;
  END IF;
  INSERT INTO public.promotion_rewards(campaign_code, order_id, customer_id, service_address_key,
    reward_type, reward_amount, reward_currency, campaign_snapshot)
  VALUES ('SWITCH50', NEW.id, NEW.customer_id, v_key, 'cashback',
    (NEW.promotion_snapshot->>'reward_amount')::numeric,
    NEW.promotion_snapshot->>'reward_currency', NEW.promotion_snapshot)
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.promotion_rewards WHERE order_id = NEW.id AND campaign_code = 'SWITCH50') THEN
    SELECT id INTO v_conflict FROM public.promotion_rewards WHERE campaign_code = 'SWITCH50' AND service_address_key = v_key;
    IF NOT EXISTS(SELECT 1 FROM public.promotion_reward_events WHERE order_id = NEW.id AND event_type = 'duplicate_address_rejected') THEN
      INSERT INTO public.promotion_reward_events(order_id, event_type, details)
      VALUES (NEW.id, 'duplicate_address_rejected', jsonb_build_object('existing_reward_id', v_conflict));
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- A single authoritative decision function, used on events, hourly, and again
-- immediately before payout. All finance transactions lock order then reward.
CREATE OR REPLACE FUNCTION public.evaluate_promotion_reward(p_reward_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.promotion_rewards%ROWTYPE; o public.orders%ROWTYPE;
  v_order uuid; v_activation timestamptz; v_due timestamptz; v_first public.invoices%ROWTYPE;
  v_reason text; v_next text; v_live boolean;
BEGIN
  SELECT order_id INTO v_order FROM public.promotion_rewards WHERE id = p_reward_id;
  SELECT * INTO o FROM public.orders WHERE id = v_order FOR UPDATE;
  SELECT * INTO r FROM public.promotion_rewards WHERE id = p_reward_id FOR UPDATE;
  IF r.id IS NULL THEN RETURN 'missing'; END IF;
  IF r.manual_hold OR r.status IN ('reversed','expired') THEN RETURN r.status; END IF;
  v_activation := coalesce(o.actual_service_live_at_utc, o.actual_activation_date::timestamp AT TIME ZONE 'Europe/London');
  v_due := v_activation + make_interval(days => (r.campaign_snapshot->>'payout_delay_days')::integer);
  v_live := lower(coalesce(o.lifecycle_status, '')) = 'live' AND EXISTS (
    SELECT 1 FROM public.services s WHERE s.order_id = o.id AND s.user_id = r.customer_id
      AND s.service_type = 'broadband' AND s.status = 'active' AND s.archived_at IS NULL
      AND NOT s.activation_blocked_pending_review);
  SELECT i.* INTO v_first FROM public.invoices i
    WHERE i.user_id = r.customer_id AND i.total > 0
      AND (i.order_id = r.order_id OR (i.order_id IS NULL AND EXISTS (
        SELECT 1 FROM public.services s WHERE s.id = i.service_id AND s.order_id = r.order_id)))
      AND i.invoice_type IN ('monthly','first_pro_rata')
      AND i.status::text NOT IN ('draft','void','voided','cancelled')
    ORDER BY i.issue_date, i.created_at, i.id LIMIT 1;
  IF o.customer_id IS DISTINCT FROM r.customer_id OR o.promotion_snapshot IS DISTINCT FROM r.campaign_snapshot
    OR o.service_type::text <> 'broadband' THEN v_reason := 'order_evidence_changed';
  ELSIF lower(coalesce(o.lifecycle_status, '')) ~ '(cancel|cease|failed|rejected|closed)'
    OR o.status::text IN ('cancelled','failed','rejected') OR o.cancellation_requested_at IS NOT NULL
    OR o.cease_date IS NOT NULL OR EXISTS (SELECT 1 FROM public.service_cancellation_cases c
      WHERE c.order_id = o.id AND c.withdrawn_at IS NULL AND c.status NOT IN ('withdrawn','rejected'))
    THEN v_reason := 'service_cancelled_or_ceased';
  ELSIF EXISTS (SELECT 1 FROM public.orders prev WHERE coalesce(prev.customer_id, prev.user_id) = r.customer_id
    AND prev.id <> o.id AND prev.service_type::text = 'broadband' AND prev.created_at < o.created_at
    AND (prev.actual_service_live_at_utc IS NOT NULL OR prev.actual_activation_date IS NOT NULL
      OR prev.lifecycle_status = 'live')) THEN v_reason := 'existing_broadband_customer';
  ELSIF v_activation IS NULL OR NOT v_live OR o.activation_blocked_pending_review THEN v_reason := 'awaiting_live_service';
  ELSIF v_first.id IS NULL OR v_first.status::text <> 'paid' THEN v_reason := 'awaiting_first_broadband_payment';
  ELSIF EXISTS (SELECT 1 FROM public.invoices i WHERE i.user_id = r.customer_id AND i.total > 0
    AND i.due_date < (now() AT TIME ZONE 'Europe/London')::date
    AND i.status::text NOT IN ('paid','draft','void','voided','cancelled','refunded')) THEN v_reason := 'account_in_arrears';
  ELSIF v_due IS NULL OR now() < v_due THEN v_reason := 'awaiting_day_30';
  END IF;
  -- A recorded transfer is never silently undone by automation.
  IF r.status = 'issued' THEN
    IF v_reason IS NOT NULL AND NOT r.needs_review THEN
      UPDATE public.promotion_rewards SET needs_review = true, blocked_reason = v_reason WHERE id = r.id;
    END IF;
    RETURN 'issued';
  END IF;
  v_next := CASE WHEN v_reason IS NULL THEN CASE WHEN r.status = 'payout_queued' THEN 'payout_queued' ELSE 'eligible' END
    WHEN v_reason IN ('order_evidence_changed','service_cancelled_or_ceased','existing_broadband_customer','account_in_arrears') THEN 'blocked'
    ELSE 'pending' END;
  IF (r.status, r.activation_at, r.eligibility_due_at, r.first_paid_invoice_id, r.blocked_reason)
     IS DISTINCT FROM (v_next, v_activation, v_due, CASE WHEN v_first.status::text = 'paid' THEN v_first.id END, v_reason) THEN
    UPDATE public.promotion_rewards SET status = v_next, activation_at = v_activation, eligibility_due_at = v_due,
      first_paid_invoice_id = CASE WHEN v_first.status::text = 'paid' THEN v_first.id END,
      eligible_at = CASE WHEN v_next IN ('eligible','payout_queued') THEN coalesce(eligible_at, now()) ELSE eligible_at END,
      payout_queued_at = CASE WHEN v_next = 'payout_queued' THEN payout_queued_at ELSE NULL END,
      blocked_reason = v_reason WHERE id = r.id;
  END IF;
  RETURN v_next;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_promotion_rewards() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0; v_before integer;
BEGIN
  FOR r IN SELECT id FROM public.promotion_rewards WHERE campaign_code = 'SWITCH50'
    AND status NOT IN ('reversed','expired') AND NOT manual_hold ORDER BY order_id LOOP
    SELECT version INTO v_before FROM public.promotion_rewards WHERE id = r.id;
    PERFORM public.evaluate_promotion_reward(r.id);
    IF (SELECT version FROM public.promotion_rewards WHERE id = r.id) > v_before THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

-- Database events cover all activation, payment, refund and cancellation
-- writers, including manual finance corrections and provider webhooks.
CREATE OR REPLACE FUNCTION public.switch50_source_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer uuid; v_order uuid; r record;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN v_order := NEW.id;
  ELSIF TG_TABLE_NAME = 'invoices' THEN v_customer := coalesce(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'services' THEN v_order := coalesce(NEW.order_id, OLD.order_id);
  ELSE v_order := coalesce(NEW.order_id, OLD.order_id); END IF;
  FOR r IN SELECT id FROM public.promotion_rewards
    WHERE campaign_code = 'SWITCH50' AND (order_id = v_order OR customer_id = v_customer) ORDER BY order_id LOOP
    PERFORM public.evaluate_promotion_reward(r.id);
  END LOOP;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER zz_switch50_order_changed AFTER INSERT OR UPDATE OF lifecycle_status, status, actual_service_live_at_utc,
  actual_activation_date, cancellation_requested_at, cease_date, activation_blocked_pending_review, customer_id
  ON public.orders FOR EACH ROW EXECUTE FUNCTION public.switch50_source_changed();
CREATE TRIGGER switch50_invoice_changed AFTER INSERT OR DELETE OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.switch50_source_changed();
CREATE TRIGGER switch50_service_changed AFTER INSERT OR DELETE OR UPDATE OF status, archived_at, activation_blocked_pending_review
  ON public.services FOR EACH ROW EXECUTE FUNCTION public.switch50_source_changed();
CREATE TRIGGER switch50_cancellation_changed AFTER INSERT OR DELETE OR UPDATE ON public.service_cancellation_cases
  FOR EACH ROW EXECUTE FUNCTION public.switch50_source_changed();

CREATE OR REPLACE FUNCTION public.switch50_admin_action(p_actor uuid, p_request_id uuid, p_action text,
  p_reward_id uuid DEFAULT NULL, p_expected_version integer DEFAULT NULL, p_reason text DEFAULT NULL,
  p_reference text DEFAULT NULL, p_active boolean DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.promotion_rewards%ROWTYPE; v_order uuid; v_admin boolean; v_finance boolean;
  v_request jsonb; v_prior public.promotion_reward_events%ROWTYPE; v_result jsonb; v_status text;
BEGIN
  SELECT coalesce(bool_or(role::text IN ('admin','super_admin')),false),
    coalesce(bool_or(role::text IN ('admin','super_admin','finance_admin')),false)
    INTO v_admin, v_finance FROM public.user_roles WHERE user_id = p_actor;
  IF NOT v_finance THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  IF p_request_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','request_id_required'); END IF;
  PERFORM set_config('switch50.actor', p_actor::text, true);
  v_request := jsonb_build_object('action',p_action,'reward_id',p_reward_id,'version',p_expected_version,
    'reason',trim(p_reason),'reference',trim(p_reference),'active',p_active);
  IF p_action = 'set_active' THEN
    IF NOT v_admin OR p_active IS NULL OR length(trim(coalesce(p_reason,''))) < 10 THEN
      RETURN jsonb_build_object('ok',false,'error','admin_and_reason_required'); END IF;
    PERFORM 1 FROM public.offer_campaigns WHERE code = 'SWITCH50' FOR UPDATE;
  ELSE
    SELECT order_id INTO v_order FROM public.promotion_rewards WHERE id = p_reward_id AND campaign_code = 'SWITCH50';
    IF v_order IS NULL THEN RETURN jsonb_build_object('ok',false,'error','reward_not_found'); END IF;
    PERFORM 1 FROM public.orders WHERE id = v_order FOR UPDATE;
    SELECT * INTO r FROM public.promotion_rewards WHERE id = p_reward_id FOR UPDATE;
  END IF;
  SELECT * INTO v_prior FROM public.promotion_reward_events WHERE request_id = p_request_id;
  IF v_prior.id IS NOT NULL THEN
    IF v_prior.actor_id IS DISTINCT FROM p_actor OR v_prior.details->'request' IS DISTINCT FROM v_request THEN
      RETURN jsonb_build_object('ok',false,'error','idempotency_conflict'); END IF;
    RETURN v_prior.details->'result';
  END IF;
  IF p_action = 'set_active' THEN
    UPDATE public.offer_campaigns SET active = p_active, updated_at = now() WHERE code = 'SWITCH50';
    v_result := jsonb_build_object('ok',true,'active',p_active);
  ELSE
    IF p_expected_version IS DISTINCT FROM r.version THEN RETURN jsonb_build_object('ok',false,'error','stale_reward'); END IF;
    IF p_action IN ('queue_payout','mark_issued') THEN
      v_status := public.evaluate_promotion_reward(r.id);
      IF (p_action = 'queue_payout' AND v_status <> 'eligible') OR (p_action = 'mark_issued' AND v_status <> 'payout_queued') THEN
        RETURN jsonb_build_object('ok',false,'error','reward_not_payable','status',v_status); END IF;
      IF p_action = 'mark_issued' AND length(trim(coalesce(p_reference,''))) NOT BETWEEN 4 AND 200 THEN
        RETURN jsonb_build_object('ok',false,'error','transfer_reference_required'); END IF;
      UPDATE public.promotion_rewards SET
        status = CASE WHEN p_action = 'queue_payout' THEN 'payout_queued' ELSE 'issued' END,
        payout_queued_at = coalesce(payout_queued_at,now()),
        issued_at = CASE WHEN p_action = 'mark_issued' THEN now() ELSE issued_at END,
        payout_reference = CASE WHEN p_action = 'mark_issued' THEN trim(p_reference) ELSE payout_reference END,
        payout_method = CASE WHEN p_action = 'mark_issued' THEN 'bank_transfer' ELSE payout_method END WHERE id = r.id;
    ELSIF p_action IN ('block','release','reverse') THEN
      IF NOT v_admin OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 THEN
        RETURN jsonb_build_object('ok',false,'error','admin_and_reason_required'); END IF;
      IF p_action = 'block' AND r.status IN ('pending','eligible','payout_queued','blocked') THEN
        UPDATE public.promotion_rewards SET status='blocked', manual_hold=true, blocked_reason=trim(p_reason) WHERE id=r.id;
      ELSIF p_action = 'release' AND r.status='blocked' AND r.manual_hold THEN
        UPDATE public.promotion_rewards SET manual_hold=false, status='pending', blocked_reason=NULL WHERE id=r.id;
        PERFORM public.evaluate_promotion_reward(r.id);
      ELSIF p_action = 'reverse' AND r.status='issued' AND length(trim(coalesce(p_reference,''))) BETWEEN 4 AND 200 THEN
        UPDATE public.promotion_rewards SET status='reversed', reversal_reason=trim(p_reason), needs_review=false WHERE id=r.id;
      ELSE RETURN jsonb_build_object('ok',false,'error','invalid_transition'); END IF;
    ELSE RETURN jsonb_build_object('ok',false,'error','unknown_action'); END IF;
    SELECT jsonb_build_object('ok',true,'status',status,'version',version) INTO v_result FROM public.promotion_rewards WHERE id=r.id;
  END IF;
  INSERT INTO public.promotion_reward_events(reward_id,order_id,actor_id,event_type,request_id,details)
  VALUES(p_reward_id,v_order,p_actor,'admin_'||p_action,p_request_id,jsonb_build_object('request',v_request,'result',v_result));
  RETURN v_result;
END $$;

-- Workers claim with leases. A provider idempotency key is stable per message.
-- Retry only inside Resend's 24-hour key window; ambiguous old sends need review.
CREATE OR REPLACE FUNCTION public.switch50_claim_messages(p_limit integer DEFAULT 20)
RETURNS SETOF public.promotion_message_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.promotion_message_outbox SET status='failed', last_error='delivery_window_exceeded'
    WHERE status IN ('pending','processing') AND (first_attempt_at < now()-interval '23 hours'
      OR (attempts >= 6 AND locked_until < now()));
  RETURN QUERY WITH due AS (
    SELECT m.id FROM public.promotion_message_outbox m
    WHERE (m.status='pending' OR (m.status='processing' AND m.locked_until < now()))
      AND m.next_attempt_at <= now() AND m.attempts < 6
    ORDER BY m.created_at LIMIT least(greatest(p_limit,1),50) FOR UPDATE SKIP LOCKED
  ) UPDATE public.promotion_message_outbox m SET status='processing', attempts=m.attempts+1,
    lease_token=gen_random_uuid(), locked_until=now()+interval '5 minutes', first_attempt_at=coalesce(m.first_attempt_at,now())
    FROM due WHERE m.id=due.id RETURNING m.*;
END $$;
CREATE OR REPLACE FUNCTION public.switch50_finish_message(p_id uuid,p_lease uuid,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.promotion_message_outbox%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.promotion_message_outbox WHERE id=p_id AND lease_token=p_lease AND status='processing' FOR UPDATE;
  IF m.id IS NULL THEN RETURN false; END IF;
  UPDATE public.promotion_message_outbox SET
    status=CASE WHEN p_error = 'superseded' THEN 'suppressed' WHEN p_provider_id IS NOT NULL THEN 'sent' WHEN attempts>=6 THEN 'failed' ELSE 'pending' END,
    provider_message_id=p_provider_id, last_error=left(p_error,200), locked_until=NULL,
    sent_at=CASE WHEN p_provider_id IS NOT NULL THEN now() END,
    next_attempt_at=now()+make_interval(mins=>least(60,attempts*attempts)) WHERE id=p_id;
  INSERT INTO public.promotion_reward_events(reward_id,event_type,details)
    VALUES(m.reward_id,CASE WHEN p_error = 'superseded' THEN 'message_suppressed' WHEN p_provider_id IS NOT NULL THEN 'message_sent' ELSE 'message_attempt_failed' END,
      jsonb_build_object('message_id',m.id,'attempt',m.attempts,'provider_id',p_provider_id));
  RETURN true;
END $$;

-- No new privileged function is a public RPC. Triggers execute as their owner.
REVOKE ALL ON FUNCTION public.switch50_audit_immutable(),public.switch50_reward_version(),public.switch50_reward_audit(),
  public.evaluate_promotion_reward(uuid),public.switch50_source_changed(),
  public.switch50_admin_action(uuid,uuid,text,uuid,integer,text,text,boolean),
  public.switch50_claim_messages(integer),public.switch50_finish_message(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_promotion_reward(uuid),public.evaluate_promotion_rewards(),
  public.switch50_admin_action(uuid,uuid,text,uuid,integer,text,text,boolean),
  public.switch50_claim_messages(integer),public.switch50_finish_message(uuid,uuid,text,text) TO service_role;

-- Campaign source totals use distinct orders and never expose click identifiers.
CREATE VIEW public.switch50_campaign_sources AS
SELECT CASE WHEN s.utm_snapshot->>'utm_source' ~ '^[a-zA-Z0-9_.-]{1,80}$'
  THEN lower(s.utm_snapshot->>'utm_source') ELSE 'direct_or_other' END AS source,
  count(*) AS sessions, count(DISTINCT s.order_id) AS orders
FROM public.customer_journey_sessions s
WHERE s.campaign_code='SWITCH50' AND NOT s.test_session
GROUP BY 1;
REVOKE ALL ON public.switch50_campaign_sources FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.switch50_campaign_sources TO service_role;

-- Provision these two Vault entries only at the deployment configuration step.
-- Missing configuration makes the dispatcher a no-op; the outbox stays durable.
CREATE FUNCTION public.switch50_dispatch_messages() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $body$
DECLARE v_url text; v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='switch50_worker_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='switch50_worker_secret' LIMIT 1;
  IF v_url IS NULL OR v_secret IS NULL OR length(v_secret)<32 THEN RETURN false; END IF;
  IF v_url !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/switch50-message-worker$' THEN
    RAISE EXCEPTION 'invalid_switch50_worker_url'; END IF;
  PERFORM net.http_post(url=>v_url,headers=>jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
    body=>'{}'::jsonb,timeout_milliseconds=>1000);
  RETURN true;
END $body$;
REVOKE ALL ON FUNCTION public.switch50_dispatch_messages() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.switch50_dispatch_messages() TO service_role;
SELECT cron.schedule('switch50-customer-messages','*/5 * * * *','SELECT public.switch50_dispatch_messages()');


-- A duplicate is an explicitly visible non-payable outcome, not a missing tracker.
CREATE OR REPLACE FUNCTION public.get_my_promotion_rewards()
RETURNS TABLE (id uuid,campaign_code text,order_id uuid,reward_amount numeric,reward_currency text,status text,
  activation_at timestamptz,eligibility_due_at timestamptz,eligible_at timestamptz,issued_at timestamptz,created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=public STABLE AS $body$
  SELECT pr.id,pr.campaign_code,pr.order_id,pr.reward_amount,pr.reward_currency,pr.status,
    pr.activation_at,pr.eligibility_due_at,pr.eligible_at,pr.issued_at,pr.created_at
    FROM public.promotion_rewards pr WHERE pr.customer_id=auth.uid()
  UNION ALL
  SELECT o.id,'SWITCH50',o.id,(o.promotion_snapshot->>'reward_amount')::numeric,
    'GBP','blocked',NULL::timestamptz,NULL::timestamptz,NULL::timestamptz,NULL::timestamptz,o.created_at
    FROM public.orders o WHERE o.customer_id=auth.uid() AND o.campaign_code='SWITCH50'
      AND NOT EXISTS(SELECT 1 FROM public.promotion_rewards pr WHERE pr.order_id=o.id AND pr.campaign_code='SWITCH50')
      AND EXISTS(SELECT 1 FROM public.promotion_reward_events e WHERE e.order_id=o.id AND e.event_type='duplicate_address_rejected')
  ORDER BY created_at DESC;
$body$;
REVOKE ALL ON FUNCTION public.get_my_promotion_rewards() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_promotion_rewards() TO authenticated;

DROP POLICY promotion_rewards_staff_select ON public.promotion_rewards;
CREATE POLICY promotion_rewards_staff_select ON public.promotion_rewards FOR SELECT TO authenticated USING(
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin','finance_admin'))
);

COMMIT;
