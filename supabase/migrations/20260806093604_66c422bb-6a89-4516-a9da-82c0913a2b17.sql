-- ============================================================
-- Journey 2 — test isolation, snapshot integrity, safe commit
-- ============================================================

ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS test_contract_summary_id uuid,
  ADD COLUMN IF NOT EXISTS test_acceptance_id uuid,
  ADD COLUMN IF NOT EXISTS test_order_id uuid;

-- ── TEST-only: contract summary generated from the immutable snapshot ──
CREATE TABLE IF NOT EXISTS public.journey2_test_contract_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES public.journey2_test_runs(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  checkout_session_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'TEST — not a customer contract',
  status text NOT NULL DEFAULT 'issued',
  snapshot_sha256 text NOT NULL,
  summary jsonb NOT NULL,
  contract_information jsonb NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_test_cs_status_chk CHECK (status IN ('issued','accepted','superseded')),
  CONSTRAINT journey2_test_cs_hash_chk CHECK (length(snapshot_sha256) = 64)
);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_test_cs_session_uk
  ON public.journey2_test_contract_summaries (session_id);

GRANT SELECT ON public.journey2_test_contract_summaries TO authenticated;
GRANT ALL ON public.journey2_test_contract_summaries TO service_role;
ALTER TABLE public.journey2_test_contract_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Journey 2 test contract summaries" ON public.journey2_test_contract_summaries;
CREATE POLICY "Admins read Journey 2 test contract summaries"
  ON public.journey2_test_contract_summaries FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- ── TEST-only: acceptance evidence ──
CREATE TABLE IF NOT EXISTS public.journey2_test_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_contract_summary_id uuid NOT NULL
    REFERENCES public.journey2_test_contract_summaries(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'TEST — not a customer acceptance',
  snapshot_sha256 text NOT NULL,
  accepted_name text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_test_acceptance_uk
  ON public.journey2_test_acceptances (test_contract_summary_id);

GRANT SELECT ON public.journey2_test_acceptances TO authenticated;
GRANT ALL ON public.journey2_test_acceptances TO service_role;
ALTER TABLE public.journey2_test_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Journey 2 test acceptances" ON public.journey2_test_acceptances;
CREATE POLICY "Admins read Journey 2 test acceptances"
  ON public.journey2_test_acceptances FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- ── TEST-only: encrypted Direct Debit intake (never reaches a provider) ──
CREATE TABLE IF NOT EXISTS public.journey2_test_dd_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'TEST — never submitted to a provider',
  bank_details_ciphertext bytea NOT NULL,
  nonce bytea NOT NULL,
  enc_key_id text,
  enc_alg text NOT NULL DEFAULT 'AES-256-GCM',
  masked_account_last4 text NOT NULL,
  masked_sort_last2 text NOT NULL,
  bank_name text NOT NULL,
  account_holder_name text NOT NULL,
  dd_status text NOT NULL DEFAULT 'details_received',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_test_dd_status_chk
    CHECK (dd_status IN ('details_received','pending_contract','suppressed_test','setup_requested_test'))
);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_test_dd_session_uk
  ON public.journey2_test_dd_intake (session_id);

-- Encrypted bank details must never be readable by any browser role.
GRANT ALL ON public.journey2_test_dd_intake TO service_role;
ALTER TABLE public.journey2_test_dd_intake ENABLE ROW LEVEL SECURITY;

-- ── LIVE: snapshot-driven document pack ──
CREATE TABLE IF NOT EXISTS public.journey2_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  doc_type text NOT NULL,
  title text NOT NULL,
  snapshot_sha256 text NOT NULL,
  storage_key text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_documents_hash_chk CHECK (length(snapshot_sha256) = 64)
);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_documents_uk
  ON public.journey2_documents (session_id, doc_type);

GRANT SELECT ON public.journey2_documents TO authenticated;
GRANT ALL ON public.journey2_documents TO service_role;
ALTER TABLE public.journey2_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Journey 2 documents" ON public.journey2_documents;
CREATE POLICY "Admins read Journey 2 documents"
  ON public.journey2_documents FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));
