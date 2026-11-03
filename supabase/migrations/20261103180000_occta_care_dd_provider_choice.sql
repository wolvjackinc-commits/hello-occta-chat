-- OCCTA Care: each Care Direct Debit can be collected through AccessPay or FastPay.
-- The provider is fixed BEFORE the customer signs (phone sale: chosen when the link is sent;
-- self-serve: the default in care_settings), so the instruction the customer agrees to always
-- names the collector that will actually take the payment.
ALTER TABLE public.care_invites ADD COLUMN IF NOT EXISTS provider_code text REFERENCES public.dd_providers(provider_code);
ALTER TABLE public.care_applications ADD COLUMN IF NOT EXISTS provider_code text REFERENCES public.dd_providers(provider_code);

CREATE OR REPLACE FUNCTION public.care_application_provider() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.provider_code := coalesce(NEW.provider_code, (SELECT provider_code FROM public.care_invites WHERE id = NEW.invite_id),
    (SELECT provider_code FROM public.care_settings WHERE singleton));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_application_provider ON public.care_applications;
CREATE TRIGGER care_application_provider BEFORE INSERT ON public.care_applications FOR EACH ROW EXECUTE FUNCTION public.care_application_provider();

-- The mandate takes the provider the customer saw when they signed.
CREATE OR REPLACE FUNCTION public.care_mandate_provider() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.provider_code := coalesce((SELECT a.provider_code FROM public.care_consents c JOIN public.care_applications a ON a.id = c.application_id
    WHERE c.subscription_id = NEW.subscription_id AND c.kind = 'join' ORDER BY c.created_at LIMIT 1), NEW.provider_code);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_mandate_provider ON public.care_mandates;
CREATE TRIGGER care_mandate_provider BEFORE INSERT ON public.care_mandates FOR EACH ROW EXECUTE FUNCTION public.care_mandate_provider();

REVOKE ALL ON FUNCTION public.care_application_provider() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.care_mandate_provider() FROM PUBLIC, anon, authenticated;

-- Staff lists show which portal each mandate and collection lives in.
CREATE OR REPLACE FUNCTION public.care_admin_mandate_queue() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.lodge_due_by NULLS LAST, x.created_at) FROM (
    SELECT m.id, m.reference, m.status, m.account_holder_name, m.bank_name, m.masked_account_last4, m.masked_sort_last2,
           m.signed_at, m.lodge_due_by, m.lodged_at, m.provider_reference, m.cancel_requested_at, m.created_at,
           m.bank_details_ciphertext IS NOT NULL AS details_available, s.id AS subscription_id, s.status AS subscription_status,
           s.review_hold_until, p.full_name, p.account_number,
           concat_ws(', ', p.address_line1, p.address_line2, p.city, p.postcode) AS address,
           m.provider_code, d.display_name AS provider_name, d.service_user_number
      FROM public.care_mandates m JOIN public.care_subscriptions s ON s.id = m.subscription_id LEFT JOIN public.profiles p ON p.id = s.customer_id
      LEFT JOIN public.dd_providers d ON d.provider_code = m.provider_code
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
           (SELECT run_number FROM public.care_collection_runs r WHERE r.id = c.run_id) AS run_number,
           (SELECT submitted_confirmed_at FROM public.care_collection_runs r WHERE r.id = c.run_id) AS run_submitted_at,
           c.notice_dedupe, public.care_notice_delivered_on(c.notice_dedupe) AS notice_delivered_on, c.cancelled_reason,
           s.status AS sub_status, m.status AS mandate_status, m.provider_code
      FROM public.care_collections c JOIN public.care_subscriptions s ON s.id = c.subscription_id
      LEFT JOIN public.care_mandates m ON m.id = c.mandate_id LEFT JOIN public.profiles p ON p.id = s.customer_id
     WHERE (p_status = 'all' OR c.status = p_status
            OR (p_status = 'upcoming' AND c.status = 'scheduled' AND c.due_date <= public.care_today() + 35)
            OR (p_status = 'pulled' AND c.status = 'cancelled' AND c.cancelled_reason LIKE 'pulled_from_run:%'))
       AND NOT c.is_test
     LIMIT 1000) x), '[]');
END $$;

-- A run goes to one portal, so it may only hold collections from one provider.
CREATE OR REPLACE FUNCTION public.care_admin_create_run(p_collection_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); rid uuid; rnum text; n int; tot int; mn date; mx date; bad int; late int; provs text[];
  earliest date := public.care_add_working_days(public.care_today(), 2);
