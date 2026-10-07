ALTER TABLE public.customer_journey_sessions DROP CONSTRAINT IF EXISTS customer_journey_sessions_network_validation_status_check;
ALTER TABLE public.customer_journey_sessions ADD CONSTRAINT customer_journey_sessions_network_validation_status_check
  CHECK (network_validation_status = ANY (ARRAY['pending'::text, 'verified'::text, 'failed'::text, 'legacy_not_required'::text, 'plan_estimate_used'::text]));

CREATE OR REPLACE FUNCTION public.enforce_consumer_2026_10_1_acceptance_evidence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
    RETURN NEW;
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
       OR nullif(cs.speed_estimate_snapshot->>'source_retrieved_at','') IS NULL
       OR nullif(coalesce(cs.service_components_snapshot->0->>'supplier_availability_sha256',''),'') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='verified_broadband_speed_snapshot_incomplete';
    END IF;
    IF coalesce(cs.speed_estimate_snapshot->>'basis','') = 'occta_plan_estimate' THEN
      IF coalesce(cs.speed_estimate_snapshot->>'source','') <> 'OCCTA_PLAN_ESTIMATE'
         OR coalesce((cs.speed_estimate_snapshot->>'advertised_download_mbps')::numeric,0) <= 0
         OR coalesce((cs.speed_estimate_snapshot->>'advertised_upload_mbps')::numeric,0) <= 0
         OR coalesce((cs.speed_estimate_snapshot->>'estimated_download_mbps')::numeric,0) <= 0
         OR coalesce((cs.speed_estimate_snapshot->>'estimated_upload_mbps')::numeric,0) <= 0
         OR coalesce(cs.service_components_snapshot->0->>'supplier_availability_sha256','') !~ '^[0-9a-fA-F]{64}$' THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='plan_estimate_speed_snapshot_incomplete';
      END IF;
    ELSIF nullif(cs.speed_estimate_snapshot->>'technology','') IS NULL
       OR coalesce((cs.speed_estimate_snapshot->>'minimum_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'normally_available_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'maximum_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'advertised_download_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'minimum_upload_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'normally_available_upload_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'maximum_upload_mbps')::numeric,0) <= 0
       OR coalesce((cs.speed_estimate_snapshot->>'advertised_upload_mbps')::numeric,0) <= 0 THEN
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
$function$;