DROP POLICY IF EXISTS "Customers read their own Journey 2 documents" ON public.journey2_documents;
CREATE POLICY "Customers read their own Journey 2 documents"
  ON public.journey2_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = journey2_documents.order_id
       AND (o.user_id = auth.uid() OR o.customer_id = auth.uid())
  ));

-- ── LIVE: account provisioning outbox (order commits first, account after) ──
CREATE TABLE IF NOT EXISTS public.journey2_account_provisioning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  checkout_session_id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid,
  retry_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  provisioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_provisioning_status_chk
    CHECK (status IN ('pending','provisioning','provisioned','failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_provisioning_order_uk
  ON public.journey2_account_provisioning (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_provisioning_checkout_uk
  ON public.journey2_account_provisioning (checkout_session_id);

GRANT SELECT ON public.journey2_account_provisioning TO authenticated;
GRANT ALL ON public.journey2_account_provisioning TO service_role;
ALTER TABLE public.journey2_account_provisioning ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Journey 2 account provisioning" ON public.journey2_account_provisioning;
CREATE POLICY "Admins read Journey 2 account provisioning"
  ON public.journey2_account_provisioning FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE TRIGGER journey2_provisioning_updated_at
  BEFORE UPDATE ON public.journey2_account_provisioning
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER journey2_test_cs_updated_at
  BEFORE UPDATE ON public.journey2_test_contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER journey2_test_dd_updated_at
  BEFORE UPDATE ON public.journey2_test_dd_intake
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Test sessions can never be linked to live records ──
CREATE OR REPLACE FUNCTION public.journey2_guard_test_session_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.test_session IS TRUE THEN
    IF NEW.quote_request_id IS NOT NULL OR NEW.quote_id IS NOT NULL
       OR NEW.order_journey_id IS NOT NULL OR NEW.contract_summary_id IS NOT NULL
       OR NEW.contract_acceptance_id IS NOT NULL OR NEW.payment_method_id IS NOT NULL
       OR NEW.order_id IS NOT NULL OR NEW.guest_order_id IS NOT NULL
       OR NEW.customer_id IS NOT NULL THEN
      RAISE EXCEPTION 'journey2_test_session_cannot_reference_live_records';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey2_test_session_isolation ON public.customer_journey_sessions;
CREATE TRIGGER journey2_test_session_isolation
  BEFORE INSERT OR UPDATE ON public.customer_journey_sessions
  FOR EACH ROW EXECUTE FUNCTION public.journey2_guard_test_session_isolation();

-- ── Direct Debit lifecycle transitions ──
CREATE OR REPLACE FUNCTION public.journey2_guard_dd_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed text[];
BEGIN
  IF NEW.dd_status IS NULL THEN RETURN NEW; END IF;
  IF NEW.dd_status NOT IN ('details_received','pending_contract','setup_requested',
                           'submitted_to_provider','active','failed','cancelled',
                           'suppressed_test','setup_requested_test') THEN
    RAISE EXCEPTION 'journey2_invalid_dd_status: %', NEW.dd_status;
  END IF;

  IF NEW.test_session IS TRUE
     AND NEW.dd_status NOT IN ('details_received','pending_contract',
                               'suppressed_test','setup_requested_test',
                               'failed','cancelled') THEN
    RAISE EXCEPTION 'journey2_test_dd_status_not_allowed: %', NEW.dd_status;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.dd_status IS DISTINCT FROM NEW.dd_status
     AND OLD.dd_status IS NOT NULL THEN
    allowed := CASE OLD.dd_status
      WHEN 'details_received'      THEN ARRAY['pending_contract','suppressed_test','failed','cancelled']
      WHEN 'pending_contract'      THEN ARRAY['setup_requested','setup_requested_test','suppressed_test','failed','cancelled']
      WHEN 'suppressed_test'       THEN ARRAY['setup_requested_test','failed','cancelled']
      WHEN 'setup_requested_test'  THEN ARRAY['failed','cancelled']
      WHEN 'setup_requested'       THEN ARRAY['submitted_to_provider','failed','cancelled']
      WHEN 'submitted_to_provider' THEN ARRAY['active','failed','cancelled']
      WHEN 'active'                THEN ARRAY['failed','cancelled']
      WHEN 'failed'                THEN ARRAY['details_received','pending_contract','setup_requested','cancelled']
      WHEN 'cancelled'             THEN ARRAY['details_received']
      ELSE ARRAY[]::text[]
    END;
    IF NOT (NEW.dd_status = ANY(allowed)) THEN
      RAISE EXCEPTION 'journey2_invalid_dd_transition: % -> %', OLD.dd_status, NEW.dd_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey2_dd_status_guard ON public.customer_journey_sessions;
CREATE TRIGGER journey2_dd_status_guard
  BEFORE INSERT OR UPDATE ON public.customer_journey_sessions
  FOR EACH ROW EXECUTE FUNCTION public.journey2_guard_dd_status();

-- ── Snapshot: no delete once accepted / referenced ──
CREATE OR REPLACE FUNCTION public.journey2_snapshot_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'journey2_contract_snapshot_is_immutable';
END;
$$;

DROP TRIGGER IF EXISTS journey2_snapshot_no_delete ON public.journey2_contract_snapshots;
CREATE TRIGGER journey2_snapshot_no_delete
  BEFORE DELETE ON public.journey2_contract_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.journey2_snapshot_no_delete();

-- ── Welcome outbox: explicit lifecycle ──
ALTER TABLE public.journey2_email_outbox
  DROP CONSTRAINT IF EXISTS journey2_email_outbox_status_chk;
ALTER TABLE public.journey2_email_outbox
  ADD CONSTRAINT journey2_email_outbox_status_chk
  CHECK (status IN ('pending','sending','sent','failed','cancelled'));

-- ── Reporting views ──
CREATE OR REPLACE VIEW public.journey2_live_sessions AS
  SELECT * FROM public.customer_journey_sessions WHERE test_session IS FALSE;
CREATE OR REPLACE VIEW public.journey2_test_sessions AS
  SELECT * FROM public.customer_journey_sessions WHERE test_session IS TRUE;
REVOKE ALL ON public.journey2_live_sessions FROM anon, authenticated;
REVOKE ALL ON public.journey2_test_sessions FROM anon, authenticated;
GRANT SELECT ON public.journey2_live_sessions TO service_role;
GRANT SELECT ON public.journey2_test_sessions TO service_role;

-- ============================================================
-- Final order commit: verified snapshot, no pre-created customer
-- ============================================================
DROP FUNCTION IF EXISTS public.journey2_commit_order(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.journey2_commit_order(
  _session_id uuid,
  _recomputed_sha256 text,
  _guest_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s          record;
  snap       record;
  q          record;
  j          record;
  cs         record;
  acc_id     uuid;
  pm         record;
  o_id       uuid;
  o_number   text;
  new_number text;
  recipient  text;
  p          jsonb;
BEGIN
  SELECT * INTO s FROM customer_journey_sessions WHERE id = _session_id FOR UPDATE;
  IF s IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'session_not_found'); END IF;
  IF s.test_session THEN RETURN jsonb_build_object('ok', false, 'error', 'test_session_not_allowed'); END IF;
  IF s.checkout_session_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'checkout_session_missing'); END IF;

  SELECT * INTO snap FROM journey2_contract_snapshots WHERE session_id = s.id FOR UPDATE;
  IF snap IS NULL OR snap.snapshot_sha256 IS NULL OR length(snap.snapshot_sha256) <> 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot_invalid');
  END IF;

  -- Byte-for-byte fingerprint match against the canonical recomputation.
  IF _recomputed_sha256 IS NULL OR length(_recomputed_sha256) <> 64
     OR lower(_recomputed_sha256) <> lower(snap.snapshot_sha256) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot_fingerprint_mismatch');
  END IF;

  p := snap.snapshot -> 'pricing';
  IF p IS NULL OR (p ->> 'amount_due_today')::numeric <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_due_today_must_be_zero');
  END IF;

  IF s.preferred_start_date IS NULL OR s.cooling_off_acknowledged IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'start_date_required');
  END IF;
  IF s.billing_anchor_day IS NULL OR s.dd_masked IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'billing_required');
  END IF;

  -- Contractual data must still match the accepted snapshot exactly.
  IF (snap.snapshot -> 'schedule' ->> 'preferred_start_date') IS DISTINCT FROM s.preferred_start_date::text
     OR (snap.snapshot -> 'schedule' ->> 'billing_day')::int IS DISTINCT FROM s.billing_anchor_day
     OR (snap.snapshot -> 'direct_debit' ->> 'last4') IS DISTINCT FROM (s.dd_masked ->> 'last4')
     OR (snap.snapshot -> 'direct_debit' ->> 'sort_last2') IS DISTINCT FROM (s.dd_masked ->> 'sort_last2')
     OR (snap.snapshot -> 'product' ->> 'speed_bucket') IS DISTINCT FROM s.speed_bucket
     OR (snap.snapshot -> 'product' ->> 'contract_term') IS DISTINCT FROM s.plan_term THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot_data_mismatch');
  END IF;

  SELECT * INTO q FROM quotes WHERE id = s.quote_id;
  IF q IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'quote_missing'); END IF;
  IF abs(coalesce(q.monthly_gross, -1) - (p ->> 'monthly_incl_vat')::numeric) > 0.005 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pricing_mismatch');
  END IF;

  SELECT * INTO j FROM order_journeys WHERE quote_id = q.id ORDER BY created_at DESC LIMIT 1;
  IF j IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'journey_missing'); END IF;
  IF j.contract_accepted_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'contract_not_accepted'); END IF;

  SELECT * INTO cs FROM contract_summaries
   WHERE quote_id = q.id AND status <> 'superseded'
   ORDER BY version DESC LIMIT 1;
  IF cs IS NULL OR cs.status <> 'accepted' OR cs.accepted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contract_summary_not_accepted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_information_packs WHERE contract_summary_id = cs.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contract_information_missing');
  END IF;

  SELECT id INTO acc_id FROM contract_acceptances
   WHERE contract_summary_id = cs.id ORDER BY accepted_at ASC LIMIT 1;
  IF acc_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'acceptance_evidence_missing'); END IF;

  SELECT * INTO pm FROM payment_methods WHERE journey_id = j.id AND active IS TRUE LIMIT 1;
  IF pm IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'payment_method_missing'); END IF;

  -- Idempotent order creation, enforced by the unique checkout-session index.
  SELECT id, occta_order_number INTO o_id, o_number
    FROM orders WHERE checkout_session_id = s.checkout_session_id;

  IF o_id IS NULL THEN
    new_number := generate_occta_order_number();
    INSERT INTO orders (
      user_id, customer_id, journey_id, quote_id, contract_summary_id,
      contract_acceptance_id, payment_method_id, guest_order_id,
      occta_order_number, lifecycle_status, service_type, plan_name, plan_price,
      postcode, address_line1, address_line2, city,
      preferred_start_date, cooling_off_ends_at, billing_anchor_day,
      payment_method, status, journey_version, checkout_session_id
    ) VALUES (
      -- No customer or auth account exists yet: it is provisioned after commit.
      '00000000-0000-0000-0000-000000000000', NULL, j.id, q.id, cs.id,
      acc_id, pm.id, _guest_order_id,
      new_number, 'order_received', q.service_type, q.plan_name, q.monthly_gross,
      upper(coalesce(s.postcode, '')),
      coalesce(nullif(s.service_address ->> 'address_line_1', ''), 'Address to be confirmed'),
      nullif(s.service_address ->> 'address_line_2', ''),
      coalesce(nullif(s.service_address ->> 'town', ''), 'To be confirmed'),
      s.preferred_start_date, j.cooling_off_ends_at, s.billing_anchor_day,
      pm.method, 'pending', 'v2', s.checkout_session_id
    )
    ON CONFLICT (checkout_session_id) DO NOTHING
    RETURNING id, occta_order_number INTO o_id, o_number;

    IF o_id IS NULL THEN
      SELECT id, occta_order_number INTO o_id, o_number
        FROM orders WHERE checkout_session_id = s.checkout_session_id;
    ELSE
      INSERT INTO order_status_history (order_id, previous_status, new_status, source, customer_note, metadata)
      VALUES (o_id, NULL, 'order_received', 'journey2_submit', 'Order received',
              jsonb_build_object('journey_id', j.id, 'quote_id', q.id,
                                 'checkout_session_id', s.checkout_session_id,
                                 'snapshot_sha256', snap.snapshot_sha256));
    END IF;
  END IF;

  IF o_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'order_create_failed'); END IF;

  UPDATE order_journeys
     SET order_id = o_id, status = 'completed', current_step = 'complete',
         submitted_at = coalesce(submitted_at, now()),
         completed_at = coalesce(completed_at, now())
   WHERE id = j.id;

  UPDATE payment_methods
     SET checkout_session_id = coalesce(checkout_session_id, s.checkout_session_id),
         journey_version = 'v2',
         dd_setup_status = CASE WHEN dd_setup_status IN ('active','submitted_to_provider')
                                THEN dd_setup_status ELSE 'setup_requested' END
   WHERE id = pm.id;

  recipient := coalesce(s.customer_details ->> 'email', '');

  -- Account provisioning happens strictly after this transaction commits.
  IF recipient <> '' THEN
    INSERT INTO journey2_account_provisioning (
      order_id, session_id, checkout_session_id, email, full_name, status
    ) VALUES (
      o_id, s.id, s.checkout_session_id, recipient,
      nullif(s.customer_details ->> 'full_name', ''), 'pending'
    )
    ON CONFLICT (order_id) DO NOTHING;

    INSERT INTO journey2_email_outbox (
      order_id, session_id, checkout_session_id, email_type, recipient_email, subject, attachments, status
    ) VALUES (
      o_id, s.id, s.checkout_session_id, 'journey2_welcome_pack', recipient,
      'Your OCCTA order is confirmed',
      jsonb_build_array('contract_summary','contract_information','acceptance_certificate',
                        'agreement_pack','order_summary','dd_instruction_confirmation',
                        'dd_guarantee','cooling_off_information'),
      'pending'
    )
    ON CONFLICT (order_id, email_type) DO NOTHING;
  END IF;

  UPDATE customer_journey_sessions
     SET status = 'completed', current_step = 'complete', last_completed_step = 'review',
         order_id = o_id,
         contract_summary_id = cs.id, contract_acceptance_id = acc_id,
         payment_method_id = pm.id, contract_snapshot_id = snap.id,
         dd_status = CASE WHEN dd_status IN ('active','submitted_to_provider')
                          THEN dd_status ELSE 'setup_requested' END,
         submitted_at = coalesce(submitted_at, now()),
         completed_at = coalesce(completed_at, now()),
         last_activity_at = now(), last_error = NULL
   WHERE id = s.id;

  RETURN jsonb_build_object('ok', true, 'order_id', o_id, 'order_number', o_number,
                            'snapshot_sha256', snap.snapshot_sha256);
