
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

ALTER TABLE public.contract_summaries
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_archived_at ON public.profiles(archived_at);
CREATE INDEX IF NOT EXISTS idx_services_archived_at ON public.services(archived_at);

CREATE OR REPLACE FUNCTION public.admin_archive_customer(
  p_customer_id uuid,
  p_action text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_now timestamptz := now();
  v_services_updated int := 0;
  v_prs_updated int := 0;
  v_cs_updated int := 0;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  IF p_action NOT IN ('suspend','cancel','resume') THEN
    RAISE EXCEPTION 'invalid action: %', p_action;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  IF p_action = 'suspend' THEN
    UPDATE public.services
       SET status = 'suspended',
           suspension_reason = p_reason,
           updated_at = v_now
     WHERE user_id = p_customer_id
       AND status IN ('active','live','pending')
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_services_updated = ROW_COUNT;

    UPDATE public.profiles
       SET suspended_at = v_now,
           updated_at = v_now
     WHERE id = p_customer_id;

  ELSIF p_action = 'resume' THEN
    UPDATE public.services
       SET status = 'active',
           suspension_reason = NULL,
           updated_at = v_now
     WHERE user_id = p_customer_id
       AND status = 'suspended'
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_services_updated = ROW_COUNT;

    UPDATE public.profiles
       SET suspended_at = NULL,
           updated_at = v_now
     WHERE id = p_customer_id;

  ELSIF p_action = 'cancel' THEN
    UPDATE public.services
       SET status = 'cancelled',
           suspension_reason = p_reason,
           archived_at = v_now,
           archived_reason = p_reason,
           updated_at = v_now
     WHERE user_id = p_customer_id
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_services_updated = ROW_COUNT;

    UPDATE public.payment_requests
       SET status = 'cancelled',
           archived_at = v_now,
           archived_reason = p_reason,
           updated_at = v_now
     WHERE user_id = p_customer_id
       AND status IN ('draft','pending','checkout_created','sent','opened')
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_prs_updated = ROW_COUNT;

    UPDATE public.contract_summaries
       SET archived_at = v_now,
           archived_reason = p_reason,
           updated_at = v_now
     WHERE customer_id = p_customer_id
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_cs_updated = ROW_COUNT;

    UPDATE public.profiles
       SET archived_at = v_now,
           archived_reason = p_reason,
           archived_by = v_admin,
           suspended_at = NULL,
           updated_at = v_now
     WHERE id = p_customer_id;
  END IF;

  INSERT INTO public.audit_logs (action, entity, entity_id, actor_user_id, metadata)
  VALUES (
    CASE p_action WHEN 'cancel' THEN 'cancel' WHEN 'suspend' THEN 'suspend' ELSE 'resume' END,
    'profile', p_customer_id, v_admin,
    jsonb_build_object(
      'reason', p_reason,
      'services_updated', v_services_updated,
      'payment_requests_updated', v_prs_updated,
      'contract_summaries_updated', v_cs_updated
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'action', p_action,
    'services_updated', v_services_updated,
    'payment_requests_updated', v_prs_updated,
    'contract_summaries_updated', v_cs_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_archive_customer(uuid, text, text) TO authenticated;
