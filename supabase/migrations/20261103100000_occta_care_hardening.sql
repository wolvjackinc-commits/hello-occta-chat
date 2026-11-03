-- OCCTA Care hardening (independent review, 3 Nov 2026). No member had joined
-- when this was applied, so every change is safe for live data.
--
--   * Notice counts only once it has actually reached the customer: the email
--     was sent, or the letter was posted (+2 working days for post) or handed
--     to the mail house (+3). Queued is not delivered.
--   * Price and plan changes apply only to periods starting on/after their
--     effective date; nothing is charged at a new price early.
--   * Cancellation and bank cancellations pull collections that are in a run
--     but not yet confirmed at the bank, and runs refuse stale or unsafe rows.
--   * 'paid' only after the return (ARUDD) window; late returns can reverse it.
--   * Re-presentation only for ARUDD 0 (refer to payer); other codes stop for
--     staff review.
--   * Staff can pause Care for a customer; paused members can rejoin.
--   * Welcome call before approval for 75+ customers; DOB asked when unknown.
--   * Reminders and deadlines can't be missed by a skipped nightly run.
--   * Cooling-off ends at the end of the 14th day, London time.
--   * Terms v2: no repair offer (no partner yet); router swap framed against
--     the standard every customer gets.
BEGIN;

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------
INSERT INTO public.care_bank_holidays(holiday, name) VALUES
  ('2029-01-01','New Year''s Day'),('2029-03-30','Good Friday'),('2029-04-02','Easter Monday'),
  ('2029-05-07','Early May bank holiday'),('2029-05-28','Spring bank holiday'),('2029-08-27','Summer bank holiday'),
  ('2029-12-25','Christmas Day'),('2029-12-26','Boxing Day')
ON CONFLICT (holiday) DO NOTHING;

-- "Today" for Care is always the UK calendar day, never UTC.
CREATE OR REPLACE FUNCTION public.care_today() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/London')::date $$;

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
ALTER TABLE public.care_collections ADD COLUMN IF NOT EXISTS notice_dedupe text;
ALTER TABLE public.care_letters ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE public.care_letters ADD COLUMN IF NOT EXISTS mail_house_on date;
ALTER TABLE public.care_letters ADD COLUMN IF NOT EXISTS letter_date date;
ALTER TABLE public.care_letters DROP CONSTRAINT IF EXISTS care_letters_status_check;
ALTER TABLE public.care_letters ADD CONSTRAINT care_letters_status_check
  CHECK (status IN ('rendering','posting','awaiting_print','in_batch','posted','sent_to_mail_house','needs_manual','failed','cancelled'));
ALTER TABLE public.care_subscriptions ADD COLUMN IF NOT EXISTS pending_plan_code text REFERENCES public.care_plans(code);
ALTER TABLE public.care_subscriptions ADD COLUMN IF NOT EXISTS pending_price_minor integer CHECK (pending_price_minor IS NULL OR pending_price_minor > 0);
ALTER TABLE public.care_subscriptions ADD COLUMN IF NOT EXISTS pending_from date;
ALTER TABLE public.care_subscriptions ADD COLUMN IF NOT EXISTS pending_notice_dedupe text;
ALTER TABLE public.care_subscriptions ADD COLUMN IF NOT EXISTS review_task_at timestamptz;
ALTER TABLE public.care_subscriptions ADD COLUMN IF NOT EXISTS welcome_task_at timestamptz;
ALTER TABLE public.care_subscriptions ADD COLUMN IF NOT EXISTS date_of_birth_declared date;
ALTER TABLE public.care_mandates ADD COLUMN IF NOT EXISTS lodge_warned_at timestamptz;
ALTER TABLE public.care_mandates ADD COLUMN IF NOT EXISTS lodge_overdue_at timestamptz;
ALTER TABLE public.care_disputes ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- A paused plan is not a live membership: the customer may join again.
DROP INDEX IF EXISTS public.care_one_live_subscription;
CREATE UNIQUE INDEX care_one_live_subscription ON public.care_subscriptions(customer_id)
  WHERE status IN ('pending_review','pending_mandate','active','cancel_pending');

-- ---------------------------------------------------------------------------
-- Terms version 2 (no member agreed to v1)
-- ---------------------------------------------------------------------------
INSERT INTO public.care_terms_versions(version, effective_from, summary, terms_sha256, rules)
SELECT 'care-2026-11-v2', '2026-11-03T00:00:00Z',
  'OCCTA Care is a support service, not insurance. Care Essentials costs £4.99 a month and Care Plus £8.99 a month, VAT included, paid by its own Direct Debit monthly, every 3 months, or yearly with 2 months free. There is no minimum term and no exit fee: cancel any time by phone, email, letter, chat or in My OCCTA. Nothing is taken until your 14-day cooling-off period has ended. Prepaid plans get a refund for unused time. We give at least 10 working days'' notice before any payment, and 30 days'' notice of any price change, with the right to leave free. Care does not pay for, repair or replace your own devices and doesn''t affect your legal rights.',
  'c98c83b515fb510afdf23fafc0754eae7bae3b6e2339f24eeb334b333d437314',
  rules || '{"represent_after_working_days": 13, "welcome_call_working_days": 5, "standard_router_swap_working_days": 5, "price_change_min_days": 35, "paid_after_working_days": 3, "represent_codes": ["0"]}'::jsonb
FROM public.care_terms_versions WHERE version = 'care-2026-11-v1'
ON CONFLICT (version) DO NOTHING;
UPDATE public.care_settings SET current_terms_version = 'care-2026-11-v2', updated_at = now() WHERE singleton;

-- ---------------------------------------------------------------------------
-- When did a notice actually reach the customer?
-- Email sent = that day. Posted by us = posting day + 2 working days.
-- Handed to the mail house = that day + 3 working days. Otherwise: not yet.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_notice_delivered_on(p_dedupe text) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT least(
    (SELECT (l.email_sent_at AT TIME ZONE 'Europe/London')::date FROM public.care_letters l
      WHERE l.dedupe_key = p_dedupe AND l.email_sent_at IS NOT NULL),
    (SELECT public.care_add_working_days(l.posted_on, 2) FROM public.care_letters l
      WHERE l.dedupe_key = p_dedupe AND l.status = 'posted' AND l.posted_on IS NOT NULL),
    (SELECT public.care_add_working_days(l.mail_house_on, 3) FROM public.care_letters l
      WHERE l.dedupe_key = p_dedupe AND l.status = 'sent_to_mail_house' AND l.mail_house_on IS NOT NULL)
  )
$$;

-- Notice is good for a collection only if it reached the customer at least
-- 10 working days (strictly between) before the due date.
CREATE OR REPLACE FUNCTION public.care_notice_ok(p_dedupe text, p_due date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_dedupe IS NOT NULL AND public.care_notice_delivered_on(p_dedupe) IS NOT NULL
     AND public.care_working_days_between(public.care_notice_delivered_on(p_dedupe), p_due) >= 10
$$;

-- ---------------------------------------------------------------------------
-- Role checks: not callable by anonymous users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_can_see_evidence(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role::text IN ('admin','super_admin','finance_admin','compliance_admin'))
$$;

-- ---------------------------------------------------------------------------
-- Eligibility: paused is not a live membership
-- ---------------------------------------------------------------------------
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
      age := extract(year FROM age(public.care_today(), pr.date_of_birth))::int;
      IF age < 18 THEN reasons := array_append(reasons, 'under_18'); END IF;
      IF age >= 75 THEN review := array_append(review, 'age_extra_check'); END IF;
    END IF;
    IF pr.address_line1 IS NULL OR pr.postcode IS NULL THEN reasons := array_append(reasons, 'no_postal_address'); END IF;
    IF pr.email IS NULL THEN reasons := array_append(reasons, 'no_email'); END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices i WHERE i.user_id = p_customer
             AND (i.status = 'overdue' OR (i.status = 'sent' AND i.due_date < public.care_today() - 3))) THEN
    reasons := array_append(reasons, 'overdue_bill');
  END IF;
  IF EXISTS (SELECT 1 FROM public.care_subscriptions s WHERE s.customer_id = p_customer
             AND s.status IN ('pending_review','pending_mandate','active','cancel_pending')) THEN
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
                            'date_of_birth_known', pr.date_of_birth IS NOT NULL,
                            'no_sales_contact', coalesce('no_sales_contact' = ANY(sn.needs), false));
END $$;

-- Phone-assisted applications respect "no offers, please".
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
  END IF;
  IF p_plan NOT IN ('essentials','plus') OR p_frequency NOT IN ('monthly','quarterly','annual') OR p_day NOT IN (1, 15) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_choice');
  END IF;
  price := public.care_price_minor(p_plan, p_frequency);
  IF price IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'plan_unavailable'); END IF;
  first_date := public.care_first_collection_date(public.care_today(), p_day);
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

