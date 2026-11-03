-- OCCTA Care Sales Desk: agents log a phone sale with its call recording,
-- the call is scored against the Care script, and only a passed (or
-- supervisor-approved) sale can send the customer their sign-up link.
-- Plus on-demand Care documents for staff (resend, agreement copy, letter).
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.care_sale_seq START 1001;

CREATE TABLE IF NOT EXISTS public.care_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('CARE-SALE-' || nextval('public.care_sale_seq')::text),
  agent_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id),
  plan_code text NOT NULL REFERENCES public.care_plans(code),
  frequency text NOT NULL CHECK (frequency IN ('monthly','quarterly','annual')),
  collection_day integer NOT NULL CHECK (collection_day IN (1, 15)),
  call_reference text NOT NULL CHECK (length(call_reference) BETWEEN 3 AND 120),
  call_at timestamptz NOT NULL,
  agent_notes text CHECK (agent_notes IS NULL OR length(agent_notes) <= 2000),
  status text NOT NULL DEFAULT 'awaiting_recording'
    CHECK (status IN ('awaiting_recording','scoring','passed','held','declined','approved','link_sent','joined','withdrawn')),
  recording_path text,
  recording_bytes bigint,
  transcript text,
  transcript_source text CHECK (transcript_source IS NULL OR transcript_source IN ('audio_auto','pasted')),
  qa jsonb,
  qa_score integer,
  qa_decision text CHECK (qa_decision IS NULL OR qa_decision IN ('pass','hold','decline')),
  qa_model text,
  qa_at timestamptz,
  supervisor_id uuid,
  supervisor_decision text CHECK (supervisor_decision IS NULL OR supervisor_decision IN ('approve','decline')),
  supervisor_note text,
  supervisor_at timestamptz,
  invite_id uuid REFERENCES public.care_invites(id),
  subscription_id uuid REFERENCES public.care_subscriptions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_sales_agent ON public.care_sales(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_sales_status ON public.care_sales(status, created_at DESC);
DROP TRIGGER IF EXISTS trg_care_sales_updated ON public.care_sales;
CREATE TRIGGER trg_care_sales_updated BEFORE UPDATE ON public.care_sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.care_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_sales FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.care_sales TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.care_sale_seq TO service_role;

INSERT INTO storage.buckets(id, name, public) VALUES ('care-sales', 'care-sales', false) ON CONFLICT (id) DO NOTHING;

-- 'agent' = sales_agent; 'supervisor' = sales_admin / compliance_admin / admin / super_admin.
CREATE OR REPLACE FUNCTION public.care_sales_role(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('sales_admin','compliance_admin','admin','super_admin')) THEN 'supervisor'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text = 'sales_agent') THEN 'agent'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.care_sales_require() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_role(auth.uid());
BEGIN
  IF r IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN r;
END $$;

-- Agents find the caller's OCCTA account. Minimal fields; exact identifiers only.
CREATE OR REPLACE FUNCTION public.care_sales_find_customer(p_query text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := lower(btrim(coalesce(p_query, ''))); digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
BEGIN
  PERFORM public.care_sales_require();
  IF length(q) < 4 THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.full_name, 'account_number', p.account_number, 'postcode', p.postcode,
      'address_line1', p.address_line1, 'email_masked', regexp_replace(coalesce(p.email, ''), '^(.{2}).*(@.*)$', '\1***\2'),
      'eligibility', public.care_eligibility(p.id) - 'date_of_birth_known')) FROM (
    SELECT * FROM public.profiles p
     WHERE lower(p.account_number) = q OR lower(p.email) = q
        OR (length(digits) >= 10 AND regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') LIKE '%' || right(digits, 10))
        OR (length(q) >= 5 AND replace(lower(p.postcode), ' ', '') = replace(q, ' ', ''))
     LIMIT 10) p), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.care_sales_create(p_customer uuid, p_plan text, p_frequency text, p_day integer,
  p_call_reference text, p_call_at timestamptz, p_notes text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); elig jsonb; sid uuid; ref text;
