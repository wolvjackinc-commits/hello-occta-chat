-- Owner-only "Delete customer": hides the customer from the admin list and stops
-- every automatic email, invoice, Direct Debit, letter and billing job for them.
-- Records are kept (tombstone), not hard-deleted — invoices must be retained for HMRC.
-- The passcode hash lives in owner_passcodes and is set outside git (public repo).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.owner_passcodes (
  name text PRIMARY KEY,
  hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_passcodes ENABLE ROW LEVEL SECURITY; -- no policies: nobody reads it via the API
REVOKE ALL ON public.owner_passcodes FROM anon, authenticated;

-- Used by every email sender as a last-line guard.
CREATE OR REPLACE FUNCTION public.is_deleted_customer_email(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE deleted_at IS NOT NULL AND lower(btrim(email)) = lower(btrim(p_email)));
$$;
REVOKE ALL ON FUNCTION public.is_deleted_customer_email(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_deleted_customer_email(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_customer(p_customer_id uuid, p_passcode text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_now timestamptz := now();
  v_hash text;
  v_p public.profiles%ROWTYPE;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Deleted by owner');
  n jsonb := '{}'::jsonb;
  c int;
BEGIN
  IF v_admin IS NULL OR NOT (public.has_role(v_admin, 'admin') OR public.has_role(v_admin, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  -- 5 wrong passcodes per hour per admin. Wrong attempts return (not raise) so their audit row is kept.
  IF (SELECT count(*) FROM public.audit_logs WHERE action = 'delete_denied' AND actor_user_id = v_admin
      AND created_at > v_now - interval '1 hour') >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many attempts. Try again in an hour.');
  END IF;
  SELECT hash INTO v_hash FROM public.owner_passcodes WHERE name = 'customer_delete';
  IF v_hash IS NULL OR p_passcode IS NULL OR crypt(p_passcode, v_hash) <> v_hash THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, actor_user_id, metadata)
    VALUES ('delete_denied', 'profile', p_customer_id, v_admin, jsonb_build_object('reason', 'wrong_passcode'));
    RETURN jsonb_build_object('ok', false, 'error', 'Wrong passcode');
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Customer not found'); END IF;
  IF v_p.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'already_deleted', true); END IF;

  -- 1. Mark deleted FIRST so the email guard blocks anything the updates below trigger
  --    (e.g. trg_dd_mandate_notify firing a "DD cancelled" email).
  UPDATE public.profiles SET deleted_at = v_now, archived_at = coalesce(archived_at, v_now),
    archived_reason = 'DELETED: ' || v_reason, archived_by = v_admin, updated_at = v_now
  WHERE id = p_customer_id;
  IF v_p.email IS NOT NULL AND btrim(v_p.email) <> '' THEN
    INSERT INTO public.outreach_suppressions (email, reason, source, note, created_by)
    VALUES (lower(btrim(v_p.email)), 'manual', 'customer_deleted', v_reason, v_admin)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  -- 2. Billing: no more recurring or first bills, unpaid invoices voided, add-ons off.
  UPDATE public.services SET status = 'ceased', billing_enabled = false, next_billing_date = NULL,
    archived_at = coalesce(archived_at, v_now), archived_reason = coalesce(archived_reason, 'DELETED: ' || v_reason)
  WHERE user_id = p_customer_id AND status <> 'ceased';
  GET DIAGNOSTICS c = ROW_COUNT; n := n || jsonb_build_object('services', c);
  UPDATE public.invoices SET status = 'cancelled'
  WHERE user_id = p_customer_id AND status IN ('draft', 'issued', 'sent', 'overdue');
  GET DIAGNOSTICS c = ROW_COUNT; n := n || jsonb_build_object('invoices', c);
  UPDATE public.recurring_billing_addons SET active = false WHERE user_id = p_customer_id AND active;
  UPDATE public.first_billing_jobs SET status = 'cancelled', last_error = 'customer_deleted'
  WHERE customer_id = p_customer_id AND status NOT IN ('done', 'processed', 'cancelled');
  UPDATE public.payment_requests SET status = 'cancelled'
  WHERE user_id = p_customer_id AND status IN ('draft', 'pending', 'sent', 'opened', 'checkout_created');
  GET DIAGNOSTICS c = ROW_COUNT; n := n || jsonb_build_object('payment_requests', c);

  -- 3. Direct Debits (broadband + Care).
  UPDATE public.dd_mandates SET status = 'cancelled'
  WHERE user_id = p_customer_id AND status NOT IN ('cancelled', 'rejected', 'failed');
  GET DIAGNOSTICS c = ROW_COUNT; n := n || jsonb_build_object('dd_mandates', c);
  UPDATE public.dd_email_outbox SET status = 'cancelled', last_error = 'customer_deleted'
  WHERE status IN ('pending', 'failed') AND mandate_id IN (SELECT id FROM public.dd_mandates WHERE user_id = p_customer_id);
  UPDATE public.care_subscriptions SET status = 'cancelled'
  WHERE customer_id = p_customer_id AND status NOT IN ('cancelled', 'declined');
  GET DIAGNOSTICS c = ROW_COUNT; n := n || jsonb_build_object('care_subscriptions', c);
  UPDATE public.care_mandates SET status = 'cancelled'
  WHERE customer_id = p_customer_id AND status NOT IN ('cancelled', 'rejected');
  -- Collections already in a submitted run are money in flight; leave those for manual handling.
  UPDATE public.care_collections SET status = 'cancelled', cancelled_reason = 'customer_deleted'
  WHERE status IN ('scheduled', 'ready')
    AND subscription_id IN (SELECT id FROM public.care_subscriptions WHERE customer_id = p_customer_id);

  -- 4. Queued messages and posted letters.
  UPDATE public.care_letters SET status = 'cancelled', error = 'customer_deleted'
  WHERE customer_id = p_customer_id AND status IN ('rendering', 'posting', 'awaiting_print', 'in_batch', 'needs_manual', 'failed');
  UPDATE public.care_outbox SET status = 'done', last_error = 'customer_deleted', finished_at = v_now
  WHERE customer_id = p_customer_id AND status IN ('pending', 'failed');
  UPDATE public.referral_message_outbox SET status = 'suppressed', last_error = 'customer_deleted'
  WHERE customer_id = p_customer_id AND status IN ('pending', 'failed');
  UPDATE public.promotion_message_outbox SET status = 'suppressed', last_error = 'customer_deleted'
  WHERE customer_id = p_customer_id AND status IN ('pending', 'failed');
  UPDATE public.service_activation_outbox SET status = 'cancelled', last_error = 'customer_deleted'
  WHERE status NOT IN ('sent', 'done', 'cancelled')
    AND service_id IN (SELECT id FROM public.services WHERE user_id = p_customer_id);
  IF v_p.email IS NOT NULL THEN
    UPDATE public.installation_bookings SET status = 'cancelled'
    WHERE status = 'confirmed' AND lower(customer_email) = lower(v_p.email);
    UPDATE public.journey2_email_outbox SET status = 'cancelled', last_error = 'customer_deleted'
    WHERE status IN ('pending', 'failed') AND lower(recipient_email) = lower(v_p.email);
    UPDATE public.cancellation_email_outbox SET status = 'cancelled', last_error = 'customer_deleted'
    WHERE status NOT IN ('sent', 'cancelled') AND lower(recipient_email) = lower(v_p.email);
  END IF;

  -- 5. SIM plans.
  UPDATE public.sim_orders SET status = 'cancelled'
  WHERE customer_id = p_customer_id AND status NOT IN ('cancelled', 'failed');
  GET DIAGNOSTICS c = ROW_COUNT; n := n || jsonb_build_object('sim_orders', c);

  INSERT INTO public.account_deletions (original_user_id, email, full_name, account_number, reason, deleted_by)
  VALUES (p_customer_id, coalesce(v_p.email, ''), v_p.full_name, v_p.account_number, v_reason, 'owner:' || v_admin);
  INSERT INTO public.audit_logs (action, entity, entity_id, actor_user_id, metadata)
  VALUES ('delete', 'profile', p_customer_id, v_admin, jsonb_build_object('reason', v_reason, 'counts', n));
  RETURN jsonb_build_object('ok', true, 'counts', n);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_customer(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_customer(uuid, text, text) TO authenticated;