-- ---------------------------------------------------------------------------
-- Sign-up
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_submit_application(p_application uuid, p_customer uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  app record; elig jsonb; ver record; vrf record; pr record; sub_id uuid; sub_ref text; mandate_id uuid;
  review text[]; status_ text; cooling timestamptz; hold timestamptz; consent_id uuid; first_end date; first_start date;
  test boolean := coalesce((p->>'is_test')::boolean, false); holder text; surname text; name_match boolean;
  today date := public.care_today(); dob date; age int; ddconf_key text;
BEGIN
  SELECT * INTO app FROM public.care_applications WHERE id = p_application FOR UPDATE;
  IF NOT FOUND OR app.customer_id <> p_customer THEN RETURN jsonb_build_object('ok', false, 'error', 'application_not_found'); END IF;
  IF app.status <> 'draft' THEN RETURN jsonb_build_object('ok', false, 'error', 'application_already_used'); END IF;
  IF app.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'application_expired'); END IF;
  IF app.key_facts_sha256 IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'key_facts_not_shown'); END IF;

  elig := public.care_eligibility(p_customer);
  IF NOT (elig->>'eligible')::boolean THEN RETURN jsonb_build_object('ok', false, 'error', 'not_eligible', 'reasons', elig->'reasons'); END IF;
  IF app.channel = 'phone_assisted' AND coalesce((elig->>'no_sales_contact')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_eligible', 'reasons', jsonb_build_array('no_sales_contact'));
  END IF;

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

  IF public.care_price_minor(app.plan_code, app.frequency) IS DISTINCT FROM app.price_minor THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_changed');
  END IF;

  SELECT full_name, date_of_birth INTO pr FROM public.profiles WHERE id = p_customer;

  -- Date of birth: from the account, or asked on the form when we don't hold it.
  dob := pr.date_of_birth;
  IF dob IS NULL THEN
    BEGIN dob := (p->>'date_of_birth')::date; EXCEPTION WHEN others THEN dob := NULL; END;
    IF dob IS NULL OR dob > today OR dob < date '1900-01-01' THEN RETURN jsonb_build_object('ok', false, 'error', 'date_of_birth_required'); END IF;
  END IF;
  age := extract(year FROM age(today, dob))::int;
  IF age < 18 THEN RETURN jsonb_build_object('ok', false, 'error', 'not_eligible', 'reasons', jsonb_build_array('under_18')); END IF;

  -- Account holder: compare whole words of the OCCTA surname, not substrings.
  holder := ' ' || lower(btrim(regexp_replace(regexp_replace(p->>'account_holder_name', '[^a-zA-Z ]', ' ', 'g'), '\s+', ' ', 'g'))) || ' ';
  surname := lower(substring(btrim(regexp_replace(regexp_replace(coalesce(pr.full_name, ''), '[^a-zA-Z ]', ' ', 'g'), '\s+', ' ', 'g')) FROM '([a-zA-Z]+)$'));
  name_match := coalesce(length(surname), 0) >= 2 AND position(' ' || surname || ' ' IN holder) > 0;

  review := ARRAY(SELECT jsonb_array_elements_text(elig->'review'));
  IF age >= 75 AND NOT ('age_extra_check' = ANY(review)) THEN review := array_append(review, 'age_extra_check'); END IF;
  IF NOT name_match THEN review := array_append(review, 'account_holder_mismatch'); END IF;
  IF app.channel = 'phone_assisted' THEN review := array_append(review, 'phone_assisted'); END IF;
  IF jsonb_typeof(p->'support_needs') = 'array' AND jsonb_array_length(p->'support_needs') > 0
     AND NOT ('support_needs' = ANY(review)) THEN review := array_append(review, 'support_needs'); END IF;

  status_ := CASE WHEN EXISTS (SELECT 1 FROM unnest(review) r WHERE r <> 'phone_assisted') THEN 'pending_review' ELSE 'pending_mandate' END;
  hold := CASE WHEN 'age_extra_check' = ANY(review) THEN now() + interval '48 hours' ELSE NULL END;
  -- Cooling-off runs to the end of the 14th day after today, UK time.
  cooling := ((today + 15)::timestamp AT TIME ZONE 'Europe/London');

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

  -- A paused plan is replaced by the new one.
  UPDATE public.care_subscriptions SET status = 'cancelled', status_reason = 'replaced_by_rejoin', cancelled_at = now(),
    cancel_effective_date = coalesce(cancel_effective_date, today)
   WHERE customer_id = p_customer AND status = 'paused';

  INSERT INTO public.care_subscriptions(customer_id, application_id, plan_code, frequency, price_minor, collection_day, status,
    channel, invite_id, sold_by, terms_version, cooling_off_ends_at, started_early, service_starts_on, first_collection_date,
    review_reasons, review_hold_until, next_usage_reminder_on, welcome_call_due_on, date_of_birth_declared, is_test)
  VALUES (p_customer, app.id, app.plan_code, app.frequency, app.price_minor, app.collection_day, status_,
    app.channel, app.invite_id, (SELECT created_by FROM public.care_invites WHERE id = app.invite_id), app.terms_version, cooling,
    coalesce((p->>'tick_early_start')::boolean, false),
    CASE WHEN coalesce((p->>'tick_early_start')::boolean, false) THEN today ELSE today + 15 END,
    app.first_collection_date, review, hold,
    CASE WHEN app.frequency = 'monthly' THEN (today + interval '6 months')::date ELSE NULL END,
    -- Every reviewed or phone-assisted sale gets a welcome call within 5 working days.
    CASE WHEN cardinality(review) > 0 THEN public.care_add_working_days(today, 5) ELSE NULL END,
    CASE WHEN pr.date_of_birth IS NULL THEN dob ELSE NULL END, test)
  RETURNING id, reference INTO sub_id, sub_ref;

  IF pr.date_of_birth IS NULL THEN
    UPDATE public.profiles SET date_of_birth = dob WHERE id = p_customer AND date_of_birth IS NULL;
  END IF;

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
      'date_of_birth_source', CASE WHEN pr.date_of_birth IS NULL THEN 'declared_on_form' ELSE 'account' END,
      'first_collection_date', app.first_collection_date, 'cooling_off_ends_at', cooling))
  RETURNING id INTO consent_id;

  INSERT INTO public.care_mandates(subscription_id, customer_id, reference, provider_code, status, account_holder_name, bank_name,
    masked_account_last4, masked_sort_last2, bank_details_ciphertext, enc_nonce, enc_key_id, enc_alg, signed_at, lodge_due_by, is_test)
  VALUES (sub_id, p_customer, sub_ref, (SELECT provider_code FROM public.care_settings WHERE singleton),
    CASE WHEN status_ = 'pending_review' THEN 'on_hold' ELSE 'awaiting_lodgement' END,
    left(p->>'account_holder_name', 120), left(p->>'bank_name', 120), p->>'masked_account_last4', p->>'masked_sort_last2',
    decode(regexp_replace(p->>'bank_ciphertext', '^\\x', ''), 'hex'), decode(regexp_replace(p->>'bank_nonce', '^\\x', ''), 'hex'),
    p->>'enc_key_id', 'AES-256-GCM', now(), public.care_add_working_days(today, 10), test)
  RETURNING id INTO mandate_id;

  -- Pending-review sales get NO payment date yet: their advance notice goes out on approval.
  ddconf_key := 'ddconf:' || sub_id;
  first_start := make_date(extract(year FROM app.first_collection_date)::int, extract(month FROM app.first_collection_date)::int, app.collection_day);
  first_end := (first_start + make_interval(months => public.care_period_months(app.frequency)) - interval '1 day')::date;
  INSERT INTO public.care_collections(subscription_id, mandate_id, kind, due_date, amount_minor, period_start, period_end,
    notice_sent_at, notice_kind, notice_dedupe, is_test)
  VALUES (sub_id, mandate_id, 'first', app.first_collection_date, app.price_minor, first_start, first_end,
    CASE WHEN status_ = 'pending_review' THEN NULL ELSE now() END,
    CASE WHEN status_ = 'pending_review' THEN NULL ELSE 'dd_confirmation' END,
    CASE WHEN status_ = 'pending_review' THEN NULL ELSE ddconf_key END, test);

  UPDATE public.care_applications SET status = 'submitted', submitted_at = now() WHERE id = app.id;
  UPDATE public.care_verifications SET consumed_at = now() WHERE id = vrf.id;
  IF app.invite_id IS NOT NULL THEN UPDATE public.care_invites SET used_at = now() WHERE id = app.invite_id; END IF;

  PERFORM public.care_log(sub_id, p_customer, 'customer', p_customer, 'joined',
    jsonb_build_object('reference', sub_ref, 'consent_id', consent_id, 'status', status_, 'review', to_jsonb(review), 'channel', app.channel));

  PERFORM public.care_queue(sub_id, 'welcome_pack', jsonb_build_object('plan_code', app.plan_code, 'frequency', app.frequency,
    'price_minor', app.price_minor, 'collection_day', app.collection_day, 'first_collection_date', app.first_collection_date,
    'cooling_off_ends_on', today + 14, 'started_early', coalesce((p->>'tick_early_start')::boolean, false),
    'terms_version', app.terms_version, 'pending_review', status_ = 'pending_review'), 'welcome:' || sub_id);
  PERFORM public.care_queue(sub_id, 'dd_confirmation', jsonb_build_object('price_minor', app.price_minor, 'frequency', app.frequency,
    'collection_day', app.collection_day, 'first_collection_date', app.first_collection_date, 'pending_review', status_ = 'pending_review',
    'account_holder_name', left(p->>'account_holder_name', 120), 'masked_account_last4', p->>'masked_account_last4',
    'masked_sort_last2', p->>'masked_sort_last2', 'bank_name', p->>'bank_name'), ddconf_key);

  IF status_ = 'pending_review' THEN
    PERFORM public.care_task(p_customer, 'OCCTA Care review — ' || sub_ref,
      'Check Care is right for this customer before the mandate is lodged. Reasons: ' || array_to_string(review, ', ') ||
      CASE WHEN hold IS NOT NULL THEN '. 48-hour pause until ' || to_char(hold AT TIME ZONE 'Europe/London', 'DD Mon YYYY HH24:MI') ||
        ' — call the customer and record the welcome call before approving.' ELSE '.' END ||
      ' Approve or decline in Admin → OCCTA Care. The mandate must be lodged by ' || to_char(public.care_add_working_days(today, 10), 'DD Mon YYYY') || '.',
      'high', public.care_add_working_days(today, 3));
  ELSE
    PERFORM public.care_task(p_customer, 'Lodge OCCTA Care mandate — ' || sub_ref,
      'Lodge this Care Direct Debit in the AccessPay portal under reference ' || sub_ref ||
      ' (separate from any broadband mandate), then mark it lodged in Admin → OCCTA Care → Direct Debit. Bacs deadline: ' ||
      to_char(public.care_add_working_days(today, 10), 'DD Mon YYYY') || '.', 'high', public.care_add_working_days(today, 8));
  END IF;

  RETURN jsonb_build_object('ok', true, 'subscription_id', sub_id, 'reference', sub_ref, 'status', status_,
    'first_collection_date', app.first_collection_date, 'cooling_off_ends_on', today + 14, 'price_minor', app.price_minor);
END $$;

