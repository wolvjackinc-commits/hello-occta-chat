-- Care: any FastPay payment day (1st-28th), Royal Mail tracking and received dates on letters,
-- and the payment-reminder call once the letters have arrived. Sales staff can add and update, never delete.
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['care_invites','care_applications','care_subscriptions','care_sales'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_collection_day_check');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (collection_day BETWEEN 1 AND 28)', t, t || '_collection_day_check');
  END LOOP;
END $do$;

ALTER TABLE public.care_letters ADD COLUMN IF NOT EXISTS royal_mail_ref text,
  ADD COLUMN IF NOT EXISTS tracking_url text, ADD COLUMN IF NOT EXISTS received_on date, ADD COLUMN IF NOT EXISTS tracking_updated_by uuid;
ALTER TABLE public.care_letters DROP CONSTRAINT IF EXISTS care_letters_tracking_url_check;
ALTER TABLE public.care_letters ADD CONSTRAINT care_letters_tracking_url_check CHECK (tracking_url IS NULL OR tracking_url ~ '^https://');

-- The actual received date, when we know it, beats the "posted + 2 working days" assumption.
CREATE OR REPLACE FUNCTION public.care_notice_delivered_on(p_dedupe text) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT least(
    (SELECT (l.email_sent_at AT TIME ZONE 'Europe/London')::date FROM public.care_letters l
      WHERE l.dedupe_key = p_dedupe AND l.email_sent_at IS NOT NULL),
    (SELECT coalesce(l.received_on, public.care_add_working_days(l.posted_on, 2)) FROM public.care_letters l
      WHERE l.dedupe_key = p_dedupe AND l.status = 'posted' AND l.posted_on IS NOT NULL),
    (SELECT coalesce(l.received_on, public.care_add_working_days(l.mail_house_on, 3)) FROM public.care_letters l
      WHERE l.dedupe_key = p_dedupe AND l.status = 'sent_to_mail_house' AND l.mail_house_on IS NOT NULL)
  )
$function$;

-- The sale's Care record, its letters and its reminder calls, for the agent who sold it (or a supervisor).
CREATE OR REPLACE FUNCTION public.care_sales_followup(p_sale uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); s record; sub record;
BEGIN
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale;
  IF NOT FOUND OR (r <> 'supervisor' AND s.agent_id <> auth.uid()) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.subscription_id IS NULL THEN RETURN jsonb_build_object('subscription', NULL); END IF;
  SELECT * INTO sub FROM public.care_subscriptions WHERE id = s.subscription_id;
  RETURN jsonb_build_object(
    'subscription', jsonb_build_object('id', sub.id, 'reference', sub.reference, 'status', sub.status, 'plan_code', sub.plan_code,
      'frequency', sub.frequency, 'price_minor', sub.price_minor, 'collection_day', sub.collection_day, 'first_collection_date', sub.first_collection_date,
      'cooling_off_ends_on', (sub.cooling_off_ends_at AT TIME ZONE 'Europe/London')::date - 1, 'welcome_call_done_at', sub.welcome_call_done_at,
      'provider', (SELECT d.display_name FROM public.care_mandates m JOIN public.dd_providers d ON d.provider_code = m.provider_code
                   WHERE m.subscription_id = sub.id ORDER BY m.created_at DESC LIMIT 1),
      'mandate_status', (SELECT m.status FROM public.care_mandates m WHERE m.subscription_id = sub.id ORDER BY m.created_at DESC LIMIT 1)),
    'next_payment', (SELECT jsonb_build_object('due_date', c.due_date, 'amount_minor', c.amount_minor) FROM public.care_collections c
      WHERE c.subscription_id = sub.id AND c.status IN ('scheduled','ready','in_run','submitted') ORDER BY c.due_date LIMIT 1),
    'letters', coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'letter_type', l.letter_type, 'status', l.status, 'letter_date', l.letter_date,
      'created_at', l.created_at, 'pdf', l.pdf_path IS NOT NULL, 'email_sent_at', l.email_sent_at, 'posted_on', l.posted_on,
      'royal_mail_ref', l.royal_mail_ref, 'tracking_url', l.tracking_url, 'received_on', l.received_on) ORDER BY l.created_at)
      FROM public.care_letters l WHERE l.subscription_id = sub.id AND l.copy_for IS NULL), '[]'),
    'calls', coalesce((SELECT jsonb_agg(jsonb_build_object('at', e.created_at, 'outcome', replace(e.event, 'payment_reminder_call_', ''),
      'note', e.details->>'note', 'by', (SELECT full_name FROM public.profiles WHERE id = e.actor_id)) ORDER BY e.created_at)
      FROM public.care_events e WHERE e.subscription_id = sub.id AND e.event LIKE 'payment_reminder_call_%'), '[]'));
