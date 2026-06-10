
DROP FUNCTION IF EXISTS public.get_customer_quote_requests();

CREATE FUNCTION public.get_customer_quote_requests()
RETURNS TABLE (
  id uuid, reference text, postcode text,
  service_interest text, plan_preference text, customer_type text,
  status text, message text, customer_facing_message text,
  final_quote_id uuid, source text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, reference, postcode,
         service_interest::text, plan_preference::text, customer_type::text,
         status::text, message, customer_facing_message, final_quote_id, source, created_at
  FROM public.quote_requests
  WHERE (customer_id IS NOT NULL AND customer_id = auth.uid())
     OR (
       customer_id IS NULL
       AND auth.uid() IS NOT NULL
       AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
       AND length(COALESCE(auth.jwt() ->> 'email', '')) > 0
     )
  ORDER BY created_at DESC
  LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION public.get_customer_quote_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_quote_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_quotes()
RETURNS TABLE (
  id uuid, quote_number text, plan_name text,
  service_type text, plan_type text, customer_type text, status text,
  monthly_net numeric, monthly_gross numeric,
  setup_gross numeric, router_gross numeric, installation_gross numeric, delivery_gross numeric,
  total_due_today_gross numeric, contract_length_months integer, notice_period text,
  expires_at timestamptz, approved_at timestamptz, customer_notes text,
  created_at timestamptz, quote_request_reference text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.quote_number, q.plan_name,
         q.service_type::text, q.plan_type::text, q.customer_type::text, q.status::text,
         q.monthly_net, q.monthly_gross,
         q.setup_gross, q.router_gross, q.installation_gross, q.delivery_gross,
         q.total_due_today_gross, q.contract_length_months, q.notice_period,
         q.expires_at, q.approved_at, q.customer_notes, q.created_at,
         qr.reference
  FROM public.quotes q
  LEFT JOIN public.quote_requests qr ON qr.id = q.quote_request_id
  WHERE q.customer_id = auth.uid()
    AND q.status::text IN ('approved','sent','viewed','accepted','expired')
  ORDER BY q.created_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_quote_by_id(_id uuid)
RETURNS TABLE (
  id uuid, quote_number text, plan_name text,
  service_type text, plan_type text, customer_type text, status text,
  monthly_net numeric, monthly_vat_amount numeric, monthly_gross numeric,
  setup_gross numeric, router_gross numeric, installation_gross numeric, delivery_gross numeric,
  total_due_today_gross numeric, contract_length_months integer, notice_period text,
  price_rise_policy text, expires_at timestamptz, approved_at timestamptz,
  customer_notes text,
  estimated_download_speed integer, estimated_upload_speed integer, speed_notes text,
  quote_request_reference text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.id, q.quote_number, q.plan_name,
         q.service_type::text, q.plan_type::text, q.customer_type::text, q.status::text,
         q.monthly_net, q.monthly_vat_amount, q.monthly_gross,
         q.setup_gross, q.router_gross, q.installation_gross, q.delivery_gross,
         q.total_due_today_gross, q.contract_length_months, q.notice_period,
         q.price_rise_policy, q.expires_at, q.approved_at, q.customer_notes,
         q.estimated_download_speed, q.estimated_upload_speed, q.speed_notes,
         qr.reference
  FROM public.quotes q
  LEFT JOIN public.quote_requests qr ON qr.id = q.quote_request_id
  WHERE q.id = _id
    AND q.customer_id = auth.uid()
    AND q.status::text IN ('approved','sent','viewed','accepted','expired')
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_customer_quotes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_customer_quote_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_quotes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_quote_by_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_final_quote(_quote_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_qr uuid; v_snapshot jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _quote_id IS NULL THEN RAISE EXCEPTION 'invalid args'; END IF;
  IF NOT public.can_send_quote(_quote_id) THEN
    RAISE EXCEPTION 'margin check failed — approve blocked. Run margin check or log an override.';
  END IF;
  SELECT to_jsonb(q.*) INTO v_snapshot FROM public.quotes q WHERE q.id = _quote_id;
  IF v_snapshot IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF;

  UPDATE public.quotes
  SET status = 'approved'::public.quote_status_kind,
      approved_at = COALESCE(approved_at, now()),
      approved_by = COALESCE(approved_by, v_actor),
      final_snapshot = COALESCE(final_snapshot, v_snapshot),
      updated_at = now()
  WHERE id = _quote_id
  RETURNING quote_request_id INTO v_qr;

  IF v_qr IS NOT NULL THEN
    UPDATE public.quote_requests
    SET status = 'final_quote_ready'::public.quote_request_status,
        final_quote_id = _quote_id,
        updated_at = now()
    WHERE id = v_qr;
  END IF;

  INSERT INTO public.quote_events(quote_id, quote_request_id, event_type, title, actor_type, actor_id, details)
  VALUES (_quote_id, v_qr, 'quote_approved', 'Final quote approved', 'admin', v_actor,
          jsonb_build_object('approved_by', v_actor));

  INSERT INTO public.audit_logs(actor_user_id, action, entity, entity_id, metadata)
  VALUES (v_actor, 'admin_approve_final_quote', 'quotes', _quote_id,
          jsonb_build_object('quote_request_id', v_qr));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_request_more_info(_qr_id uuid, _message text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _qr_id IS NULL OR _message IS NULL OR length(trim(_message)) < 4 THEN
    RAISE EXCEPTION 'message required (min 4 chars)';
  END IF;
  UPDATE public.quote_requests
  SET status = 'needs_info'::public.quote_request_status,
      customer_facing_message = left(_message, 2000),
      updated_at = now()
  WHERE id = _qr_id;
  INSERT INTO public.quote_events(quote_request_id, event_type, title, actor_type, actor_id, details)
  VALUES (_qr_id, 'needs_info', 'More info requested from customer', 'admin', v_actor,
          jsonb_build_object('message_preview', left(_message, 200)));
  INSERT INTO public.audit_logs(actor_user_id, action, entity, entity_id, metadata)
  VALUES (v_actor, 'admin_request_more_info', 'quote_requests', _qr_id,
          jsonb_build_object('message', left(_message, 1000)));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_quote_request(_qr_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_staff(v_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _qr_id IS NULL OR _reason IS NULL OR length(trim(_reason)) < 4 THEN
    RAISE EXCEPTION 'reason required';
  END IF;
  UPDATE public.quote_requests
  SET status = 'rejected'::public.quote_request_status, updated_at = now()
  WHERE id = _qr_id;
  INSERT INTO public.quote_events(quote_request_id, event_type, title, actor_type, actor_id, details)
  VALUES (_qr_id, 'request_rejected', 'Quote request rejected', 'admin', v_actor,
          jsonb_build_object('reason_preview', left(_reason, 200)));
  INSERT INTO public.audit_logs(actor_user_id, action, entity, entity_id, metadata)
  VALUES (v_actor, 'admin_reject_quote_request', 'quote_requests', _qr_id,
          jsonb_build_object('reason', left(_reason, 1000)));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_approve_final_quote(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_request_more_info(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_quote_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_final_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_more_info(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_quote_request(uuid, text) TO authenticated;