-- ---------------------------------------------------------------------------
-- Cancellation: pull anything not yet confirmed at the bank
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_pull_from_runs(p_sub uuid, p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; n int := 0; runs text;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  SELECT string_agg(DISTINCT r.run_number, ', '), count(*) INTO runs, n
    FROM public.care_collections c JOIN public.care_collection_runs r ON r.id = c.run_id
   WHERE c.subscription_id = p_sub AND c.status = 'in_run';
  IF coalesce(n, 0) = 0 THEN RETURN 0; END IF;
  UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'pulled_from_run:' || p_reason
   WHERE subscription_id = p_sub AND status = 'in_run';
  PERFORM public.care_task(s.customer_id, 'URGENT: remove ' || s.reference || ' from Care run ' || runs,
    'Care for ' || s.reference || ' was cancelled (' || p_reason || ') while a payment was in run ' || runs ||
    '. Remove ' || s.reference || ' from that AccessPay file before submitting it. If the file was already submitted, use "Collected anyway" on the collection in Admin → OCCTA Care → Collections so the customer is refunded in full.',
    'urgent', public.care_today());
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.care_cancel_internal(p_sub uuid, p_channel text, p_reason text, p_actor_type text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; c record; cur record; today date := public.care_today(); end_date date := public.care_today();
  refund_minor integer := 0; refunds jsonb := '[]'; total_days integer; unused integer; amt integer; in_cooling boolean; pulled int;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF s.status IN ('cancelled','declined') THEN RETURN jsonb_build_object('ok', true, 'already', true, 'status', s.status); END IF;
  IF s.status = 'cancel_pending' AND p_channel <> 'bank' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', s.status, 'effective_date', s.cancel_effective_date);
  END IF;
  in_cooling := now() < s.cooling_off_ends_at;

  -- Nothing confirmed at the bank is taken after a cancellation.
  pulled := public.care_pull_from_runs(s.id, 'cancelled_' || p_channel);

  -- Current period = a collection actually sent to the bank (or paid) whose period covers today.
  SELECT * INTO cur FROM public.care_collections
   WHERE subscription_id = s.id AND status IN ('submitted','paid') AND period_start <= today AND period_end >= today
   ORDER BY period_start DESC LIMIT 1;

  IF FOUND THEN
    IF s.frequency = 'monthly' THEN
      end_date := cur.period_end;
    ELSE
      total_days := cur.period_end - cur.period_start + 1;
      unused := cur.period_end - today;
      amt := floor(cur.amount_minor::numeric * unused / total_days)::int;
      IF amt > 0 THEN
        INSERT INTO public.care_refunds(subscription_id, collection_id, amount_minor, reason, status, due_by, created_by)
        VALUES (s.id, cur.id, amt, 'Unused ' || unused || ' of ' || total_days || ' days after cancellation',
                CASE WHEN cur.status = 'paid' THEN 'to_pay' ELSE 'awaiting_collection' END, today + 14, p_actor)
        ON CONFLICT DO NOTHING;
        refund_minor := refund_minor + amt;
        refunds := refunds || jsonb_build_object('amount_minor', amt, 'reason', 'unused_time');
      END IF;
      end_date := today;
    END IF;
  END IF;

  -- A later period already at the bank is refunded in full.
  FOR c IN SELECT * FROM public.care_collections WHERE subscription_id = s.id AND status IN ('submitted','paid')
           AND period_start > today LOOP
    INSERT INTO public.care_refunds(subscription_id, collection_id, amount_minor, reason, status, due_by, created_by)
    VALUES (s.id, c.id, c.amount_minor, 'Payment for a period after cancellation',
            CASE WHEN c.status = 'paid' THEN 'to_pay' ELSE 'awaiting_collection' END, greatest(c.due_date, today) + 14, p_actor)
    ON CONFLICT DO NOTHING;
    refund_minor := refund_minor + c.amount_minor;
    refunds := refunds || jsonb_build_object('amount_minor', c.amount_minor, 'reason', 'future_period');
  END LOOP;

  UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'subscription_cancelled'
   WHERE subscription_id = s.id AND status IN ('scheduled','ready');

  UPDATE public.care_subscriptions SET
    status = CASE WHEN end_date > today THEN 'cancel_pending' ELSE 'cancelled' END,
    status_reason = 'cancelled_' || p_channel,
    cancel_requested_at = coalesce(cancel_requested_at, now()),
    cancel_channel = CASE WHEN in_cooling AND p_channel IN ('portal','phone','email','letter','chat') THEN 'in_cooling_off' ELSE p_channel END,
    cancel_reason = left(p_reason, 1000), cancel_effective_date = end_date,
    cancelled_at = CASE WHEN end_date > today THEN NULL ELSE now() END, cancelled_by = p_actor,
    pending_plan_code = NULL, pending_price_minor = NULL, pending_from = NULL, pending_notice_dedupe = NULL
   WHERE id = s.id;

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
        'high', public.care_add_working_days(today, 1));
    END IF;
  END IF;

  UPDATE public.care_mandates SET bank_details_ciphertext = NULL, enc_nonce = NULL, ciphertext_purged_at = now()
   WHERE subscription_id = s.id AND status = 'cancelled' AND lodged_at IS NULL AND ciphertext_purged_at IS NULL;

  PERFORM public.care_log(s.id, s.customer_id, p_actor_type, p_actor, 'cancelled',
    jsonb_build_object('channel', p_channel, 'reason', p_reason, 'effective_date', end_date, 'refund_minor', refund_minor,
      'in_cooling_off', in_cooling, 'pulled_from_run', pulled));
  PERFORM public.care_queue(s.id, 'cancellation_confirmation', jsonb_build_object('effective_date', end_date,
    'refund_minor', refund_minor, 'refunds', refunds, 'in_cooling_off', in_cooling, 'channel', p_channel, 'frequency', s.frequency),
    'cancel:' || s.id);
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN end_date > today THEN 'cancel_pending' ELSE 'cancelled' END,
    'effective_date', end_date, 'refund_minor', refund_minor);
END $$;

-- ---------------------------------------------------------------------------
-- Pause (customer asked, e.g. money is tight; or after missed payments)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_pause_internal(p_sub uuid, p_reason text, p_reason_code text, p_actor_type text, p_actor uuid, p_dedupe text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; amt int;
BEGIN
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.status NOT IN ('active','pending_mandate','pending_review') THEN RETURN jsonb_build_object('ok', false, 'error', 'not_pausable'); END IF;
  PERFORM public.care_pull_from_runs(s.id, 'paused');
  SELECT amount_minor INTO amt FROM public.care_collections WHERE subscription_id = s.id ORDER BY due_date DESC LIMIT 1;
  UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'paused_' || p_reason
   WHERE subscription_id = s.id AND status IN ('scheduled','ready');
  UPDATE public.care_subscriptions SET status = 'paused', status_reason = p_reason,
    pending_plan_code = NULL, pending_price_minor = NULL, pending_from = NULL, pending_notice_dedupe = NULL WHERE id = s.id;
  IF p_reason = 'bank_instruction_ended' THEN
    UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = now(), cancel_source = 'bank_addacs', cancel_reason_code = 'ARUDD ' || p_reason_code
     WHERE subscription_id = s.id AND status IN ('active','lodged');
  ELSE
    UPDATE public.care_mandates SET status = CASE WHEN status IN ('on_hold','awaiting_lodgement') THEN 'cancelled' ELSE 'cancel_requested' END,
      cancel_requested_at = now(), cancelled_at = CASE WHEN status IN ('on_hold','awaiting_lodgement') THEN now() ELSE NULL END, cancel_source = 'occta'
     WHERE subscription_id = s.id AND status IN ('on_hold','awaiting_lodgement','active','lodged');
    IF EXISTS (SELECT 1 FROM public.care_mandates WHERE subscription_id = s.id AND status = 'cancel_requested') THEN
      PERFORM public.care_task(s.customer_id, 'Cancel paused OCCTA Care mandate — ' || s.reference,
        'Care is paused (' || p_reason || '). Cancel ' || s.reference || ' in AccessPay so nothing else is collected, then mark it cancelled.',
        'high', public.care_add_working_days(public.care_today(), 1));
    END IF;
  END IF;
  PERFORM public.care_log(s.id, s.customer_id, p_actor_type, p_actor, 'paused', jsonb_build_object('reason', p_reason, 'reason_code', p_reason_code));
  PERFORM public.care_queue(s.id, 'service_paused', jsonb_build_object('amount_minor', amt, 'reason_code', p_reason_code,
    'reason', CASE p_reason WHEN 'bank_instruction_ended' THEN 'instruction_ended' WHEN 'customer_request' THEN 'customer_request' ELSE 'missed_payments' END),
    p_dedupe);
  RETURN jsonb_build_object('ok', true, 'status', 'paused');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_pause(p_sub uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false);
BEGIN
  IF length(coalesce(btrim(p_note), '')) < 5 THEN RAISE EXCEPTION 'note_required'; END IF;
  PERFORM public.care_log(p_sub, (SELECT customer_id FROM public.care_subscriptions WHERE id = p_sub), 'staff', uid, 'pause_requested', jsonb_build_object('note', p_note));
  RETURN public.care_pause_internal(p_sub, 'customer_request', NULL, 'staff', uid, 'paused:request:' || p_sub || ':' || extract(epoch FROM now())::bigint);
END $$;

-- ---------------------------------------------------------------------------
-- Plan change: from the start of the next period, never mid-period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_my_change_plan(p_plan text, p_agree boolean, p_key_facts jsonb, p_key_facts_sha text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s record; newp integer; c record; lastc record; ver record; eff date; key text; due date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF NOT coalesce(p_agree, false) THEN RETURN jsonb_build_object('ok', false, 'error', 'agreement_required'); END IF;
  IF p_key_facts_sha !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'key_facts_required'); END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE customer_id = uid AND status IN ('pending_mandate','active') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_active_care'); END IF;
  IF p_plan = coalesce(s.pending_plan_code, s.plan_code) THEN RETURN jsonb_build_object('ok', false, 'error', 'same_plan'); END IF;
  IF s.pending_from IS NOT NULL AND s.pending_plan_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_change_pending');
  END IF;
  newp := public.care_price_minor(p_plan, s.frequency);
  IF newp IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'plan_unavailable'); END IF;

  -- The first period that hasn't gone to the bank and is far enough away for notice.
  SELECT * INTO c FROM public.care_collections WHERE subscription_id = s.id AND kind <> 'represent' AND status = 'scheduled'
    AND public.care_working_days_between(public.care_today(), due_date) >= 12 ORDER BY due_date LIMIT 1;
  IF c.id IS NOT NULL THEN
    eff := c.period_start; due := c.due_date;
  ELSE
    SELECT * INTO lastc FROM public.care_collections WHERE subscription_id = s.id AND kind <> 'represent' AND status <> 'cancelled'
      ORDER BY period_start DESC LIMIT 1;
    eff := coalesce(lastc.period_end + 1, s.first_collection_date);
    due := NULL;
  END IF;
  key := 'planchange:' || s.id || ':' || extract(epoch FROM now())::bigint;

  SELECT * INTO ver FROM public.care_terms_versions WHERE version = s.terms_version;
  INSERT INTO public.care_consents(subscription_id, customer_id, kind, terms_version, terms_sha256, key_facts, key_facts_sha256,
    key_facts_shown_at, plan_code, frequency, price_minor, collection_day, ticked_terms_at, declared_over_18, channel, ip, user_agent, snapshot)
  VALUES (s.id, uid, 'plan_change', s.terms_version, ver.terms_sha256, coalesce(p_key_facts, '[]'), p_key_facts_sha, now(), p_plan,
    s.frequency, newp, s.collection_day, now(), true, 'portal', public.care_request_header('x-forwarded-for'),
    left(public.care_request_header('user-agent'), 500),
    jsonb_build_object('from_plan', s.plan_code, 'from_price_minor', s.price_minor, 'effective_from', eff, 'first_due', due));

  UPDATE public.care_subscriptions SET pending_plan_code = p_plan, pending_price_minor = newp, pending_from = eff, pending_notice_dedupe = key
   WHERE id = s.id;
  UPDATE public.care_collections SET amount_minor = newp, notice_sent_at = now(), notice_kind = 'change_notice', notice_dedupe = key
   WHERE subscription_id = s.id AND kind <> 'represent' AND status = 'scheduled' AND period_start >= eff;

  PERFORM public.care_log(s.id, uid, 'customer', uid, 'plan_change_requested', jsonb_build_object('from', s.plan_code, 'to', p_plan, 'price_minor', newp, 'effective_from', eff));
  PERFORM public.care_queue(s.id, 'change_notice', jsonb_build_object('kind', 'plan_change', 'from_plan', s.plan_code, 'to_plan', p_plan,
    'old_price_minor', s.price_minor, 'new_price_minor', newp, 'frequency', s.frequency, 'effective_date', eff, 'due_date', due), key);
  RETURN jsonb_build_object('ok', true, 'new_price_minor', newp, 'effective_date', eff);