BEGIN
  IF coalesce(cardinality(p_collection_ids), 0) = 0 THEN RAISE EXCEPTION 'no_collections'; END IF;
  SELECT count(*) INTO bad FROM public.care_collections c
    LEFT JOIN public.care_mandates m ON m.id = c.mandate_id JOIN public.care_subscriptions s ON s.id = c.subscription_id
   WHERE c.id = ANY(p_collection_ids)
     AND (c.status <> 'ready' OR m.status IS DISTINCT FROM 'active' OR s.status NOT IN ('active','pending_mandate')
          OR NOT public.care_notice_ok(c.notice_dedupe, c.due_date));
  IF bad > 0 THEN RAISE EXCEPTION 'only_ready_collections_with_active_mandates_and_delivered_notice (% not ready)', bad; END IF;
  SELECT array_agg(DISTINCT m.provider_code) INTO provs FROM public.care_collections c JOIN public.care_mandates m ON m.id = c.mandate_id WHERE c.id = ANY(p_collection_ids);
  IF cardinality(provs) <> 1 THEN RAISE EXCEPTION 'one_provider_per_run: pick only AccessPay or only FastPay collections'; END IF;
  SELECT count(*) INTO late FROM public.care_collections WHERE id = ANY(p_collection_ids) AND due_date < earliest;
  IF late > 0 THEN RAISE EXCEPTION 'due_date_too_soon: % collection(s) due before % can no longer be submitted; the nightly job will re-notify them', late, earliest; END IF;
  rnum := 'CARE-RUN-' || to_char(now() AT TIME ZONE 'Europe/London', 'YYYYMMDD-HH24MISS') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
  SELECT count(*), sum(amount_minor), min(due_date), max(due_date) INTO n, tot, mn, mx FROM public.care_collections WHERE id = ANY(p_collection_ids);
  INSERT INTO public.care_collection_runs(run_number, provider_code, created_by, item_count, total_minor, earliest_due, latest_due)
  VALUES (rnum, provs[1], uid, n, tot, mn, mx) RETURNING id INTO rid;
  UPDATE public.care_collections SET status = 'in_run', run_id = rid WHERE id = ANY(p_collection_ids);
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'collection_run_created', jsonb_build_object('run_id', rid, 'run_number', rnum, 'count', n, 'total_minor', tot, 'provider', provs[1]));
  RETURN jsonb_build_object('ok', true, 'run_id', rid, 'run_number', rnum, 'provider_code', provs[1],
    'provider_name', (SELECT display_name FROM public.dd_providers WHERE provider_code = provs[1]), 'rows', (
    SELECT jsonb_agg(jsonb_build_object('reference', s.reference, 'account_holder', m.account_holder_name, 'amount', to_char(c.amount_minor / 100.0, 'FM999990.00'),
      'due_date', to_char(c.due_date, 'DD/MM/YYYY'), 'provider_reference', m.provider_reference, 'customer_account', p.account_number,
      'kind', c.kind, 'period', to_char(c.period_start, 'DD/MM/YYYY') || '-' || to_char(c.period_end, 'DD/MM/YYYY')) ORDER BY c.due_date, s.reference)
    FROM public.care_collections c JOIN public.care_subscriptions s ON s.id = c.subscription_id
    JOIN public.care_mandates m ON m.id = c.mandate_id LEFT JOIN public.profiles p ON p.id = s.customer_id WHERE c.run_id = rid));
END $$;

-- Default provider for self-serve sign-ups (phone sales choose per link).
CREATE OR REPLACE FUNCTION public.care_admin_set_default_provider(p_provider text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dd_providers WHERE provider_code = p_provider AND enabled) THEN RAISE EXCEPTION 'invalid_provider'; END IF;
  UPDATE public.care_settings SET provider_code = p_provider, updated_at = now(), updated_by = uid WHERE singleton;
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'settings_changed', jsonb_build_object('default_provider', p_provider));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.care_admin_set_default_provider(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_admin_set_default_provider(text) TO authenticated, service_role;

-- Staff task wording: name the portal generically instead of always "AccessPay".
DO $do$
DECLARE f text; def text;
BEGIN
  FOREACH f IN ARRAY ARRAY['care_pull_from_runs','care_pause_internal','care_nightly','care_submit_application','care_cancel_internal',
    'care_admin_review','care_admin_run_action','care_admin_record_ddi_request'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = f;
    IF def IS NULL OR position('AccessPay' IN def) = 0 THEN CONTINUE; END IF;
    def := replace(def, 'that AccessPay file', 'that DD file');
    def := replace(def, 'the AccessPay file', 'the DD file');
    def := replace(def, 'via AccessPay', 'via its DD provider (AccessPay or FastPay, shown on the mandate)');
    def := replace(def, 'the AccessPay portal', 'its DD portal (AccessPay or FastPay, shown on the mandate)');
    def := replace(def, 'in AccessPay', 'in its DD portal (AccessPay or FastPay, shown on the mandate)');
    EXECUTE def;
  END LOOP;
END $do$;
