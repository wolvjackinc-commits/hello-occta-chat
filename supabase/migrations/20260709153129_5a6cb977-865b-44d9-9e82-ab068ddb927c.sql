
-- ============================================================================
-- Priority 2: safe archive of non-whitelist test data.
-- No hard deletes. All audit / contract / legal rows preserved.
-- ============================================================================

-- 1. Cleanup batch audit table ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_cleanup_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT,
  affected_profile_ids UUID[] NOT NULL DEFAULT '{}',
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.production_cleanup_batches TO authenticated;
GRANT ALL ON public.production_cleanup_batches TO service_role;

ALTER TABLE public.production_cleanup_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view cleanup batches" ON public.production_cleanup_batches;
CREATE POLICY "Admins can view cleanup batches"
  ON public.production_cleanup_batches FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Execute the archive as a single transactional block ---------------------
DO $$
DECLARE
  v_batch_id UUID := gen_random_uuid();
  v_whitelist UUID[] := ARRAY[
    '347597e6-809e-468d-a806-8a61b04d47b2'::uuid, -- Brian Shotton
    '74809d45-1e85-4fc2-b4a1-14340c60d2f3'::uuid, -- Chris Hutt
    '8962f90e-b142-4582-b1dc-14d372894691'::uuid, -- Dullabhbhai Mistry
    'dde98b94-41ad-44a9-bb1a-d358c00f7cc5'::uuid  -- Admin jpbaker2019
  ];
  v_targets UUID[];
  v_profiles_archived INT;
  v_services_suspended INT;
  v_fbj_blocked INT;
  v_prs_cancelled INT;
  v_roles_revoked INT;
BEGIN
  SELECT ARRAY(
    SELECT p.id FROM public.profiles p
    WHERE p.id <> ALL(v_whitelist)
  ) INTO v_targets;

  IF v_targets && v_whitelist THEN
    RAISE EXCEPTION 'Whitelist customer appeared in target set — aborting.';
  END IF;

  -- 2a. Archive profiles (soft hide, no delete).
  UPDATE public.profiles
     SET archived_at = COALESCE(archived_at, now()),
         archived_reason = COALESCE(archived_reason, 'test_account_bulk_cleanup_' || v_batch_id::text),
         admin_notes = COALESCE(admin_notes, '') ||
           E'\n[cleanup ' || to_char(now(), 'YYYY-MM-DD') || '] archived as non-whitelist test account (batch ' || v_batch_id::text || ')'
   WHERE id = ANY(v_targets)
     AND archived_at IS NULL;
  GET DIAGNOSTICS v_profiles_archived = ROW_COUNT;

  -- 2b. Suspend & disable billing on their services.
  UPDATE public.services
     SET status = 'suspended',
         billing_enabled = false,
         archived_at = COALESCE(archived_at, now())
   WHERE user_id = ANY(v_targets)
     AND status <> 'suspended';
  GET DIAGNOSTICS v_services_suspended = ROW_COUNT;

  -- 2c. Block their first_billing_jobs from the billing engine (blocker
  --     is honoured by first_billing_job_is_eligible).
  UPDATE public.first_billing_jobs
     SET blocker = 'test_account_archived',
         last_error = 'Blocked by cleanup batch ' || v_batch_id::text
   WHERE customer_id = ANY(v_targets)
     AND status IN ('pending', 'retry_scheduled');
  GET DIAGNOSTICS v_fbj_blocked = ROW_COUNT;

  -- 2d. Cancel unpaid payment requests so no live pay links remain.
  UPDATE public.payment_requests
     SET status = 'cancelled'
   WHERE user_id = ANY(v_targets)
     AND status IN ('draft','opened','sent','failed');
  GET DIAGNOSTICS v_prs_cancelled = ROW_COUNT;

  -- 2e. Revoke customer 'user' role. Admin role (if any) is preserved.
  DELETE FROM public.user_roles
   WHERE user_id = ANY(v_targets)
     AND role = 'user';
  GET DIAGNOSTICS v_roles_revoked = ROW_COUNT;

  -- 2f. Audit record.
  INSERT INTO public.production_cleanup_batches
    (id, batch_name, reason, actor, affected_profile_ids, counts, notes)
  VALUES (
    v_batch_id,
    'non_whitelist_test_data_archive',
    'Priority 2 safe cleanup: archive non-whitelist customers without destructive deletion. Whitelist: Brian Shotton, Chris Hutt, Dullabhbhai Mistry, admin jpbaker2019.',
    'system_migration',
    v_targets,
    jsonb_build_object(
      'profiles_archived', v_profiles_archived,
      'services_suspended', v_services_suspended,
      'first_billing_jobs_blocked', v_fbj_blocked,
      'payment_requests_cancelled', v_prs_cancelled,
      'roles_revoked', v_roles_revoked,
      'targets_total', array_length(v_targets, 1)
    ),
    'No hard deletes. audit_logs, contract_summaries, contract_acceptances, invoices and receipts preserved.'
  );

  RAISE NOTICE 'Cleanup batch % complete: profiles=%, services=%, fbj=%, pr=%, roles=%',
    v_batch_id, v_profiles_archived, v_services_suspended, v_fbj_blocked, v_prs_cancelled, v_roles_revoked;
END $$;

-- 3. Hide archived profiles from the admin customer search view --------------
DROP VIEW IF EXISTS public.admin_customer_search_view;
CREATE VIEW public.admin_customer_search_view
WITH (security_invoker = true) AS
SELECT p.id,
       p.full_name,
       p.email,
       p.phone,
       p.account_number,
       p.date_of_birth,
       p.created_at,
       p.updated_at,
       COALESCE(latest_order.postcode, latest_guest.postcode, p.postcode) AS latest_postcode,
       upper(replace(COALESCE(latest_order.postcode, latest_guest.postcode, p.postcode), ' '::text, ''::text)) AS latest_postcode_normalized
  FROM public.profiles p
  LEFT JOIN LATERAL (
        SELECT orders.postcode, orders.created_at
          FROM public.orders
         WHERE orders.user_id = p.id
         ORDER BY orders.created_at DESC
         LIMIT 1
  ) latest_order ON true
  LEFT JOIN LATERAL (
        SELECT guest_orders.postcode, guest_orders.created_at
          FROM public.guest_orders
         WHERE guest_orders.user_id = p.id
         ORDER BY guest_orders.created_at DESC
         LIMIT 1
  ) latest_guest ON latest_order.postcode IS NULL
 WHERE p.archived_at IS NULL;

GRANT SELECT ON public.admin_customer_search_view TO authenticated;
GRANT SELECT ON public.admin_customer_search_view TO service_role;