END $$;

-- ---------------------------------------------------------------------------
-- Price change for existing members: applies to periods from the effective date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_admin_schedule_price_change(p_plan text, p_frequency text, p_new_minor integer, p_effective date, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); s record; n int := 0; pcid uuid; old int; key text;
BEGIN
  -- 30 days' notice plus up to 5 days for printing and post.
  IF p_effective < public.care_today() + 35 THEN RAISE EXCEPTION 'effective_date_must_be_at_least_35_days_away'; END IF;
  IF length(coalesce(btrim(p_reason), '')) < 10 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF coalesce(p_new_minor, 0) <= 0 THEN RAISE EXCEPTION 'price_required'; END IF;
  SELECT price_minor INTO old FROM public.care_subscriptions WHERE plan_code = p_plan AND frequency = p_frequency AND status IN ('pending_review','pending_mandate','active') LIMIT 1;
  INSERT INTO public.care_price_changes(plan_code, frequency, old_price_minor, new_price_minor, effective_from, reason, created_by)
  VALUES (p_plan, p_frequency, coalesce(old, 0), p_new_minor, p_effective, p_reason, uid) RETURNING id INTO pcid;
  FOR s IN SELECT * FROM public.care_subscriptions WHERE plan_code = p_plan AND frequency = p_frequency
           AND status IN ('pending_review','pending_mandate','active') AND pending_from IS NULL FOR UPDATE LOOP
    key := 'price:' || pcid || ':' || s.id;
    UPDATE public.care_subscriptions SET pending_price_minor = p_new_minor, pending_from = p_effective, pending_notice_dedupe = key WHERE id = s.id;
    UPDATE public.care_collections SET amount_minor = p_new_minor, notice_sent_at = now(), notice_kind = 'price_change', notice_dedupe = key
     WHERE subscription_id = s.id AND kind <> 'represent' AND status IN ('scheduled','ready') AND period_start >= p_effective;
    PERFORM public.care_queue(s.id, 'change_notice', jsonb_build_object('kind', 'price_change', 'old_price_minor', s.price_minor,
      'new_price_minor', p_new_minor, 'frequency', s.frequency, 'effective_date', p_effective, 'reason', p_reason), key);
    PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'price_change_notified', jsonb_build_object('price_change_id', pcid, 'from', s.price_minor, 'to', p_new_minor, 'effective', p_effective));
    n := n + 1;
  END LOOP;
  UPDATE public.care_price_changes SET affected = n WHERE id = pcid;
  RETURN jsonb_build_object('ok', true, 'affected', n,
    'skipped_with_change_pending', (SELECT count(*) FROM public.care_subscriptions WHERE plan_code = p_plan AND frequency = p_frequency
       AND status IN ('pending_review','pending_mandate','active') AND pending_from IS NOT NULL AND pending_notice_dedupe NOT LIKE 'price:' || pcid || ':%'));
END $$;

-- New-join prices must match the published terms: changing them needs a new terms version.
CREATE OR REPLACE FUNCTION public.care_admin_set_plan_price(p_plan text, p_monthly_minor integer, p_active boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); old int;
BEGIN
  SELECT monthly_minor INTO old FROM public.care_plans WHERE code = p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_monthly_minor IS DISTINCT FROM old THEN RAISE EXCEPTION 'price_is_in_the_published_terms: publish a new terms version first'; END IF;
  UPDATE public.care_plans SET active = p_active, updated_at = now(), updated_by = uid WHERE code = p_plan;
  PERFORM public.care_log(NULL, NULL, 'staff', uid, 'plan_availability_set', jsonb_build_object('plan', p_plan, 'active', p_active));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------------------------