END;
$$;

REVOKE ALL ON FUNCTION public.journey2_commit_order(uuid, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey2_commit_order(uuid, text, uuid) TO service_role;

-- ============================================================
-- Link the provisioned account back to the committed order
-- ============================================================
CREATE OR REPLACE FUNCTION public.journey2_link_provisioned_account(
  _order_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pr record;
BEGIN
  SELECT * INTO pr FROM journey2_account_provisioning WHERE order_id = _order_id FOR UPDATE;
  IF pr IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'provisioning_not_found'); END IF;
  IF pr.status = 'provisioned' AND pr.user_id = _user_id THEN
    RETURN jsonb_build_object('ok', true, 'already_provisioned', true, 'user_id', pr.user_id);
  END IF;

  UPDATE orders SET user_id = _user_id, customer_id = _user_id WHERE id = _order_id;
  UPDATE order_journeys SET customer_id = _user_id
   WHERE id = (SELECT journey_id FROM orders WHERE id = _order_id);
  UPDATE customer_journey_sessions SET customer_id = _user_id
   WHERE id = pr.session_id AND test_session IS FALSE;

  UPDATE journey2_account_provisioning
     SET status = 'provisioned', user_id = _user_id,
         provisioned_at = now(), last_attempt_at = now(), last_error = NULL
   WHERE order_id = _order_id;

  RETURN jsonb_build_object('ok', true, 'user_id', _user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.journey2_link_provisioned_account(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey2_link_provisioned_account(uuid, uuid) TO service_role;