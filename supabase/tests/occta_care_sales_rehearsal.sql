-- OCCTA Care Sales Desk rehearsal: agent logs a sale, call is scored, supervisor decides, documents queue.
-- Always ends by raising CARE_SALES_RESULT, so nothing is kept. "FAILS": [] means every check passed.
DO $test$
DECLARE
  AG uuid; SUP uuid; C1 uuid; s uuid; r jsonb; res jsonb := '{}'; fails jsonb := '[]'; sub uuid;
BEGIN
  SELECT user_id INTO AG FROM public.user_roles WHERE role::text = 'sales_agent' LIMIT 1;
  SELECT user_id INTO SUP FROM public.user_roles WHERE role::text = 'super_admin' LIMIT 1;
  IF AG IS NULL THEN AG := SUP; END IF;
  SELECT p.id INTO C1 FROM public.profiles p WHERE p.account_type = 'residential' AND p.archived_at IS NULL AND p.suspended_at IS NULL
    AND p.address_line1 IS NOT NULL AND p.postcode IS NOT NULL AND p.email IS NOT NULL AND p.full_name ~ '[A-Za-z]{2,} [A-Za-z]{2,}'
    AND (public.care_eligibility(p.id)->>'eligible')::boolean AND NOT coalesce((public.care_eligibility(p.id)->>'no_sales_contact')::boolean, false)
    ORDER BY p.id LIMIT 1;
  UPDATE public.care_settings SET sales_open = true WHERE singleton;

  -- agent logs the sale
  PERFORM set_config('request.jwt.claims', json_build_object('sub', AG, 'role', 'authenticated')::text, true);
  res := res || jsonb_build_object('role_agent', public.care_sales_role(AG), 'find', jsonb_array_length(public.care_sales_find_customer((SELECT postcode FROM public.profiles WHERE id = C1))) > 0);
  r := public.care_sales_create(C1, 'essentials', 'monthly', 1, 'ZOOM-TEST-1', now() - interval '10 minutes', 'Rehearsal sale');
  s := (r->>'id')::uuid; res := res || jsonb_build_object('ref', r->>'reference');
  BEGIN PERFORM public.care_sales_create(C1, 'essentials', 'monthly', 1, 'ZOOM-TEST-2', now(), 'dup'); fails := fails || '"duplicate_sale_allowed"';
  EXCEPTION WHEN others THEN NULL; END;
  -- edge function saves the score (service role path)
  PERFORM public.care_sales_save_qa(s, repeat('Agent: hello. ', 40), 'audio_local', '{"red_flags":[]}'::jsonb, 72, 'hold', 'claude-sonnet-5-5');
  res := res || jsonb_build_object('after_qa', (SELECT status FROM public.care_sales WHERE id = s));
  IF (SELECT status FROM public.care_sales WHERE id = s) <> 'held' THEN fails := fails || '"qa_not_held"'; END IF;
  -- agent can't approve; agent can see own list
  IF AG <> SUP THEN
    BEGIN PERFORM public.care_sales_decide(s, 'approve', 'I approve my own sale'); fails := fails || '"agent_approved"';
    EXCEPTION WHEN others THEN res := res || jsonb_build_object('agent_decide', left(SQLERRM, 30)); END;
  END IF;
  res := res || jsonb_build_object('mine', jsonb_array_length(public.care_sales_list('mine', NULL)));
  -- supervisor approves
  PERFORM set_config('request.jwt.claims', json_build_object('sub', SUP, 'role', 'authenticated')::text, true);
  IF AG <> SUP THEN
    r := public.care_sales_decide(s, 'approve', 'Listened to the call, customer clearly agreed');
    res := res || jsonb_build_object('approved', (SELECT status FROM public.care_sales WHERE id = s));
    IF (SELECT status FROM public.care_sales WHERE id = s) <> 'approved' THEN fails := fails || '"not_approved"'; END IF;
  END IF;
  res := res || jsonb_build_object('report', public.care_sales_report() IS NOT NULL, 'get', public.care_sales_get(s) ? 'status');
  r := public.care_sales_withdraw(s, 'Rehearsal finished');
  IF (SELECT status FROM public.care_sales WHERE id = s) <> 'withdrawn' THEN fails := fails || '"not_withdrawn"'; END IF;

  -- document generator on any subscription that exists, else skip
  SELECT id INTO sub FROM public.care_subscriptions LIMIT 1;
  IF sub IS NOT NULL THEN
    BEGIN PERFORM public.care_admin_queue_document(sub, 'general_letter', 'Test', 'This plan is insurance cover for your router.'); fails := fails || '"banned_words_allowed"';
    EXCEPTION WHEN others THEN NULL; END;
    res := res || jsonb_build_object('doc', public.care_admin_queue_document(sub, 'agreement_copy', NULL, NULL));
  END IF;
  res := res || jsonb_build_object('FAILS', fails, 'hardening', current_setting('care.h', true)::jsonb);
  RAISE EXCEPTION 'CARE_SALES_RESULT %', res;
END $test$;