-- Review: 75+ need a recorded welcome call; first payment notice on approval
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_admin_review(p_sub uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record; c record; today date := public.care_today(); due date; nominal date; key text; lodge date;
BEGIN
  IF p_decision NOT IN ('approve','decline') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF length(coalesce(btrim(p_note), '')) < 10 THEN RAISE EXCEPTION 'note_required_min_10_chars'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub FOR UPDATE;
  IF NOT FOUND OR s.status <> 'pending_review' THEN RAISE EXCEPTION 'not_awaiting_review'; END IF;
  IF p_decision = 'approve' THEN
    IF s.review_hold_until IS NOT NULL AND s.review_hold_until > now() THEN RAISE EXCEPTION 'pause_not_over_until_%', s.review_hold_until; END IF;
    IF 'age_extra_check' = ANY(s.review_reasons) AND s.welcome_call_done_at IS NULL THEN RAISE EXCEPTION 'record_the_welcome_call_first'; END IF;
    SELECT lodge_due_by INTO lodge FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1;
    IF lodge < today THEN RAISE EXCEPTION 'lodging_deadline_passed: decline and ask the customer to join again'; END IF;
    UPDATE public.care_subscriptions SET status = 'pending_mandate', reviewed_at = now(), reviewed_by = uid, review_note = p_note,
      welcome_call_due_on = CASE WHEN welcome_call_done_at IS NULL THEN public.care_add_working_days(today, 5) ELSE welcome_call_due_on END
     WHERE id = s.id;
    UPDATE public.care_mandates SET status = 'awaiting_lodgement' WHERE subscription_id = s.id AND status = 'on_hold';
    -- First payment: at least 15 working days from today, so notice can be posted and lodging completed.
    SELECT * INTO c FROM public.care_collections WHERE subscription_id = s.id AND kind = 'first' AND status = 'scheduled' LIMIT 1;
    IF c.id IS NOT NULL THEN
      nominal := greatest(c.period_start, public.care_day_on_or_after(greatest(public.care_add_working_days(today, 15), s.cooling_off_ends_at::date), s.collection_day));
      due := public.care_next_working_day(nominal);
      key := 'firstnotice:' || c.id;
      UPDATE public.care_collections SET due_date = due, period_start = nominal,
        period_end = (nominal + make_interval(months => public.care_period_months(s.frequency)) - interval '1 day')::date,
        notice_sent_at = now(), notice_kind = 'advance_notice', notice_dedupe = key WHERE id = c.id;
      UPDATE public.care_subscriptions SET first_collection_date = due WHERE id = s.id;
      PERFORM public.care_queue(s.id, 'advance_notice', jsonb_build_object('due_date', due, 'amount_minor', c.amount_minor,
        'period_start', nominal, 'period_end', (nominal + make_interval(months => public.care_period_months(s.frequency)) - interval '1 day')::date,
        'frequency', s.frequency, 'kind', 'first'), key);
    END IF;
    PERFORM public.care_task(s.customer_id, 'Lodge OCCTA Care mandate — ' || s.reference,
      'Review approved. Lodge ' || s.reference || ' in AccessPay by ' || to_char(lodge, 'DD Mon YYYY') || '.', 'high', lodge);
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

-- Welcome calls can be recorded at any stage, including before approval.
CREATE OR REPLACE FUNCTION public.care_admin_welcome_call(p_sub uuid, p_outcome text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record;
BEGIN
  IF p_outcome NOT IN ('confirmed','wants_to_cancel','no_answer') THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.status NOT IN ('pending_review','pending_mandate','active') THEN RAISE EXCEPTION 'not_live'; END IF;
  IF p_outcome = 'confirmed' THEN UPDATE public.care_subscriptions SET welcome_call_done_at = now() WHERE id = s.id; END IF;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'welcome_call_' || p_outcome, jsonb_build_object('note', p_note));
  IF p_outcome = 'wants_to_cancel' THEN
    IF s.status = 'pending_review' THEN
      RETURN public.care_admin_review(s.id, 'decline', 'Customer chose not to go ahead on the welcome call: ' || coalesce(p_note, '-'));
    END IF;
    RETURN public.care_cancel_internal(s.id, 'phone', coalesce(p_note, 'Cancelled on welcome call'), 'staff', uid);
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------------------------
-- Mandates: the Bacs lodging deadline is a hard stop
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_admin_mandate_action(p_mandate uuid, p_action text, p_provider_ref text DEFAULT NULL,
  p_reason text DEFAULT NULL, p_effective date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); m record; s record;
BEGIN
  SELECT * INTO m FROM public.care_mandates WHERE id = p_mandate FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = m.subscription_id FOR UPDATE;
  IF p_action = 'lodged' THEN
    IF m.status <> 'awaiting_lodgement' THEN RAISE EXCEPTION 'mandate_not_awaiting_lodgement'; END IF;
    IF s.status <> 'pending_mandate' THEN RAISE EXCEPTION 'subscription_not_ready_for_lodging'; END IF;
    IF coalesce(p_effective, public.care_today()) > m.lodge_due_by THEN
      RAISE EXCEPTION 'lodging_deadline_passed (%): cancel this sale and ask the customer to join again', m.lodge_due_by;
    END IF;
    UPDATE public.care_mandates SET status = 'lodged', lodged_at = coalesce(p_effective::timestamptz, now()), lodged_by = uid,
      provider_reference = nullif(btrim(p_provider_ref), '') WHERE id = m.id;
  ELSIF p_action = 'active' THEN
    IF m.status <> 'lodged' THEN RAISE EXCEPTION 'mark_it_lodged_first'; END IF;
    UPDATE public.care_mandates SET status = 'active', activated_at = now(), activated_by = uid,
      provider_reference = coalesce(nullif(btrim(p_provider_ref), ''), provider_reference) WHERE id = m.id;
    UPDATE public.care_subscriptions SET status = 'active' WHERE id = s.id AND status = 'pending_mandate';
    UPDATE public.care_collections SET mandate_id = m.id WHERE subscription_id = s.id AND status = 'scheduled';
  ELSIF p_action = 'rejected' THEN
    IF length(coalesce(btrim(p_reason), '')) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
    UPDATE public.care_mandates SET status = 'rejected', rejected_at = now(), rejection_reason = p_reason, cancel_source = 'rejected' WHERE id = m.id;
    PERFORM public.care_pull_from_runs(s.id, 'mandate_rejected');
    UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'mandate_rejected' WHERE subscription_id = s.id AND status IN ('scheduled','ready');
    UPDATE public.care_subscriptions SET status = 'cancelled', status_reason = 'mandate_rejected', cancelled_at = now(), cancelled_by = uid,
      cancel_channel = 'bank', cancel_effective_date = public.care_today() WHERE id = s.id;
    PERFORM public.care_queue(s.id, 'mandate_cancelled', jsonb_build_object('kind', 'rejected', 'reason', p_reason, 'nothing_collected',
      NOT EXISTS (SELECT 1 FROM public.care_collections WHERE subscription_id = s.id AND status = 'paid')), 'rejected:' || m.id);
  ELSIF p_action = 'cancelled' THEN
    IF m.status NOT IN ('cancel_requested','active','lodged') THEN RAISE EXCEPTION 'mandate_not_cancellable'; END IF;
    UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = now(),
      cancel_source = coalesce(cancel_source, 'occta'), cancel_reason_code = coalesce(p_reason, cancel_reason_code) WHERE id = m.id;
    PERFORM public.care_pull_from_runs(s.id, 'mandate_cancelled');
    UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'mandate_cancelled' WHERE subscription_id = s.id AND status IN ('scheduled','ready');
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'mandate_' || p_action,
    jsonb_build_object('mandate_id', m.id, 'provider_reference', p_provider_ref, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_record_bank_cancellation(p_mandate uuid, p_reason_code text, p_received date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); m record; s record; r jsonb;
BEGIN
  SELECT * INTO m FROM public.care_mandates WHERE id = p_mandate FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = m.subscription_id;
  UPDATE public.care_mandates SET status = 'cancelled', cancelled_at = coalesce(p_received::timestamptz, now()), cancel_source = 'bank_addacs',
    cancel_reason_code = p_reason_code WHERE id = m.id;
  PERFORM public.care_pull_from_runs(s.id, 'addacs');
  UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'mandate_cancelled_by_bank'
   WHERE subscription_id = s.id AND status IN ('scheduled','ready');
  PERFORM public.care_log(s.id, s.customer_id, 'bank', NULL, 'mandate_cancelled_addacs',
    jsonb_build_object('reason_code', p_reason_code, 'received', p_received, 'recorded_by', uid));
  IF s.status IN ('pending_review','pending_mandate','active','paused','cancel_pending') THEN
    r := public.care_cancel_internal(s.id, 'bank', 'Direct Debit cancelled at the bank (ADDACS ' || coalesce(p_reason_code, '?') || ')', 'staff', uid);
  ELSE
    r := jsonb_build_object('ok', true, 'already', true);
  END IF;
  PERFORM public.care_queue(s.id, 'mandate_cancelled', jsonb_build_object('kind', 'bank_cancelled', 'reason_code', p_reason_code,
    'effective_date', r->>'effective_date'), 'addacs:' || m.id);
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- Collection runs: never stale, never on a dead mandate or member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_admin_create_run(p_collection_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); rid uuid; rnum text; n int; tot int; mn date; mx date; bad int; late int;
  earliest date := public.care_add_working_days(public.care_today(), 2);
BEGIN
  IF coalesce(cardinality(p_collection_ids), 0) = 0 THEN RAISE EXCEPTION 'no_collections'; END IF;
  SELECT count(*) INTO bad FROM public.care_collections c
    LEFT JOIN public.care_mandates m ON m.id = c.mandate_id JOIN public.care_subscriptions s ON s.id = c.subscription_id
   WHERE c.id = ANY(p_collection_ids)
     AND (c.status <> 'ready' OR m.status IS DISTINCT FROM 'active' OR s.status NOT IN ('active','pending_mandate')
          OR NOT public.care_notice_ok(c.notice_dedupe, c.due_date));
  IF bad > 0 THEN RAISE EXCEPTION 'only_ready_collections_with_active_mandates_and_delivered_notice (% not ready)', bad; END IF;
  SELECT count(*) INTO late FROM public.care_collections WHERE id = ANY(p_collection_ids) AND due_date < earliest;
  IF late > 0 THEN RAISE EXCEPTION 'due_date_too_soon: % collection(s) due before % can no longer be submitted; the nightly job will re-notify them', late, earliest; END IF;
  rnum := 'CARE-RUN-' || to_char(now() AT TIME ZONE 'Europe/London', 'YYYYMMDD-HH24MISS') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
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
DECLARE uid uuid := public.care_require(true); r record; bad text; pulled jsonb;
BEGIN
  SELECT * INTO r FROM public.care_collection_runs WHERE id = p_run FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.submitted_confirmed_at IS NOT NULL OR r.voided_at IS NOT NULL THEN RAISE EXCEPTION 'run_already_closed'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('collection_id', c.id, 'reference', s.reference, 'amount_minor', c.amount_minor, 'reason', c.cancelled_reason)), '[]')
    INTO pulled FROM public.care_collections c JOIN public.care_subscriptions s ON s.id = c.subscription_id
   WHERE c.run_id = r.id AND c.status = 'cancelled' AND c.cancelled_reason LIKE 'pulled_from_run:%';
  IF p_action = 'submitted' THEN
    SELECT string_agg(s.reference, ', ') INTO bad FROM public.care_collections c
      JOIN public.care_subscriptions s ON s.id = c.subscription_id LEFT JOIN public.care_mandates m ON m.id = c.mandate_id
     WHERE c.run_id = r.id AND c.status = 'in_run'
       AND (m.status IS DISTINCT FROM 'active' OR s.status NOT IN ('active','pending_mandate')
            OR c.due_date < public.care_add_working_days(public.care_today(), 2));
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'run_has_unsafe_items: % — void this run and create a new one', bad;
    END IF;
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
  RETURN jsonb_build_object('ok', true, 'pulled', pulled,
    'warning', CASE WHEN jsonb_array_length(pulled) > 0 THEN 'These were cancelled after the file was made. Make sure they were removed from the AccessPay file; if they were collected anyway, use "Collected anyway" so the customer is refunded.' ELSE NULL END);
END $$;

-- A pulled item that the bank collected anyway: put it back on the books and refund it in full.
CREATE OR REPLACE FUNCTION public.care_admin_pulled_item_collected(p_collection uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); c record; s record; r record;
BEGIN
  IF length(coalesce(btrim(p_note), '')) < 5 THEN RAISE EXCEPTION 'note_required'; END IF;
  SELECT * INTO c FROM public.care_collections WHERE id = p_collection FOR UPDATE;
  IF NOT FOUND OR c.status <> 'cancelled' OR c.cancelled_reason NOT LIKE 'pulled_from_run:%' THEN RAISE EXCEPTION 'not_a_pulled_collection'; END IF;
  SELECT * INTO r FROM public.care_collection_runs WHERE id = c.run_id;
  IF r.submitted_confirmed_at IS NULL THEN RAISE EXCEPTION 'run_not_submitted'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = c.subscription_id;
  UPDATE public.care_collections SET status = 'submitted', submitted_at = r.submitted_confirmed_at, submitted_by = uid,
    cancelled_reason = c.cancelled_reason || ' (collected anyway)' WHERE id = c.id;
  INSERT INTO public.care_refunds(subscription_id, collection_id, amount_minor, reason, status, due_by, created_by)
  VALUES (s.id, c.id, c.amount_minor, 'Collected after the customer cancelled: full refund', 'awaiting_collection', c.due_date + 14, uid)
  ON CONFLICT DO NOTHING;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'pulled_item_collected', jsonb_build_object('collection_id', c.id, 'note', p_note));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------------------------