END $$;

-- Record posting, Royal Mail tracking and the received date. Values can be corrected but never removed.
CREATE OR REPLACE FUNCTION public.care_sales_letter_update(p_letter uuid, p_posted_on date, p_royal_mail_ref text, p_tracking_url text, p_received_on date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); l record; ok boolean;
BEGIN
  SELECT * INTO l FROM public.care_letters WHERE id = p_letter FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.care_sales cs WHERE cs.subscription_id = l.subscription_id AND (r = 'supervisor' OR cs.agent_id = uid)) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'not_found'; END IF;
  IF l.status IN ('cancelled','failed') THEN RAISE EXCEPTION 'letter_not_sendable'; END IF;
  IF p_posted_on > public.care_today() OR p_received_on > public.care_today() THEN RAISE EXCEPTION 'date_in_future'; END IF;
  IF p_received_on IS NOT NULL AND coalesce(p_posted_on, l.posted_on) IS NULL THEN RAISE EXCEPTION 'add_posted_date_first'; END IF;
  IF p_received_on < coalesce(p_posted_on, l.posted_on) THEN RAISE EXCEPTION 'received_before_posted'; END IF;
  IF nullif(btrim(p_tracking_url), '') IS NOT NULL AND btrim(p_tracking_url) !~ '^https://' THEN RAISE EXCEPTION 'tracking_url_must_start_https'; END IF;
  UPDATE public.care_letters SET
    posted_on = coalesce(p_posted_on, posted_on),
    posted_by = CASE WHEN p_posted_on IS NOT NULL THEN uid ELSE posted_by END,
    status = CASE WHEN coalesce(p_posted_on, posted_on) IS NOT NULL AND status IN ('awaiting_print','in_batch','needs_manual') THEN 'posted' ELSE status END,
    royal_mail_ref = coalesce(nullif(btrim(left(p_royal_mail_ref, 60)), ''), royal_mail_ref),
    tracking_url = coalesce(nullif(btrim(left(p_tracking_url, 500)), ''), tracking_url),
    received_on = coalesce(p_received_on, received_on), tracking_updated_by = uid, updated_at = now()
   WHERE id = l.id;
  PERFORM public.care_log(l.subscription_id, l.customer_id, 'staff', uid, 'letter_tracking_updated', jsonb_build_object('letter_id', l.id,
    'letter_type', l.letter_type, 'posted_on', p_posted_on, 'royal_mail_ref', p_royal_mail_ref, 'tracking_url', p_tracking_url, 'received_on', p_received_on));
  RETURN jsonb_build_object('ok', true);
END $$;

