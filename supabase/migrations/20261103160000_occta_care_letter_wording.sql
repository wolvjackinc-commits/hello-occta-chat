-- Free-text Care letters: also block wording that presents Care as insurance ("not insurance" stays allowed).
CREATE OR REPLACE FUNCTION public.care_admin_queue_document(p_sub uuid, p_type text, p_subject text DEFAULT NULL, p_body text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := public.care_require(false); s record; c record; m record; payload jsonb; key text; banned text;
BEGIN
  IF p_type NOT IN ('welcome_pack','dd_confirmation','agreement_copy','general_letter') THEN RAISE EXCEPTION 'invalid_document_type'; END IF;
  SELECT * INTO s FROM public.care_subscriptions WHERE id = p_sub;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO c FROM public.care_consents WHERE subscription_id = s.id AND kind = 'join' ORDER BY created_at LIMIT 1;
  SELECT * INTO m FROM public.care_mandates WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1;
  IF p_type = 'general_letter' THEN
    IF length(coalesce(btrim(p_subject), '')) < 3 OR length(coalesce(btrim(p_body), '')) < 20 OR length(p_body) > 6000 THEN RAISE EXCEPTION 'subject_and_body_required'; END IF;
    SELECT string_agg(w, ', ') INTO banned FROM unnest(ARRAY['covered','cover you','cover for','insurance cover','insurance policy','policyholder','claim form','protection plan','extended warranty','excess','make a claim','insured',
      'pay by card','card payment','debit card','credit card','pay now','final demand','debt collect','bailiff','legal action']) w
     WHERE position(w IN lower(p_subject || ' ' || p_body)) > 0;
    IF banned IS NOT NULL THEN RAISE EXCEPTION 'wording_not_allowed: %', banned; END IF;
  END IF;
  payload := jsonb_build_object('plan_code', s.plan_code, 'frequency', s.frequency, 'price_minor', s.price_minor,
    'collection_day', s.collection_day, 'first_collection_date', s.first_collection_date,
    'cooling_off_ends_on', (s.cooling_off_ends_at AT TIME ZONE 'Europe/London')::date - 1, 'started_early', s.started_early,
    'terms_version', s.terms_version, 'copy', true, 'pending_review', s.status = 'pending_review',
    'account_holder_name', m.account_holder_name, 'masked_account_last4', m.masked_account_last4, 'masked_sort_last2', m.masked_sort_last2,
    'bank_name', m.bank_name, 'joined_at', s.joined_at, 'status', s.status,
    'consent', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('terms_sha256', c.terms_sha256, 'key_facts', c.key_facts,
      'key_facts_sha256', c.key_facts_sha256, 'agreed_at', c.ticked_terms_at, 'verified', c.verification_method, 'verified_at', c.verified_at,
      'channel', c.channel) END,
    'subject', left(p_subject, 150), 'body', left(p_body, 6000));
  key := 'doc:' || p_type || ':' || s.id || ':' || extract(epoch FROM clock_timestamp())::bigint;
  PERFORM public.care_queue(s.id, p_type, payload, key);
  PERFORM public.care_log(s.id, s.customer_id, 'staff', uid, 'document_sent', jsonb_build_object('type', p_type, 'subject', p_subject, 'key', key));
  RETURN jsonb_build_object('ok', true, 'dedupe_key', key);
END $$;