-- Results: paid only after the return window; late returns reverse 'paid';
-- automatic re-try only for ARUDD 0 (refer to payer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_admin_record_result(p_collection uuid, p_outcome text, p_bank_received date DEFAULT NULL,
  p_reason_code text DEFAULT NULL, p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(true); c record; s record; fails int; retry_due date;
  stop_codes text[] := ARRAY['1','2','3','5','6','B']; rep_id uuid; key text; today date := public.care_today(); action_ text;
BEGIN
  SELECT * INTO c FROM public.care_collections WHERE id = p_collection FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = c.subscription_id FOR UPDATE;
  IF p_outcome = 'paid' THEN
    IF c.status <> 'submitted' THEN RAISE EXCEPTION 'collection_not_submitted (status %)', c.status; END IF;
    IF p_bank_received IS NULL THEN RAISE EXCEPTION 'bank_received_date_required'; END IF;
    IF p_bank_received > today THEN RAISE EXCEPTION 'bank_received_date_in_future'; END IF;
    IF today < public.care_add_working_days(c.due_date, 3) THEN
      RAISE EXCEPTION 'too_early: returns can still arrive until %; record paid after that', public.care_add_working_days(c.due_date, 3);
    END IF;
    UPDATE public.care_collections SET status = 'paid', paid_confirmed_at = now(), paid_confirmed_by = uid, bank_received_date = p_bank_received WHERE id = c.id;
    UPDATE public.care_subscriptions SET failed_collections = 0 WHERE id = s.id;
    UPDATE public.care_refunds SET status = 'to_pay', due_by = greatest(coalesce(due_by, today), today + 14) WHERE collection_id = c.id AND status = 'awaiting_collection';
    PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'collection_paid', jsonb_build_object('collection_id', c.id, 'bank_received', p_bank_received, 'amount_minor', c.amount_minor));
    RETURN jsonb_build_object('ok', true);
  ELSIF p_outcome = 'unpaid' THEN
    IF p_reason_code IS NULL THEN RAISE EXCEPTION 'reason_code_required'; END IF;
    IF c.status = 'paid' THEN
      -- A late ARUDD: allowed for 10 working days after the due date.
      IF today > public.care_add_working_days(c.due_date, 10) THEN RAISE EXCEPTION 'too_late_for_a_return: use an indemnity claim instead'; END IF;
      UPDATE public.care_refunds SET status = 'cancelled', cancelled_reason = 'collection_returned' WHERE collection_id = c.id AND status = 'to_pay';
    ELSIF c.status <> 'submitted' THEN
      RAISE EXCEPTION 'collection_not_submitted (status %)', c.status;
    END IF;
    UPDATE public.care_collections SET status = 'unpaid', unpaid_recorded_at = now(), unpaid_recorded_by = uid,
      unpaid_reason_code = p_reason_code, unpaid_reason_text = left(p_note, 300) WHERE id = c.id;
    UPDATE public.care_refunds SET status = 'cancelled', cancelled_reason = 'collection_unpaid' WHERE collection_id = c.id AND status = 'awaiting_collection';
    fails := s.failed_collections + 1;
    UPDATE public.care_subscriptions SET failed_collections = fails WHERE id = s.id;
    PERFORM public.care_log(s.id, s.customer_id, 'bank', NULL, 'collection_unpaid', jsonb_build_object('collection_id', c.id, 'reason_code', p_reason_code, 'recorded_by', uid, 'failed_count', fails));

    IF s.status NOT IN ('active','pending_mandate') THEN
      action_ := 'none';
    ELSIF p_reason_code = ANY(stop_codes) THEN
      action_ := 'pause_instruction_ended';
    ELSIF fails >= 2 THEN
      action_ := 'pause_missed';
    ELSIF p_reason_code = '0' AND c.kind <> 'represent' THEN
      action_ := 'represent';
    ELSE
      action_ := 'review';
    END IF;

    IF action_ = 'represent' THEN
      retry_due := public.care_next_working_day(public.care_add_working_days(today, 13));
      key := 'unpaid:' || c.id;
      INSERT INTO public.care_collections(subscription_id, mandate_id, kind, due_date, amount_minor, period_start, period_end,
        notice_sent_at, notice_kind, notice_dedupe, represent_of)
      VALUES (s.id, c.mandate_id, 'represent', retry_due, c.amount_minor, c.period_start, c.period_end, now(), 'payment_failed', key, c.id)
      RETURNING id INTO rep_id;
      PERFORM public.care_queue(s.id, 'payment_failed', jsonb_build_object('amount_minor', c.amount_minor, 'due_date', c.due_date,
        'reason_code', p_reason_code, 'retry_date', retry_due, 'final', false), key);
    ELSIF action_ = 'review' THEN
      PERFORM public.care_queue(s.id, 'payment_failed', jsonb_build_object('amount_minor', c.amount_minor, 'due_date', c.due_date,
        'reason_code', p_reason_code, 'retry_date', NULL, 'final', false), 'unpaid:' || c.id);
      PERFORM public.care_task(s.customer_id, 'Care payment returned (ARUDD ' || p_reason_code || ') — call the customer — ' || s.reference,
        'This return code is not a lack of funds, so nothing is re-tried automatically. Call the customer, then either pause Care or cancel it in Admin → OCCTA Care. Do not re-present without their agreement and a fresh notice.',
        'high', public.care_add_working_days(today, 2));
    ELSIF action_ IN ('pause_instruction_ended','pause_missed') THEN
      PERFORM public.care_pause_internal(s.id, CASE WHEN action_ = 'pause_instruction_ended' THEN 'bank_instruction_ended' ELSE 'missed_payments' END,
        p_reason_code, 'system', uid, 'paused:' || c.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'action', action_, 'retry_date', retry_due);
  ELSE
    RAISE EXCEPTION 'invalid_outcome';
  END IF;
END $$;

-- Goodwill refunds not tied to a payment need a finance role and can't exceed what was paid.
CREATE OR REPLACE FUNCTION public.care_admin_goodwill_refund(p_sub uuid, p_collection uuid, p_amount_minor integer, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(p_collection IS NULL); s record; c record; cstatus text; fid uuid; paid_total int; refunded int;
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
  ELSE
    SELECT coalesce(sum(amount_minor), 0) INTO paid_total FROM public.care_collections WHERE subscription_id = s.id AND status = 'paid';
    SELECT coalesce(sum(amount_minor), 0) INTO refunded FROM public.care_refunds WHERE subscription_id = s.id AND status <> 'cancelled';
    IF p_amount_minor > paid_total - refunded THEN RAISE EXCEPTION 'refund_exceeds_amount_paid'; END IF;
  END IF;
  INSERT INTO public.care_refunds(subscription_id, collection_id, amount_minor, reason, status, due_by, created_by)
  VALUES (s.id, p_collection, p_amount_minor, p_reason, CASE WHEN cstatus = 'submitted' THEN 'awaiting_collection' ELSE 'to_pay' END, public.care_today() + 14, uid)
  RETURNING id INTO fid;
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'refund_created', jsonb_build_object('refund_id', fid, 'amount_minor', p_amount_minor, 'reason', p_reason));
  RETURN jsonb_build_object('ok', true, 'refund_id', fid);
END $$;

-- ---------------------------------------------------------------------------
-- Nightly engine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_nightly() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; c record; m record; nxt date; nxt_end date; due date; nominal date; amt int; nkey text; nkind text;
  n_sched int := 0; n_notice int := 0; n_ready int := 0; n_resched int := 0; n_usage int := 0; n_end int := 0; n_tasks int := 0; n_price int := 0;
  mths int; used int; today date := public.care_today(); win int;
BEGIN
  UPDATE public.care_applications SET status = 'expired' WHERE status = 'draft' AND expires_at < now();

  -- 0. Apply plan/price changes whose effective date has arrived.
  FOR s IN SELECT * FROM public.care_subscriptions WHERE pending_from IS NOT NULL AND pending_from <= today
           AND status IN ('pending_review','pending_mandate','active') LOOP
    UPDATE public.care_subscriptions SET plan_code = coalesce(pending_plan_code, plan_code), price_minor = pending_price_minor,
      pending_plan_code = NULL, pending_price_minor = NULL, pending_from = NULL, pending_notice_dedupe = NULL WHERE id = s.id;
    PERFORM public.care_log(s.id, s.customer_id, 'system', NULL, 'plan_or_price_change_applied',
      jsonb_build_object('plan', coalesce(s.pending_plan_code, s.plan_code), 'price_minor', s.pending_price_minor, 'from', s.pending_from));
    n_price := n_price + 1;
  END LOOP;

  -- 1. Finish cancellations whose paid period has ended.
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'cancel_pending' AND cancel_effective_date < today LOOP
    UPDATE public.care_subscriptions SET status = 'cancelled', cancelled_at = now() WHERE id = s.id;
    PERFORM public.care_log(s.id, s.customer_id, 'system', NULL, 'cancellation_effective', jsonb_build_object('date', s.cancel_effective_date));
    n_end := n_end + 1;
  END LOOP;

  -- 2. Reviews still undecided 3 working days after sign-up: escalate once.
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'pending_review' AND review_task_at IS NULL
           AND public.care_add_working_days((joined_at AT TIME ZONE 'Europe/London')::date, 3) <= today LOOP
    PERFORM public.care_task(s.customer_id, 'OCCTA Care review overdue — ' || s.reference,
      'This sale is still waiting for a review decision. The Bacs lodging deadline is ' ||
      to_char((SELECT lodge_due_by FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1), 'DD Mon YYYY') ||
      '. If it can''t be approved in time, decline it (nothing has been collected).', 'urgent', today);
    UPDATE public.care_subscriptions SET review_task_at = now() WHERE id = s.id;
    n_tasks := n_tasks + 1;
  END LOOP;

  -- 3. Lodging deadline: warn 2 working days ahead, and once more if it passes.
  FOR m IN SELECT cm.*, cs.customer_id AS cust, cs.reference AS sref FROM public.care_mandates cm JOIN public.care_subscriptions cs ON cs.id = cm.subscription_id
           WHERE cm.status IN ('awaiting_lodgement','on_hold') AND cm.lodge_warned_at IS NULL
             AND cm.lodge_due_by <= public.care_add_working_days(today, 2) AND cm.lodge_due_by >= today LOOP
    PERFORM public.care_task(m.cust, 'Care mandate lodging deadline in 2 working days — ' || m.sref,
      'Lodge ' || m.sref || ' in AccessPay by ' || to_char(m.lodge_due_by, 'DD Mon YYYY') || ' (approve the review first if it is still pending).', 'urgent', m.lodge_due_by);
    UPDATE public.care_mandates SET lodge_warned_at = now() WHERE id = m.id;
    n_tasks := n_tasks + 1;
  END LOOP;
  FOR m IN SELECT cm.*, cs.customer_id AS cust, cs.reference AS sref FROM public.care_mandates cm JOIN public.care_subscriptions cs ON cs.id = cm.subscription_id
           WHERE cm.status IN ('awaiting_lodgement','on_hold') AND cm.lodge_overdue_at IS NULL AND cm.lodge_due_by < today LOOP
    PERFORM public.care_task(m.cust, 'Care mandate NOT lodged in time — cancel and re-sign — ' || m.sref,
      'The Bacs deadline for ' || m.sref || ' passed on ' || to_char(m.lodge_due_by, 'DD Mon YYYY') ||
      '. It can no longer be lodged. Cancel (or decline) this sale in Admin → OCCTA Care, then ask the customer to join again if they still want Care.', 'urgent', today);
    UPDATE public.care_mandates SET lodge_overdue_at = now() WHERE id = m.id;
    n_tasks := n_tasks + 1;
  END LOOP;

  -- 4. Schedule the next collection for active members (one period ahead), at the price for THAT period.
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'active' AND NOT is_test LOOP
    SELECT * INTO c FROM public.care_collections WHERE subscription_id = s.id AND kind <> 'represent' AND status <> 'cancelled'
      ORDER BY period_start DESC LIMIT 1;
    CONTINUE WHEN c.id IS NULL;
    CONTINUE WHEN c.period_end > today + 45;
    mths := public.care_period_months(s.frequency);
    nxt := c.period_end + 1;
    nxt_end := (nxt + make_interval(months => mths) - interval '1 day')::date;
    due := public.care_next_working_day(nxt);
    IF s.pending_from IS NOT NULL AND nxt >= s.pending_from THEN
      amt := s.pending_price_minor; nkey := s.pending_notice_dedupe; nkind := 'change_notice';
    ELSE
      amt := s.price_minor;
      -- Monthly: the schedule already given (DD confirmation or last change notice) covers the same amount and day.
      IF s.frequency = 'monthly' AND extract(day FROM nxt) = s.collection_day AND c.amount_minor = amt AND c.notice_dedupe IS NOT NULL THEN
        nkey := c.notice_dedupe; nkind := 'schedule_continues';
      ELSE
        nkey := NULL; nkind := NULL;
      END IF;
    END IF;
    SELECT * INTO m FROM public.care_mandates WHERE subscription_id = s.id AND status IN ('active','lodged') ORDER BY created_at DESC LIMIT 1;
    INSERT INTO public.care_collections(subscription_id, mandate_id, kind, due_date, amount_minor, period_start, period_end,
      notice_sent_at, notice_kind, notice_dedupe)
    VALUES (s.id, m.id, 'recurring', due, amt, nxt, nxt_end, CASE WHEN nkey IS NOT NULL THEN now() END, nkind, nkey)
    ON CONFLICT DO NOTHING;
    n_sched := n_sched + 1;
  END LOOP;

  -- 5. Renewal reminder (= advance notice) for quarterly/annual, 30 days before.
  FOR c IN SELECT cc.*, cs.frequency, cs.reference, cs.customer_id FROM public.care_collections cc JOIN public.care_subscriptions cs ON cs.id = cc.subscription_id
           WHERE cc.status = 'scheduled' AND cc.notice_dedupe IS NULL AND cc.kind = 'recurring' AND cs.frequency <> 'monthly'
             AND cs.status = 'active' AND cc.due_date <= today + 30 LOOP
    win := public.care_period_months(c.frequency);
    SELECT count(*) INTO used FROM public.care_usage u WHERE u.subscription_id = c.subscription_id AND u.occurred_at > now() - make_interval(months => win);
    PERFORM public.care_queue(c.subscription_id, 'renewal_reminder', jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor,
      'period_start', c.period_start, 'period_end', c.period_end, 'frequency', c.frequency, 'usage_count', used, 'usage_months', win), 'renew:' || c.id);
    UPDATE public.care_collections SET notice_sent_at = now(), notice_kind = 'renewal_reminder', notice_dedupe = 'renew:' || c.id WHERE id = c.id;
    n_notice := n_notice + 1;
  END LOOP;

  -- 6. Any other collection without notice that is getting close: send an advance notice.
  FOR c IN SELECT cc.*, cs.frequency FROM public.care_collections cc JOIN public.care_subscriptions cs ON cs.id = cc.subscription_id
           WHERE cc.status = 'scheduled' AND cc.notice_dedupe IS NULL AND cs.status IN ('active','pending_mandate') AND cc.due_date <= today + 30 LOOP
    PERFORM public.care_queue(c.subscription_id, 'advance_notice', jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor,
      'period_start', c.period_start, 'period_end', c.period_end, 'frequency', c.frequency, 'kind', c.kind), 'notice:' || c.id);
    UPDATE public.care_collections SET notice_sent_at = now(), notice_kind = 'advance_notice', notice_dedupe = 'notice:' || c.id WHERE id = c.id;
    n_notice := n_notice + 1;
  END LOOP;

  -- 7. Promote to 'ready' within 7 days of due when the mandate is active and the notice
  --    REACHED the customer >= 10 working days before. Otherwise (or if a ready item has gone
  --    stale) move it to the next cycle with fresh notice. Pending-review sales are left alone:
  --    their notice goes out on approval.
  FOR c IN SELECT cc.*, cs.frequency, cs.collection_day, cs.status AS sub_status, cs.customer_id FROM public.care_collections cc
           JOIN public.care_subscriptions cs ON cs.id = cc.subscription_id
           WHERE ((cc.status = 'scheduled' AND cc.due_date <= today + 7)
                  OR (cc.status = 'ready' AND cc.due_date < public.care_add_working_days(today, 2)))
             AND NOT cc.is_test AND cs.status IN ('pending_mandate','active') LOOP
    SELECT * INTO m FROM public.care_mandates WHERE subscription_id = c.subscription_id ORDER BY created_at DESC LIMIT 1;
    IF c.status = 'scheduled' AND m.status = 'active' AND public.care_notice_ok(c.notice_dedupe, c.due_date)
       AND c.due_date >= public.care_add_working_days(today, 2) THEN
      UPDATE public.care_collections SET status = 'ready', mandate_id = m.id WHERE id = c.id;
      n_ready := n_ready + 1;
    ELSE
      nominal := public.care_day_on_or_after(public.care_add_working_days(today, 15), c.collection_day);
      due := public.care_next_working_day(nominal);
      nkey := 'moved:' || c.id || ':' || c.reschedule_count;
      UPDATE public.care_collections SET status = 'scheduled', due_date = due,
        period_start = CASE WHEN c.kind = 'represent' THEN period_start ELSE nominal END,
        period_end = CASE WHEN c.kind = 'represent' THEN period_end
                          ELSE (nominal + make_interval(months => public.care_period_months(c.frequency)) - interval '1 day')::date END,
        notice_sent_at = now(), notice_kind = 'change_notice', notice_dedupe = nkey, reschedule_count = reschedule_count + 1
       WHERE id = c.id;
      UPDATE public.care_subscriptions SET first_collection_date = due WHERE id = c.subscription_id AND c.kind = 'first';
      PERFORM public.care_queue(c.subscription_id, 'change_notice', jsonb_build_object('kind', 'date_moved', 'old_date', c.due_date,
        'new_date', due, 'amount_minor', c.amount_minor, 'frequency', c.frequency,
        'reason', CASE WHEN m.status IS DISTINCT FROM 'active' THEN 'mandate_not_ready' ELSE 'notice' END), nkey);
      PERFORM public.care_log(c.subscription_id, c.customer_id, 'system', NULL, 'collection_rescheduled',
        jsonb_build_object('collection_id', c.id, 'from', c.due_date, 'to', due, 'mandate_status', m.status,
          'notice_delivered_on', public.care_notice_delivered_on(c.notice_dedupe)));
      n_resched := n_resched + 1;
    END IF;
  END LOOP;

  -- 8. Six-monthly usage reminders for monthly members (with a low-use question).
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status = 'active' AND frequency = 'monthly' AND next_usage_reminder_on <= today LOOP
    SELECT count(*) INTO used FROM public.care_usage u WHERE u.subscription_id = s.id AND u.occurred_at > now() - interval '6 months';
    PERFORM public.care_queue(s.id, 'usage_reminder', jsonb_build_object('usage_count', used, 'low_use', used = 0,
      'price_minor', s.price_minor, 'frequency', s.frequency, 'since', (today - interval '6 months')::date), 'usage:' || s.id || ':' || today);
    UPDATE public.care_subscriptions SET next_usage_reminder_on = (today + interval '6 months')::date, last_usage_reminder_at = now() WHERE id = s.id;
    n_usage := n_usage + 1;
  END LOOP;

  -- 9. Low-use check for prepaid members (no usage in 6 months).
  FOR s IN SELECT cs.* FROM public.care_subscriptions cs WHERE cs.status = 'active' AND cs.frequency <> 'monthly'
           AND cs.joined_at < now() - interval '6 months'
           AND (cs.last_usage_reminder_at IS NULL OR cs.last_usage_reminder_at < now() - interval '6 months')
           AND NOT EXISTS (SELECT 1 FROM public.care_usage u WHERE u.subscription_id = cs.id AND u.occurred_at > now() - interval '6 months') LOOP
    PERFORM public.care_queue(s.id, 'usage_reminder', jsonb_build_object('usage_count', 0, 'low_use', true, 'price_minor', s.price_minor,
      'frequency', s.frequency, 'since', (today - interval '6 months')::date), 'usage:' || s.id || ':' || today);
    UPDATE public.care_subscriptions SET last_usage_reminder_at = now() WHERE id = s.id;
    n_usage := n_usage + 1;
  END LOOP;

  -- 10. Indemnity claims: escalate once, from one working day before the window closes.
  FOR c IN SELECT d.*, cs.customer_id, cs.reference FROM public.care_disputes d JOIN public.care_subscriptions cs ON cs.id = d.subscription_id
           WHERE d.status = 'open' AND d.kind IN ('indemnity_claim','ddi_copy_request') AND d.escalated_at IS NULL
             AND d.respond_by <= public.care_add_working_days(today, 1) LOOP
    PERFORM public.care_task(c.customer_id, 'Care ' || replace(c.kind, '_', ' ') || ' due ' || to_char(c.respond_by, 'DD Mon') || ' — ' || c.reference,
      'Act on this in Admin → OCCTA Care → Disputes today. Deadline ' || to_char(c.respond_by, 'DD Mon YYYY') || '.', 'urgent', least(c.respond_by, today));
    UPDATE public.care_disputes SET escalated_at = now() WHERE id = c.id;
    n_tasks := n_tasks + 1;
  END LOOP;

  -- 11. Bank details: keep only while a mandate may need re-lodging.
  UPDATE public.care_mandates SET bank_details_ciphertext = NULL, enc_nonce = NULL, ciphertext_purged_at = now()
   WHERE ciphertext_purged_at IS NULL AND ((status IN ('cancelled','rejected') AND updated_at < now() - interval '30 days')
          OR (status = 'active' AND activated_at < now() - interval '90 days'));

  -- 12. Welcome calls for reviewed and phone-assisted sales (once, even if a night is missed).
  FOR s IN SELECT * FROM public.care_subscriptions WHERE status IN ('pending_review','pending_mandate','active') AND welcome_call_done_at IS NULL
           AND welcome_task_at IS NULL AND welcome_call_due_on IS NOT NULL AND welcome_call_due_on <= today LOOP
    PERFORM public.care_task(s.customer_id, 'OCCTA Care welcome call — ' || s.reference,
      'Call to check the customer understands Care and still wants it. Record the call in Admin → OCCTA Care. If they want to cancel, cancel it there (no charge).',
      'high', today);
    UPDATE public.care_subscriptions SET welcome_task_at = now() WHERE id = s.id;
    n_tasks := n_tasks + 1;
  END LOOP;

  -- 13. Bank holiday calendar must always run at least a year ahead.
  IF (SELECT max(holiday) FROM public.care_bank_holidays) < today + 365
     AND NOT EXISTS (SELECT 1 FROM public.admin_tasks WHERE title = 'OCCTA Care: add next year''s bank holidays' AND status = 'open') THEN
    INSERT INTO public.admin_tasks(title, description, priority, status, created_by, due_date)
    SELECT 'OCCTA Care: add next year''s bank holidays',
      'public.care_bank_holidays ends on ' || (SELECT max(holiday) FROM public.care_bank_holidays) || '. Add the next year of England & Wales bank holidays (gov.uk/bank-holidays) so notice periods stay correct.',
      'high', 'open', r.user_id, today + 14
      FROM public.user_roles r WHERE r.role::text IN ('super_admin','admin') ORDER BY r.role::text DESC LIMIT 1;
    n_tasks := n_tasks + 1;
  END IF;

  RETURN jsonb_build_object('price_changes_applied', n_price, 'scheduled', n_sched, 'notices', n_notice, 'ready', n_ready, 'rescheduled', n_resched,
    'usage_reminders', n_usage, 'ended', n_end, 'tasks', n_tasks);