BEGIN
  IF public.care_price_minor(p_plan, p_frequency) IS NULL OR p_day NOT IN (1, 15) THEN RAISE EXCEPTION 'invalid_choice'; END IF;
  IF length(coalesce(btrim(p_call_reference), '')) < 3 THEN RAISE EXCEPTION 'call_reference_required'; END IF;
  IF p_call_at IS NULL OR p_call_at > now() + interval '5 minutes' OR p_call_at < now() - interval '7 days' THEN RAISE EXCEPTION 'call_time_must_be_within_last_7_days'; END IF;
  elig := public.care_eligibility(p_customer);
  IF NOT (elig->>'eligible')::boolean THEN RAISE EXCEPTION 'customer_not_eligible: %', elig->'reasons'; END IF;
  IF coalesce((elig->>'no_sales_contact')::boolean, false) THEN RAISE EXCEPTION 'customer_asked_for_no_offers'; END IF;
  IF EXISTS (SELECT 1 FROM public.care_sales WHERE customer_id = p_customer AND status IN ('awaiting_recording','scoring','passed','held','approved','link_sent')) THEN
    RAISE EXCEPTION 'customer_already_has_an_open_care_sale';
  END IF;
  INSERT INTO public.care_sales(agent_id, customer_id, plan_code, frequency, collection_day, call_reference, call_at, agent_notes)
  VALUES (uid, p_customer, p_plan, p_frequency, p_day, btrim(p_call_reference), p_call_at, nullif(left(p_notes, 2000), ''))
  RETURNING id, reference INTO sid, ref;
  PERFORM public.care_log(NULL, p_customer, 'staff', uid, 'care_sale_logged', jsonb_build_object('sale_id', sid, 'reference', ref, 'plan', p_plan, 'frequency', p_frequency));
  RETURN jsonb_build_object('ok', true, 'id', sid, 'reference', ref);
END $$;

-- Keeps sale status in step with the customer's own sign-up.
CREATE OR REPLACE FUNCTION public.care_sales_refresh(p_sale uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.care_sales cs SET status = 'joined', subscription_id = sub.id
    FROM public.care_subscriptions sub
   WHERE cs.id = p_sale AND cs.status = 'link_sent' AND cs.invite_id IS NOT NULL AND sub.invite_id = cs.invite_id
$$;

CREATE OR REPLACE FUNCTION public.care_sales_list(p_scope text DEFAULT 'mine', p_status text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid();
BEGIN
  UPDATE public.care_sales cs SET status = 'joined', subscription_id = sub.id FROM public.care_subscriptions sub
   WHERE cs.status = 'link_sent' AND sub.invite_id = cs.invite_id;
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
    SELECT cs.id, cs.reference, cs.status, cs.plan_code, cs.frequency, cs.qa_score, cs.qa_decision, cs.supervisor_decision,
           cs.call_reference, cs.call_at, cs.created_at, p.full_name AS customer_name, p.account_number,
           (SELECT full_name FROM public.profiles WHERE id = cs.agent_id) AS agent_name, sub.reference AS care_reference, sub.status AS care_status
      FROM public.care_sales cs JOIN public.profiles p ON p.id = cs.customer_id
      LEFT JOIN public.care_subscriptions sub ON sub.id = cs.subscription_id
     WHERE (cs.agent_id = uid OR (r = 'supervisor' AND p_scope = 'all'))
       AND (p_status IS NULL OR cs.status = p_status)
     ORDER BY cs.created_at DESC LIMIT 300) x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.care_sales_get(p_sale uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); s record;
BEGIN
  PERFORM public.care_sales_refresh(p_sale);
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale;
  IF NOT FOUND OR (s.agent_id <> uid AND r <> 'supervisor') THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN to_jsonb(s) || jsonb_build_object('role', r,
    'customer', (SELECT jsonb_build_object('name', full_name, 'account_number', account_number, 'postcode', postcode,
       'email_masked', regexp_replace(coalesce(email, ''), '^(.{2}).*(@.*)$', '\1***\2')) FROM public.profiles WHERE id = s.customer_id),
    'agent_name', (SELECT full_name FROM public.profiles WHERE id = s.agent_id),
    'supervisor_name', (SELECT full_name FROM public.profiles WHERE id = s.supervisor_id),
    'invite', (SELECT jsonb_build_object('sent_at', created_at, 'expires_at', expires_at, 'used_at', used_at, 'revoked_at', revoked_at, 'email_status', email_status)
       FROM public.care_invites WHERE id = s.invite_id),
    'care', (SELECT jsonb_build_object('reference', reference, 'status', status) FROM public.care_subscriptions WHERE id = s.subscription_id),
    'price_minor', public.care_price_minor(s.plan_code, s.frequency));
END $$;

-- Supervisor decision on a held (or any scored) sale. Never on an unscored one.
CREATE OR REPLACE FUNCTION public.care_sales_decide(p_sale uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); s record;
BEGIN
  IF r <> 'supervisor' THEN RAISE EXCEPTION 'supervisor_only'; END IF;
  IF p_decision NOT IN ('approve','decline') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF length(coalesce(btrim(p_note), '')) < 10 THEN RAISE EXCEPTION 'note_required_min_10_chars'; END IF;
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.status NOT IN ('passed','held','declined') THEN RAISE EXCEPTION 'sale_not_scored_or_already_actioned'; END IF;
  IF p_decision = 'approve' AND s.agent_id = uid THEN RAISE EXCEPTION 'cannot_approve_your_own_sale'; END IF;
  IF p_decision = 'approve' AND (s.qa->'red_flags') @> '[{"severity":"decline"}]'::jsonb THEN
    RAISE EXCEPTION 'sale_has_a_decline_red_flag: it cannot be approved; ask the customer to join themselves';
  END IF;
  UPDATE public.care_sales SET supervisor_id = uid, supervisor_decision = p_decision, supervisor_note = left(p_note, 2000), supervisor_at = now(),
    status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'declined' END WHERE id = s.id;
  PERFORM public.care_log(NULL, s.customer_id, 'staff', uid, 'care_sale_' || p_decision, jsonb_build_object('sale_id', s.id, 'note', p_note));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.care_sales_withdraw(p_sale uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require(); uid uuid := auth.uid(); s record;
BEGIN
  SELECT * INTO s FROM public.care_sales WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND OR (s.agent_id <> uid AND r <> 'supervisor') THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.status IN ('joined','withdrawn') THEN RAISE EXCEPTION 'cannot_withdraw'; END IF;
  UPDATE public.care_sales SET status = 'withdrawn', agent_notes = left(coalesce(agent_notes || E'\n', '') || 'Withdrawn: ' || coalesce(p_note, ''), 2000) WHERE id = s.id;
  IF s.invite_id IS NOT NULL THEN
    UPDATE public.care_invites SET revoked_at = now(), revoked_reason = 'sale withdrawn' WHERE id = s.invite_id AND used_at IS NULL AND revoked_at IS NULL;
  END IF;
  PERFORM public.care_log(NULL, s.customer_id, 'staff', uid, 'care_sale_withdrawn', jsonb_build_object('sale_id', s.id, 'note', p_note));
  RETURN jsonb_build_object('ok', true);
END $$;

-- Sales report for supervisors.
CREATE OR REPLACE FUNCTION public.care_sales_report() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.care_sales_require();
BEGIN
  IF r <> 'supervisor' THEN RAISE EXCEPTION 'supervisor_only'; END IF;
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.sales DESC) FROM (
    SELECT cs.agent_id, (SELECT full_name FROM public.profiles WHERE id = cs.agent_id) AS agent, count(*) AS sales,
      round(avg(cs.qa_score)) AS avg_score,
      count(*) FILTER (WHERE cs.qa_decision = 'pass') AS passed, count(*) FILTER (WHERE cs.qa_decision = 'hold') AS held,
      count(*) FILTER (WHERE cs.qa_decision = 'decline') AS declined, count(*) FILTER (WHERE cs.status = 'joined') AS joined,
      count(*) FILTER (WHERE sub.status IN ('active','cancel_pending') AND sub.joined_at < now() - interval '90 days') AS active_after_90_days,
      count(*) FILTER (WHERE sub.cancel_channel = 'in_cooling_off') AS cancelled_in_cooling_off,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.care_disputes d WHERE d.subscription_id = sub.id AND d.kind = 'indemnity_claim')) AS indemnity_claims
    FROM public.care_sales cs LEFT JOIN public.care_subscriptions sub ON sub.id = cs.subscription_id
    WHERE cs.created_at > now() - interval '12 months' GROUP BY cs.agent_id) x), '[]'::jsonb);
