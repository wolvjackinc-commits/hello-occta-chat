-- OCCTA consumer contract v2026.10.1 production hardening.
-- Forward-only: no historic accepted document, acceptance, PDF or hash is rewritten.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS consumer_contract_release_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consumer_contract_release_version text NOT NULL DEFAULT '2026.10.1';

ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS supplier_address_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS supplier_availability_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS supplier_availability_sha256 text,
  ADD COLUMN IF NOT EXISTS supplier_availability_retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_availability_source text,
  ADD COLUMN IF NOT EXISTS likely_service_date date;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS supplier_address_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS supplier_availability_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS supplier_availability_sha256 text,
  ADD COLUMN IF NOT EXISTS supplier_availability_retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_availability_source text,
  ADD COLUMN IF NOT EXISTS likely_service_date date;

ALTER TABLE public.contract_summaries
  ADD COLUMN IF NOT EXISTS body_snapshot_sha256 text,
  ADD COLUMN IF NOT EXISTS likely_service_date date;

ALTER TABLE public.contract_information_packs
  ADD COLUMN IF NOT EXISTS body_snapshot_sha256 text,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text;

CREATE TABLE IF NOT EXISTS public.customer_vulnerability_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL UNIQUE,
  customer_id uuid,
  contract_acceptance_id uuid REFERENCES public.contract_acceptances(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cleared','not_required')),
  reason_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
);

ALTER TABLE public.customer_vulnerability_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage vulnerability reviews" ON public.customer_vulnerability_reviews;
CREATE POLICY "Staff manage vulnerability reviews"
ON public.customer_vulnerability_reviews
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'compliance_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'compliance_admin'::app_role)
);

ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS contract_summary_body_sha256 text,
  ADD COLUMN IF NOT EXISTS contract_information_pack_body_sha256 text,
  ADD COLUMN IF NOT EXISTS contract_information_pack_pdf_sha256 text,
  ADD COLUMN IF NOT EXISTS otp_challenge_id uuid REFERENCES public.sms_otp_challenges(id),
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS early_start_requested boolean,
  ADD COLUMN IF NOT EXISTS early_start_consent boolean,
  ADD COLUMN IF NOT EXISTS digital_voice_acknowledged boolean;

COMMENT ON COLUMN public.contract_information_packs.pdf_hash IS
  'Legacy ambiguous hash column. Historical rows may contain a logical body hash. New v2026.10.1 logic MUST use body_snapshot_sha256 for the logical body and pdf_sha256 for actual PDF bytes.';
COMMENT ON COLUMN public.contract_information_packs.body_snapshot_sha256 IS
  'SHA-256 of the canonical logical Contract Information body/snapshot.';
COMMENT ON COLUMN public.contract_information_packs.pdf_sha256 IS
  'SHA-256 of the exact immutable Contract Information PDF bytes.';
COMMENT ON COLUMN public.contract_summaries.body_snapshot_sha256 IS
  'SHA-256 of the canonical commercial/legal Contract Summary snapshot used to render the document.';

-- The pause becomes an explicit release switch. Default remains fail-closed.
CREATE OR REPLACE FUNCTION public.enforce_consumer_contract_release_pause()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  customer_kind text;
  release_enabled boolean := false;
  release_version text := null;
BEGIN
  SELECT coalesce(ps.consumer_contract_release_enabled, false), ps.consumer_contract_release_version
    INTO release_enabled, release_version
    FROM public.platform_settings ps
   WHERE ps.singleton = true
   LIMIT 1;

  IF TG_TABLE_NAME = 'contract_summaries' THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status::text = 'accepted' OR OLD.document_status::text = 'accepted' THEN
        RETURN NEW;
      END IF;
      IF NEW.status::text IS DISTINCT FROM 'accepted'
         AND NEW.document_status::text IS DISTINCT FROM 'accepted' THEN
        RETURN NEW;
      END IF;
    ELSIF coalesce(NEW.is_information_update, false) THEN
      RETURN NEW;
    END IF;
    customer_kind := NEW.customer_type::text;
  ELSIF TG_TABLE_NAME = 'contract_information_packs' THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.document_status::text = 'accepted'
         OR NEW.document_status::text IS DISTINCT FROM 'accepted' THEN
        RETURN NEW;
      END IF;
    END IF;
    SELECT q.customer_type::text INTO customer_kind
      FROM public.quotes q WHERE q.id = NEW.quote_id;
  ELSIF TG_TABLE_NAME = 'contract_acceptances' THEN
    SELECT c.customer_type::text INTO customer_kind
      FROM public.contract_summaries c WHERE c.id = NEW.contract_summary_id;
  ELSE
    RAISE EXCEPTION 'unexpected_consumer_release_guard_table';
  END IF;

  IF customer_kind IS DISTINCT FROM 'business'
     AND (release_enabled IS DISTINCT FROM true OR release_version IS DISTINCT FROM '2026.10.1') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'consumer_contract_issuance_paused',
      DETAIL = 'Consumer v2026.10.1 remains fail-closed until production release controls are explicitly enabled.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_consumer_contract_release_pause() FROM PUBLIC;