END $$;

-- ---------------------------------------------------------------------------
-- Read models: show pending changes and delivered notice
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_my_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s record; m record;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('signed_in', false); END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE customer_id = uid ORDER BY created_at DESC LIMIT 1;
  SELECT status, masked_account_last4, masked_sort_last2, bank_name, account_holder_name INTO m
    FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'signed_in', true,
    'eligibility', public.care_eligibility(uid),
    'subscription', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', s.id, 'reference', s.reference, 'plan_code', s.plan_code, 'frequency', s.frequency, 'price_minor', s.price_minor,
      'collection_day', s.collection_day, 'status', s.status, 'status_reason', s.status_reason, 'joined_at', s.joined_at, 'cooling_off_ends_at', s.cooling_off_ends_at,
      'service_starts_on', s.service_starts_on, 'first_collection_date', s.first_collection_date,
      'cancel_effective_date', s.cancel_effective_date, 'cancelled_at', s.cancelled_at, 'terms_version', s.terms_version,
      'pending_plan_code', s.pending_plan_code, 'pending_price_minor', s.pending_price_minor, 'pending_from', s.pending_from,
      'mandate', CASE WHEN m.status IS NULL THEN NULL ELSE jsonb_build_object('status', m.status, 'last4', m.masked_account_last4,
        'sort_last2', m.masked_sort_last2, 'bank_name', m.bank_name, 'holder', m.account_holder_name) END) END,
    'next_payment', (SELECT jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor)
       FROM public.care_collections c WHERE c.subscription_id = s.id AND c.status IN ('scheduled','ready','in_run','submitted')
         AND s.status NOT IN ('pending_review')
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
           s.status AS sub_status, m.status AS mandate_status
      FROM public.care_collections c JOIN public.care_subscriptions s ON s.id = c.subscription_id
      LEFT JOIN public.care_mandates m ON m.id = c.mandate_id LEFT JOIN public.profiles p ON p.id = s.customer_id
     WHERE (p_status = 'all' OR c.status = p_status
            OR (p_status = 'upcoming' AND c.status = 'scheduled' AND c.due_date <= public.care_today() + 35)
            OR (p_status = 'pulled' AND c.status = 'cancelled' AND c.cancelled_reason LIKE 'pulled_from_run:%'))
       AND NOT c.is_test
     LIMIT 1000) x), '[]');