-- After the letters arrive, the agent calls to remind the customer about the first payment. Each call is added, never replaced.
CREATE OR REPLACE FUNCTION public.care_sales_reminder_call(p_sale uuid, p_outcome text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); s record; sub record;
BEGIN
  IF p_outcome NOT IN ('reminded','no_answer','call_back','wants_to_cancel') THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
  IF length(coalesce(btrim(p_note), '')) < 3 THEN RAISE EXCEPTION 'note_required'; END IF;
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale;
  IF NOT FOUND OR (r <> 'supervisor' AND s.agent_id <> uid) OR s.subscription_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO sub FROM public.care_subscriptions WHERE id = s.subscription_id;
  IF NOT EXISTS (SELECT 1 FROM public.care_letters WHERE subscription_id = sub.id AND received_on IS NOT NULL) THEN
    RAISE EXCEPTION 'letters_not_received_yet'; END IF;
  PERFORM public.care_log(sub.id, sub.customer_id, 'staff', uid, 'payment_reminder_call_' || p_outcome, jsonb_build_object('note', left(p_note, 1000), 'sale_id', s.id));
  IF p_outcome = 'reminded' AND sub.welcome_call_done_at IS NULL THEN UPDATE public.care_subscriptions SET welcome_call_done_at = now() WHERE id = sub.id; END IF;
  IF p_outcome = 'wants_to_cancel' AND sub.status IN ('pending_review','pending_mandate','active') THEN
    RETURN public.care_cancel_internal(sub.id, 'phone', 'Customer cancelled on the payment reminder call: ' || left(p_note, 500), 'staff', uid);
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

DO $do$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['care_sales_followup(uuid)','care_sales_letter_update(uuid,date,text,text,date)','care_sales_reminder_call(uuid,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $do$;

-- Admin letters list shows the same tracking fields.
CREATE OR REPLACE FUNCTION public.care_admin_letters(p_status text DEFAULT 'to_print'::text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.care_require(false);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at) FROM (
    SELECT l.id, l.letter_type, l.status, l.delivery, l.pdf_path, l.pdf_sha256, l.posted_on, l.email_status, l.error, l.large_print,
           l.copy_for, l.created_at, l.batch_id, l.recipient->>'name' AS name, l.recipient->>'postcode' AS postcode, s.reference,
           l.royal_mail_ref, l.tracking_url, l.received_on
      FROM public.care_letters l LEFT JOIN public.care_subscriptions s ON s.id = l.subscription_id
     WHERE (p_status = 'all') OR (p_status = 'to_print' AND l.status IN ('awaiting_print','needs_manual','in_batch'))
        OR (p_status = 'problems' AND l.status IN ('failed','needs_manual')) OR l.status = p_status
     ORDER BY l.created_at DESC LIMIT 500) x), '[]');
END $function$;

-- Telesales: the agent picks the first payment date. AccessPay: the 1st or 15th only; FastPay: any day 1st-28th.
-- It can't be sooner than our written-notice promise allows (the same earliest date an online sign-up gets).
CREATE OR REPLACE FUNCTION public.care_sales_earliest_first_date() RETURNS date
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.care_next_working_day(greatest(public.care_add_working_days(public.care_today(), 15), public.care_today() + 15))
$$;
GRANT EXECUTE ON FUNCTION public.care_sales_earliest_first_date() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_sales_set_first_date(p_application uuid, p_date date, p_provider text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d int := extract(day FROM p_date)::int; due date;
BEGIN
  IF p_date IS NULL THEN RAISE EXCEPTION 'first_payment_date_required'; END IF;
  IF p_date < public.care_sales_earliest_first_date() THEN RAISE EXCEPTION 'first_payment_date_too_soon: earliest is %', to_char(public.care_sales_earliest_first_date(), 'DD Mon YYYY'); END IF;
  IF p_date > public.care_today() + 90 THEN RAISE EXCEPTION 'first_payment_date_too_far'; END IF;
  IF d > 28 THEN RAISE EXCEPTION 'payment_day_must_be_1_to_28'; END IF;
  IF p_provider = 'accesspay' AND d NOT IN (1, 15) THEN RAISE EXCEPTION 'accesspay_only_1st_or_15th'; END IF;
  due := public.care_next_working_day(p_date);
  UPDATE public.care_applications SET collection_day = d, first_collection_date = due WHERE id = p_application AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  RETURN jsonb_build_object('ok', true, 'collection_day', d, 'first_collection_date', due);
END $$;
REVOKE ALL ON FUNCTION public.care_sales_set_first_date(uuid,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.care_sales_set_first_date(uuid,date,text) TO service_role;