-- New-consumer acceptance evidence is checked and stamped from authoritative
-- stored documents, not request-body claims.
CREATE OR REPLACE FUNCTION public.enforce_consumer_2026_10_1_acceptance_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  cs public.contract_summaries%ROWTYPE;
  cip public.contract_information_packs%ROWTYPE;
  otp public.sms_otp_challenges%ROWTYPE;
  dv_required boolean := false;
BEGIN
  SELECT * INTO cs FROM public.contract_summaries WHERE id = NEW.contract_summary_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_summary_not_found_for_acceptance';
  END IF;

  IF cs.customer_type::text = 'business' THEN
    RETURN NEW;
  END IF;
  IF coalesce(cs.terms_version,'') <> '2026.10.1' THEN
    RETURN NEW; -- historic evidence remains governed by its original controls
  END IF;

  IF coalesce(cs.is_information_update,false) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='information_update_not_acceptable';
  END IF;
  IF cs.status::text NOT IN ('issued','viewed','draft') THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_summary_not_acceptable';
  END IF;
  IF nullif(cs.pdf_storage_key,'') IS NULL OR nullif(cs.pdf_sha256,'') IS NULL
     OR nullif(cs.body_snapshot_sha256,'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_summary_immutable_evidence_incomplete';
  END IF;

  -- Mandatory commercial/service completeness for a new consumer agreement.
  IF nullif(cs.customer_name_snapshot,'') IS NULL
     OR nullif(cs.customer_email_snapshot,'') IS NULL
     OR nullif(cs.service_address,'') IS NULL
     OR nullif(cs.plan_name,'') IS NULL
     OR cs.customer_type_v2 IS NULL
     OR cs.contract_type IS NULL
     OR cs.monthly_price_incl_vat IS NULL OR cs.monthly_price_incl_vat <= 0
     OR cs.vat_snapshot IS NULL
     OR cs.one_off_charges_snapshot IS NULL
     OR cs.minimum_term_months IS NULL
     OR cs.notice_period_days IS NULL
     OR cs.price_change_snapshot IS NULL
     OR cs.etf_policy_snapshot IS NULL
     OR nullif(cs.cease_cancellation_charges,'') IS NULL
     OR cs.payment_method_snapshot IS NULL
     OR coalesce(cs.billing_start_rule,'') <> 'confirmed_service_live' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='mandatory_contract_snapshot_incomplete';
  END IF;

  IF cs.service_type::text = 'broadband' THEN
    IF cs.likely_service_date IS NULL
       OR cs.speed_estimate_snapshot IS NULL
       OR nullif(cs.speed_estimate_snapshot->>'technology','') IS NULL
       OR coalesce((cs.speed_estimate_snapshot->>'minimum_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'normally_available_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'maximum_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'advertised_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'minimum_upload_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'normally_available_upload_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'maximum_upload_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'advertised_upload_mbps')::numeric,0) <= 0
       OR nullif(cs.speed_estimate_snapshot->>'source_retrieved_at','') IS NULL
       OR nullif(coalesce(cs.service_components_snapshot->0->>'supplier_availability_sha256',''),'') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='verified_broadband_speed_snapshot_incomplete';
    END IF;
  END IF;

  IF NEW.cs_version IS DISTINCT FROM cs.version THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_summary_version_mismatch';
  END IF;

  IF NEW.journey_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='canonical_journey_required';
  END IF;
  IF NEW.checkbox_received_read IS DISTINCT FROM true
     OR NEW.checkbox_details_correct IS DISTINCT FROM true
     OR NEW.checkbox_understand_charges IS DISTINCT FROM true
     OR NEW.checkbox_consent IS DISTINCT FROM true
     OR NEW.address_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='independent_acceptance_confirmations_required';
  END IF;

  IF NEW.contract_information_pack_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_information_pack_required';
  END IF;
  SELECT * INTO cip
    FROM public.contract_information_packs
   WHERE id = NEW.contract_information_pack_id
     AND contract_summary_id = NEW.contract_summary_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_information_pack_mismatch';
  END IF;
  IF cip.document_status::text NOT IN ('issued','accepted')
     OR nullif(cip.pdf_storage_path,'') IS NULL
     OR nullif(cip.pdf_sha256,'') IS NULL
     OR nullif(cip.body_snapshot_sha256,'') IS NULL
     OR coalesce(cip.template_version,'') <> '2026.10.1' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_information_immutable_evidence_incomplete';
  END IF;
  IF NEW.contract_information_pack_version IS DISTINCT FROM cip.version THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_information_pack_version_mismatch';
  END IF;

  IF NEW.otp_challenge_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='verified_otp_required';
  END IF;
  SELECT * INTO otp FROM public.sms_otp_challenges WHERE id = NEW.otp_challenge_id;
  IF NOT FOUND
     OR otp.verified_at IS NULL
     OR otp.consumed_at IS NOT NULL
     OR otp.expires_at <= coalesce(NEW.accepted_at, now())
     OR otp.session_or_order_reference IS DISTINCT FROM NEW.journey_id::text THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='verified_otp_invalid_or_replayed';
  END IF;

  dv_required :=
    coalesce(cs.digital_voice_addon_snapshot, '{}'::jsonb) <> '{}'::jsonb
    OR coalesce(cs.selected_addons, '[]'::jsonb) @> '["digital_voice"]'::jsonb
    OR coalesce(cs.service_components_snapshot, '[]'::jsonb)::text ILIKE '%digital_voice%';
  IF dv_required AND NEW.digital_voice_acknowledged IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='digital_voice_acknowledgement_required';
  END IF;
  IF NEW.early_start_requested IS TRUE AND NEW.early_start_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='early_start_consent_required';
  END IF;

  -- Stamp authoritative immutable evidence values.
  NEW.cs_version := cs.version;
  NEW.terms_version := cs.terms_version;
  NEW.pdf_storage_key := cs.pdf_storage_key;
  NEW.pdf_sha256 := cs.pdf_sha256;
  NEW.contract_summary_body_sha256 := cs.body_snapshot_sha256;
  NEW.contract_information_pack_version := cip.version;
  NEW.contract_information_pack_pdf_hash := cip.pdf_sha256;
  NEW.contract_information_pack_pdf_sha256 := cip.pdf_sha256;
  NEW.contract_information_pack_body_sha256 := cip.body_snapshot_sha256;
  NEW.contract_summary_template_version := cs.terms_version;
  NEW.contract_information_pack_template_version := cip.template_version;
  NEW.otp_verified_at := otp.verified_at;
  NEW.accepted_at_utc := coalesce(NEW.accepted_at_utc, NEW.accepted_at, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consumer_2026_10_1_acceptance_evidence ON public.contract_acceptances;
CREATE TRIGGER trg_consumer_2026_10_1_acceptance_evidence
BEFORE INSERT ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.enforce_consumer_2026_10_1_acceptance_evidence();

-- Make acceptance + both document states + OTP consumption one database
-- transaction. If any statement fails, the acceptance insert rolls back too.
CREATE OR REPLACE FUNCTION public.commit_consumer_2026_10_1_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_terms text;
  v_customer_type text;
BEGIN
  SELECT terms_version, customer_type::text
    INTO v_terms, v_customer_type
    FROM public.contract_summaries
   WHERE id = NEW.contract_summary_id;

  IF v_customer_type = 'business' OR coalesce(v_terms,'') <> '2026.10.1' THEN
    RETURN NEW;
  END IF;

  UPDATE public.contract_summaries
     SET status = 'accepted',
         document_status = 'accepted',
         accepted_at = coalesce(accepted_at, NEW.accepted_at),
         accepted_at_utc = coalesce(accepted_at_utc, NEW.accepted_at_utc, NEW.accepted_at),
         accepted_ip = coalesce(accepted_ip, NEW.ip),
         accepted_user_agent = coalesce(accepted_user_agent, NEW.user_agent)
   WHERE id = NEW.contract_summary_id
     AND status::text IN ('issued','viewed','draft');

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_summary_acceptance_commit_failed';
  END IF;

  UPDATE public.contract_information_packs
     SET document_status = 'accepted',
         accepted_at_utc = coalesce(accepted_at_utc, NEW.accepted_at_utc, NEW.accepted_at)
   WHERE id = NEW.contract_information_pack_id
     AND document_status::text = 'issued';

  IF NOT FOUND THEN
    -- Idempotent only if it was already accepted within this same evidence path.
    IF NOT EXISTS (
      SELECT 1 FROM public.contract_information_packs
       WHERE id = NEW.contract_information_pack_id AND document_status::text = 'accepted'
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='contract_information_acceptance_commit_failed';
    END IF;
  END IF;

  UPDATE public.sms_otp_challenges
     SET consumed_at = coalesce(consumed_at, NEW.accepted_at_utc, NEW.accepted_at, now())
   WHERE id = NEW.otp_challenge_id
     AND consumed_at IS NULL
     AND verified_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='otp_consumption_commit_failed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consumer_2026_10_1_acceptance_commit ON public.contract_acceptances;
CREATE TRIGGER trg_consumer_2026_10_1_acceptance_commit
AFTER INSERT ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.commit_consumer_2026_10_1_acceptance();

-- Structured vulnerability review: customer-entered support needs create a
-- structured review record. The review row, not a note/task, is the
-- authoritative activation blocker.
CREATE OR REPLACE FUNCTION public.create_consumer_vulnerability_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session record;
  v_details jsonb;
  v_accessibility text;
  v_vulnerability text;
BEGIN
  IF NEW.journey_id IS NULL OR coalesce(NEW.terms_version,'') <> '2026.10.1' THEN
    RETURN NEW;
  END IF;

  SELECT id, customer_details INTO v_session
    FROM public.customer_journey_sessions
   WHERE order_journey_id = NEW.journey_id
   LIMIT 1;

  IF v_session.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_details := coalesce(v_session.customer_details, '{}'::jsonb);
  v_accessibility := btrim(coalesce(v_details->>'accessibility_needs',''));
  v_vulnerability := btrim(coalesce(v_details->>'vulnerability_support_needs',''));

  IF v_accessibility <> '' OR v_vulnerability <> '' THEN
    INSERT INTO public.customer_vulnerability_reviews (
      journey_id, customer_id, contract_acceptance_id, status, reason_snapshot
    ) VALUES (
      NEW.journey_id, NEW.customer_id, NEW.id, 'pending',
      jsonb_build_object(
        'accessibility_needs', nullif(v_accessibility,''),
        'vulnerability_support_needs', nullif(v_vulnerability,''),
        'digital_voice_acknowledged', NEW.digital_voice_acknowledged
      )
    )
    ON CONFLICT (journey_id) DO NOTHING;

    -- The structured review row above is the authoritative blocker. Notification
    -- tasks are deliberately not created inside this evidence transaction:
    -- a task-system failure must never corrupt contract acceptance evidence.
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consumer_vulnerability_review ON public.contract_acceptances;
CREATE TRIGGER trg_consumer_vulnerability_review
AFTER INSERT ON public.contract_acceptances
FOR EACH ROW EXECUTE FUNCTION public.create_consumer_vulnerability_review();

-- No order can become live under v2026.10.1 unless the exact accepted
-- Summary + Pack + acceptance + immutable certificate chain exists.
CREATE OR REPLACE FUNCTION public.enforce_order_live_contract_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  cs public.contract_summaries%ROWTYPE;
  ca public.contract_acceptances%ROWTYPE;
  cip public.contract_information_packs%ROWTYPE;
  cert public.acceptance_certificates%ROWTYPE;
BEGIN
  IF NEW.lifecycle_status IS DISTINCT FROM 'live' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.lifecycle_status = 'live' THEN
    RETURN NEW;
  END IF;

  IF NEW.contract_summary_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_missing_contract_summary';
  END IF;
  SELECT * INTO cs FROM public.contract_summaries WHERE id=NEW.contract_summary_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_contract_summary_not_found';
  END IF;
  IF cs.customer_type::text='business' OR coalesce(cs.terms_version,'') <> '2026.10.1' THEN
    RETURN NEW;
  END IF;

  IF cs.status::text <> 'accepted'
     OR cs.document_status::text <> 'accepted'
     OR cs.accepted_at IS NULL
     OR nullif(cs.pdf_sha256,'') IS NULL
     OR nullif(cs.body_snapshot_sha256,'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_contract_evidence_incomplete';
  END IF;

  SELECT * INTO ca
    FROM public.contract_acceptances a
   WHERE a.contract_summary_id=cs.id
     AND (NEW.journey_id IS NULL OR a.journey_id=NEW.journey_id)
   ORDER BY a.accepted_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_acceptance_evidence_missing';
  END IF;

  SELECT * INTO cip FROM public.contract_information_packs WHERE id=ca.contract_information_pack_id;
  IF NOT FOUND
     OR cip.document_status::text <> 'accepted'
     OR nullif(cip.pdf_sha256,'') IS NULL
     OR nullif(cip.body_snapshot_sha256,'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_contract_information_evidence_incomplete';
  END IF;

  SELECT * INTO cert
    FROM public.acceptance_certificates ac
   WHERE ac.contract_acceptance_id=ca.id
   LIMIT 1;
  IF NOT FOUND
     OR nullif(cert.storage_key,'') IS NULL
     OR nullif(cert.sha256,'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_acceptance_certificate_missing';
  END IF;

  IF coalesce(NEW.activation_blocked_pending_review,false) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_blocked_pending_review';
  END IF;
  IF NEW.journey_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customer_vulnerability_reviews vr
     WHERE vr.journey_id=NEW.journey_id AND vr.status='pending'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='activation_vulnerability_review_pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_live_requires_contract_evidence ON public.orders;
CREATE TRIGGER trg_order_live_requires_contract_evidence
BEFORE UPDATE OF lifecycle_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_live_contract_evidence();

CREATE OR REPLACE FUNCTION public.resolve_customer_vulnerability_review(
  _review_id uuid,
  _status text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT (
    public.has_role(v_actor,'admin'::app_role)
    OR public.has_role(v_actor,'super_admin'::app_role)
    OR public.has_role(v_actor,'compliance_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('cleared','not_required') THEN
    RAISE EXCEPTION 'invalid_review_status';
  END IF;

  UPDATE public.customer_vulnerability_reviews
     SET status=_status, review_note=_note, reviewed_at=now(), reviewed_by=v_actor
   WHERE id=_review_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'review_not_pending_or_not_found'; END IF;

  RETURN jsonb_build_object('ok',true,'review_id',_review_id,'status',_status);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_customer_vulnerability_review(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_customer_vulnerability_review(uuid,text,text) TO authenticated;

-- Direct Debit provider truth: a local setup state may only become "active"
-- after an actual non-test provider mandate is active.
CREATE OR REPLACE FUNCTION public.enforce_dd_provider_active_truth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.method = 'direct_debit' AND lower(coalesce(NEW.dd_setup_status,'')) = 'active' THEN
    IF NEW.customer_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.dd_mandates d
       WHERE d.user_id = NEW.customer_id
         AND coalesce(d.is_test,false) = false
         AND lower(coalesce(d.status,'')) = 'active'
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='dd_provider_mandate_not_active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_method_requires_active_provider_dd ON public.payment_methods;
CREATE TRIGGER trg_payment_method_requires_active_provider_dd
BEFORE INSERT OR UPDATE OF dd_setup_status, method, customer_id ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.enforce_dd_provider_active_truth();

-- Customer-facing/admin production DD view excludes synthetic mandates.
CREATE OR REPLACE VIEW public.dd_mandates_list AS
SELECT id, user_id, status, mandate_reference, bank_last4, account_holder,
       provider_code, provider_reference, submitted_to_provider_at, is_test,
       CASE
         WHEN masked_sort_last2 IS NOT NULL THEN '**-**-'::text || masked_sort_last2
         WHEN sort_code IS NOT NULL AND length(sort_code) >= 2 THEN '**-**-'::text || right(sort_code, 2)
         ELSE NULL::text
       END AS sort_code_masked,
       CASE
         WHEN masked_account_last4 IS NOT NULL THEN '****'::text || masked_account_last4
         WHEN account_number_full IS NOT NULL AND length(account_number_full) >= 4 THEN '****'::text || right(account_number_full, 4)
         ELSE NULL::text
       END AS account_number_masked,
       bank_details_ciphertext IS NOT NULL OR account_number_full IS NOT NULL AS has_bank_details,
       consent_timestamp, payment_request_id, created_at, updated_at, signature_name
  FROM public.dd_mandates
 WHERE coalesce(is_test,false) = false
   AND (
     auth.uid() = user_id
     OR has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'super_admin'::app_role)
     OR has_role(auth.uid(), 'finance_admin'::app_role)
     OR has_role(auth.uid(), 'compliance_admin'::app_role)
   );

-- Read-only operational discrepancy surfaces. They never "fix" evidence.
CREATE OR REPLACE VIEW public.occta_dd_state_issues
WITH (security_invoker = true) AS
SELECT pm.id AS payment_method_id,
       pm.customer_id,
       pm.service_id,
       pm.dd_setup_status AS local_dd_setup_status,
       pm.active AS local_payment_method_selected,
       latest.status AS provider_mandate_status,
       latest.provider_reference,
       CASE
         WHEN pm.method = 'direct_debit' AND pm.active = true
              AND lower(coalesce(latest.status,'')) <> 'active'
           THEN 'local_dd_selected_provider_not_active'
         WHEN lower(coalesce(pm.dd_setup_status,'')) = 'active'
              AND lower(coalesce(latest.status,'')) <> 'active'
           THEN 'local_dd_status_active_provider_not_active'
         ELSE NULL
       END AS issue_code
  FROM public.payment_methods pm
  LEFT JOIN LATERAL (
    SELECT d.status, d.provider_reference
      FROM public.dd_mandates d
     WHERE d.user_id = pm.customer_id AND coalesce(d.is_test,false)=false
     ORDER BY d.created_at DESC
     LIMIT 1
  ) latest ON true
 WHERE pm.method = 'direct_debit'
   AND (
     (pm.active = true AND lower(coalesce(latest.status,'')) <> 'active')
     OR (lower(coalesce(pm.dd_setup_status,'')) = 'active' AND lower(coalesce(latest.status,'')) <> 'active')
   );

CREATE OR REPLACE VIEW public.occta_service_billing_issues
WITH (security_invoker = true) AS
SELECT s.id AS service_id,
       s.user_id AS customer_id,
       s.order_id,
       s.contract_summary_id,
       s.status AS service_status,
       s.actual_activation_date,
       s.billing_enabled,
       s.next_billing_date,
       CASE
         WHEN s.status='active' AND s.contract_summary_id IS NULL THEN 'active_service_missing_contract'
         WHEN s.status='active' AND cs.id IS NOT NULL AND cs.status::text <> 'accepted' THEN 'active_service_contract_not_accepted'
         WHEN s.status='active' AND s.actual_activation_date IS NULL THEN 'active_service_missing_live_date'
         WHEN s.status='active' AND coalesce(s.billing_enabled,false)=false THEN 'active_service_billing_disabled'
         WHEN s.status='active' AND s.next_billing_date IS NULL THEN 'active_service_missing_next_billing_date'
         ELSE NULL
       END AS issue_code
  FROM public.services s
  LEFT JOIN public.contract_summaries cs ON cs.id=s.contract_summary_id
 WHERE s.archived_at IS NULL
   AND s.status='active'
   AND (
     s.contract_summary_id IS NULL
     OR (cs.id IS NOT NULL AND cs.status::text <> 'accepted')
     OR s.actual_activation_date IS NULL
     OR coalesce(s.billing_enabled,false)=false
     OR s.next_billing_date IS NULL
   );

CREATE OR REPLACE VIEW public.occta_contract_integrity_issues
WITH (security_invoker = true) AS
SELECT cs.id AS contract_summary_id,
       cs.customer_id,
       cs.cs_number,
       cs.version,
       cs.terms_version,
       CASE
         WHEN cs.status::text='accepted' AND nullif(cs.pdf_sha256,'') IS NULL THEN 'accepted_cs_missing_pdf_sha256'
         WHEN cs.status::text='accepted' AND nullif(cs.pdf_storage_key,'') IS NULL THEN 'accepted_cs_missing_pdf_storage'
         WHEN cs.status::text='accepted' AND cs.terms_version='2026.10.1' AND nullif(cs.body_snapshot_sha256,'') IS NULL THEN 'v2026_10_1_missing_body_hash'
         ELSE NULL
       END AS issue_code
  FROM public.contract_summaries cs
 WHERE cs.status::text='accepted'
   AND (
     nullif(cs.pdf_sha256,'') IS NULL
     OR nullif(cs.pdf_storage_key,'') IS NULL
     OR (cs.terms_version='2026.10.1' AND nullif(cs.body_snapshot_sha256,'') IS NULL)
   );

CREATE OR REPLACE VIEW public.occta_customer_360_control
WITH (security_invoker = true) AS
SELECT p.id AS customer_id,
       p.account_number,
       p.full_name AS customer_name,
       p.email,
       s.id AS service_id,
       s.service_type,
       s.plan_name,
       s.status AS service_status,
       s.service_address,
       s.price_monthly AS contracted_service_price,
       s.contract_type,
       s.minimum_term_end_date,
       s.notice_period_days,
       cs.id AS contract_summary_id,
       cs.cs_number,
       cs.version AS contract_summary_version,
       cs.terms_version,
       cs.pdf_sha256 AS contract_summary_pdf_sha256,
       cip.id AS contract_information_pack_id,
       cip.cip_number,
       cip.version AS contract_information_pack_version,
       cip.pdf_sha256 AS contract_information_pdf_sha256,
       coalesce(inv.open_invoice_count,0) AS open_invoice_count,
       coalesce(inv.open_balance,0) AS open_invoice_balance,
       coalesce(pay.actual_received,0) AS actual_money_received,
       dd.status AS dd_provider_status,
       dd.provider_reference AS dd_provider_reference,
       comp.open_complaint_count,
       canc.open_cancellation_count,
       sb.issue_code AS service_billing_issue
  FROM public.profiles p
  LEFT JOIN public.services s ON s.user_id=p.id AND s.archived_at IS NULL
  LEFT JOIN public.contract_summaries cs ON cs.id=s.contract_summary_id
  LEFT JOIN LATERAL (
    SELECT c.*
      FROM public.contract_information_packs c
     WHERE c.contract_summary_id=cs.id
     ORDER BY c.version DESC LIMIT 1
  ) cip ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE i.status NOT IN ('paid','void','cancelled','credited'))::int AS open_invoice_count,
           coalesce(sum(i.total) FILTER (WHERE i.status NOT IN ('paid','void','cancelled','credited')),0)::numeric AS open_balance
      FROM public.invoices i
     WHERE i.user_id=p.id AND (s.id IS NULL OR i.service_id=s.id)
  ) inv ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(pa.amount) FILTER (
      WHERE lower(coalesce(pa.status,'')) IN ('paid','succeeded','successful','settled','completed')
    ),0)::numeric AS actual_received
      FROM public.payment_attempts pa
     WHERE pa.user_id=p.id
  ) pay ON true
  LEFT JOIN LATERAL (
    SELECT d.status, d.provider_reference
      FROM public.dd_mandates d
     WHERE d.user_id=p.id AND coalesce(d.is_test,false)=false
     ORDER BY d.created_at DESC LIMIT 1
  ) dd ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE c.status::text NOT IN ('resolved','closed'))::int AS open_complaint_count
      FROM public.complaints c WHERE c.customer_id=p.id
  ) comp ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE c.status NOT IN ('completed','withdrawn','cancelled'))::int AS open_cancellation_count
      FROM public.customer_cancellation_cases c WHERE c.customer_id=p.id
  ) canc ON true
  LEFT JOIN public.occta_service_billing_issues sb ON sb.service_id=s.id
 WHERE p.archived_at IS NULL;

GRANT SELECT ON public.occta_dd_state_issues TO authenticated;
GRANT SELECT ON public.occta_service_billing_issues TO authenticated;
GRANT SELECT ON public.occta_contract_integrity_issues TO authenticated;
GRANT SELECT ON public.occta_customer_360_control TO authenticated;

-- Release remains disabled by default. Enabling is a separate verified cutover.
UPDATE public.platform_settings
   SET consumer_contract_release_enabled = false,
       consumer_contract_release_version = '2026.10.1'
 WHERE singleton = true;