END $$;

CREATE OR REPLACE FUNCTION public.care_admin_report(p_month date DEFAULT date_trunc('month', current_date)::date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a timestamptz := date_trunc('month', p_month); b timestamptz := date_trunc('month', p_month) + interval '1 month'; live int;
  claims int; collected int;
BEGIN
  PERFORM public.care_require(false);
  SELECT count(*) INTO live FROM public.care_subscriptions WHERE status IN ('pending_mandate','active','cancel_pending') AND NOT is_test;
  SELECT count(*) INTO claims FROM public.care_disputes WHERE kind = 'indemnity_claim' AND created_at >= a AND created_at < b;
  SELECT count(*) INTO collected FROM public.care_collections WHERE status IN ('paid','indemnity_claimed','unpaid')
    AND due_date >= a::date AND due_date < b::date AND NOT is_test;
  RETURN jsonb_build_object(
    'month', to_char(a, 'YYYY-MM'),
    'live_members', live,
    'joined', (SELECT count(*) FROM public.care_subscriptions WHERE joined_at >= a AND joined_at < b AND NOT is_test),
    'joined_by_channel', (SELECT coalesce(jsonb_object_agg(channel, n), '{}') FROM (SELECT channel, count(*) n FROM public.care_subscriptions
       WHERE joined_at >= a AND joined_at < b AND NOT is_test GROUP BY channel) x),
    'joined_by_staff', (SELECT coalesce(jsonb_agg(jsonb_build_object('staff_id', sold_by, 'name', (SELECT full_name FROM public.profiles WHERE id = sold_by), 'n', n)), '[]')
       FROM (SELECT sold_by, count(*) n FROM public.care_subscriptions WHERE joined_at >= a AND joined_at < b AND sold_by IS NOT NULL AND NOT is_test GROUP BY sold_by) x),
    'still_active_after_90_days_by_staff', (SELECT coalesce(jsonb_agg(jsonb_build_object('staff_id', sold_by, 'sold', n, 'still_active', k)), '[]')
       FROM (SELECT sold_by, count(*) n, count(*) FILTER (WHERE status IN ('active','cancel_pending') AND joined_at < now() - interval '90 days') k
             FROM public.care_subscriptions WHERE sold_by IS NOT NULL AND NOT is_test GROUP BY sold_by) x),
    'cancelled', (SELECT count(*) FROM public.care_subscriptions WHERE cancel_requested_at >= a AND cancel_requested_at < b AND NOT is_test),
    'cancelled_in_cooling_off', (SELECT count(*) FROM public.care_subscriptions WHERE cancel_requested_at >= a AND cancel_requested_at < b AND cancel_channel = 'in_cooling_off' AND NOT is_test),
    'declined', (SELECT count(*) FROM public.care_subscriptions WHERE status = 'declined' AND reviewed_at >= a AND reviewed_at < b),
    'paused', (SELECT count(*) FROM public.care_subscriptions WHERE status = 'paused' AND NOT is_test),
    'paid_minor', (SELECT coalesce(sum(amount_minor), 0) FROM public.care_collections WHERE status = 'paid' AND bank_received_date >= a::date AND bank_received_date < b::date AND NOT is_test),
    'unpaid', (SELECT count(*) FROM public.care_collections WHERE unpaid_recorded_at >= a AND unpaid_recorded_at < b AND NOT is_test),
    'indemnity_claims', claims,
    'indemnity_rate_pct', CASE WHEN collected > 0 THEN round(claims * 100.0 / collected, 2) ELSE 0 END,
    'refunds_minor', (SELECT coalesce(sum(amount_minor), 0) FROM public.care_refunds WHERE created_at >= a AND created_at < b AND status <> 'cancelled'),
    'complaints', (SELECT count(*) FROM public.complaints WHERE category = 'occta_care' AND opened_at >= a AND opened_at < b),
    'complaints_per_1000', CASE WHEN live > 0 THEN round((SELECT count(*) FROM public.complaints WHERE category = 'occta_care' AND opened_at >= a AND opened_at < b) * 1000.0 / live, 1) ELSE 0 END,
    'low_use_members', (SELECT count(*) FROM public.care_subscriptions s WHERE s.status = 'active' AND s.joined_at < now() - interval '6 months'
       AND NOT EXISTS (SELECT 1 FROM public.care_usage u WHERE u.subscription_id = s.id AND u.occurred_at > now() - interval '6 months')),
    'usage', (SELECT coalesce(jsonb_object_agg(kind, n), '{}') FROM (SELECT kind, count(*) n FROM public.care_usage WHERE occurred_at >= a AND occurred_at < b GROUP BY kind) x),
    'letters_sent', (SELECT count(*) FROM public.care_letters WHERE created_at >= a AND created_at < b AND status NOT IN ('cancelled','failed')),
    'letters_waiting', (SELECT count(*) FROM public.care_letters WHERE status IN ('rendering','posting','awaiting_print','in_batch','needs_manual'))
  );
END $$;

-- ---------------------------------------------------------------------------
-- Storage: evidence packs only for finance and compliance roles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "care_documents_staff_read" ON storage.objects;
CREATE POLICY "care_documents_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'care-documents' AND (
    ((storage.foldername(name))[1] IN ('letters','batches') AND public.care_is_staff(auth.uid()))
    OR ((storage.foldername(name))[1] = 'evidence' AND public.care_can_see_evidence(auth.uid()))));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['care_is_staff(uuid)','care_is_finance(uuid)','care_can_see_evidence(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['care_today()','care_notice_delivered_on(text)','care_notice_ok(text,date)',
    'care_pull_from_runs(uuid,text)','care_pause_internal(uuid,text,text,text,uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['care_admin_pause(uuid,text)','care_admin_pulled_item_collected(uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

COMMIT;