END $$;

-- Service role: save the score (called by the care-sales edge function).
CREATE OR REPLACE FUNCTION public.care_sales_save_qa(p_sale uuid, p_transcript text, p_source text, p_qa jsonb, p_score integer, p_decision text, p_model text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.care_sales SET transcript = p_transcript, transcript_source = p_source, qa = p_qa, qa_score = p_score, qa_decision = p_decision,
    qa_model = p_model, qa_at = now(), status = CASE p_decision WHEN 'pass' THEN 'passed' WHEN 'hold' THEN 'held' ELSE 'declined' END,
    supervisor_id = NULL, supervisor_decision = NULL, supervisor_note = NULL, supervisor_at = NULL
  WHERE id = p_sale AND status IN ('awaiting_recording','scoring','passed','held','declined')
$$;

-- ---------------------------------------------------------------------------
-- On-demand documents for a member (resend, agreement copy, staff letter)
-- ---------------------------------------------------------------------------
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
    SELECT string_agg(w, ', ') INTO banned FROM unnest(ARRAY['covered','cover you','protection plan','extended warranty','excess','make a claim','insured',
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['care_sales_role(uuid)','care_sales_require()','care_sales_find_customer(text)',
    'care_sales_create(uuid,text,text,integer,text,timestamptz,text)','care_sales_list(text,text)','care_sales_get(uuid)',
    'care_sales_decide(uuid,text,text)','care_sales_withdraw(uuid,text)','care_sales_report()',
    'care_admin_queue_document(uuid,text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['care_sales_refresh(uuid)','care_sales_save_qa(uuid,text,text,jsonb,integer,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
