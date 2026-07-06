-- Rollback for Phase A (snapshot fields + new legal document tables).
--
-- IMPORTANT: Only safe to run BEFORE any customer has accepted under the new
-- two-document flow (Phases B/C). Once real customer legal evidence lives in
-- contract_information_packs / acceptance_audit_records or in the new
-- snapshot columns on contract_acceptances / acceptance_certificates, DO NOT
-- run this rollback — legal evidence would be destroyed. Use a feature flag
-- to disable the flow instead.
--
-- This script only removes additive schema. It does NOT touch any row in
-- contract_summaries, contract_acceptances, acceptance_certificates,
-- quotes or orders.

-- Drop new tables (must be empty of real acceptance evidence).
DROP TRIGGER IF EXISTS trg_prevent_acceptance_audit_mutation ON public.acceptance_audit_records;
DROP TABLE IF EXISTS public.acceptance_audit_records;
DROP FUNCTION IF EXISTS public.prevent_acceptance_audit_mutation();

DROP TRIGGER IF EXISTS trg_prevent_accepted_cip_mutation ON public.contract_information_packs;
DROP TRIGGER IF EXISTS trg_contract_information_packs_updated_at ON public.contract_information_packs;
DROP TABLE IF EXISTS public.contract_information_packs;
DROP FUNCTION IF EXISTS public.prevent_accepted_cip_mutation();

-- Drop additive columns (all nullable; drop is a no-op for data).
ALTER TABLE public.acceptance_certificates
  DROP COLUMN IF EXISTS accepted_at_utc,
  DROP COLUMN IF EXISTS contract_information_pack_id,
  DROP COLUMN IF EXISTS contract_information_pack_version,
  DROP COLUMN IF EXISTS contract_information_pack_pdf_hash,
  DROP COLUMN IF EXISTS contract_summary_template_version,
  DROP COLUMN IF EXISTS contract_information_pack_template_version,
  DROP COLUMN IF EXISTS policy_versions,
  DROP COLUMN IF EXISTS legacy_compliance_status;

ALTER TABLE public.contract_acceptances
  DROP COLUMN IF EXISTS accepted_at_utc,
  DROP COLUMN IF EXISTS contract_information_pack_id,
  DROP COLUMN IF EXISTS contract_information_pack_version,
  DROP COLUMN IF EXISTS contract_information_pack_pdf_hash,
  DROP COLUMN IF EXISTS contract_summary_template_version,
  DROP COLUMN IF EXISTS contract_information_pack_template_version,
  DROP COLUMN IF EXISTS price_guide_version,
  DROP COLUMN IF EXISTS cookie_policy_version,
  DROP COLUMN IF EXISTS complaints_code_version,
  DROP COLUMN IF EXISTS acceptable_use_policy_version,
  DROP COLUMN IF EXISTS vulnerable_customers_policy_version,
  DROP COLUMN IF EXISTS digital_voice_policy_version,
  DROP COLUMN IF EXISTS cancellation_policy_version,
  DROP COLUMN IF EXISTS billing_policy_version,
  DROP COLUMN IF EXISTS broadband_terms_version,
  DROP COLUMN IF EXISTS digital_voice_terms_version,
  DROP COLUMN IF EXISTS sim_only_terms_version,
  DROP COLUMN IF EXISTS mobile_roaming_policy_version,
  DROP COLUMN IF EXISTS mobile_fair_usage_policy_version,
  DROP COLUMN IF EXISTS number_porting_policy_version,
  DROP COLUMN IF EXISTS equipment_terms_version,
  DROP COLUMN IF EXISTS bundle_terms_version,
  DROP COLUMN IF EXISTS service_components_snapshot,
  DROP COLUMN IF EXISTS legacy_compliance_status;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS contract_type,
  DROP COLUMN IF EXISTS customer_type_v2,
  DROP COLUMN IF EXISTS payment_method_snapshot,
  DROP COLUMN IF EXISTS billing_start_rule,
  DROP COLUMN IF EXISTS actual_service_live_at_utc,
  DROP COLUMN IF EXISTS service_components_snapshot,
  DROP COLUMN IF EXISTS legacy_compliance_status;

ALTER TABLE public.contract_summaries
  DROP COLUMN IF EXISTS contract_type,
  DROP COLUMN IF EXISTS customer_type_v2,
  DROP COLUMN IF EXISTS minimum_term_months,
  DROP COLUMN IF EXISTS notice_period_days,
  DROP COLUMN IF EXISTS etf_policy_snapshot,
  DROP COLUMN IF EXISTS price_change_snapshot,
  DROP COLUMN IF EXISTS payment_method_snapshot,
  DROP COLUMN IF EXISTS billing_start_rule,
  DROP COLUMN IF EXISTS speed_estimate_snapshot,
  DROP COLUMN IF EXISTS activation_fee_snapshot,
  DROP COLUMN IF EXISTS one_off_charges_snapshot,
  DROP COLUMN IF EXISTS router_addon_snapshot,
  DROP COLUMN IF EXISTS digital_voice_addon_snapshot,
  DROP COLUMN IF EXISTS vat_snapshot,
  DROP COLUMN IF EXISTS service_components_snapshot,
  DROP COLUMN IF EXISTS document_status,
  DROP COLUMN IF EXISTS pdf_hash,
  DROP COLUMN IF EXISTS pdf_storage_path,
  DROP COLUMN IF EXISTS created_at_utc,
  DROP COLUMN IF EXISTS issued_at_utc,
  DROP COLUMN IF EXISTS accepted_at_utc,
  DROP COLUMN IF EXISTS superseded_at_utc,
  DROP COLUMN IF EXISTS cancelled_at_utc,
  DROP COLUMN IF EXISTS display_timezone,
  DROP COLUMN IF EXISTS supersedes_id,
  DROP COLUMN IF EXISTS legacy_compliance_status;

ALTER TABLE public.quotes
  DROP COLUMN IF EXISTS contract_type,
  DROP COLUMN IF EXISTS customer_type_v2,
  DROP COLUMN IF EXISTS minimum_term_months,
  DROP COLUMN IF EXISTS notice_period_days,
  DROP COLUMN IF EXISTS etf_policy_snapshot,
  DROP COLUMN IF EXISTS price_change_snapshot,
  DROP COLUMN IF EXISTS payment_method_snapshot,
  DROP COLUMN IF EXISTS billing_start_rule,
  DROP COLUMN IF EXISTS speed_estimate_snapshot,
  DROP COLUMN IF EXISTS activation_fee_snapshot,
  DROP COLUMN IF EXISTS one_off_charges_snapshot,
  DROP COLUMN IF EXISTS router_addon_snapshot,
  DROP COLUMN IF EXISTS digital_voice_addon_snapshot,
  DROP COLUMN IF EXISTS vat_snapshot,
  DROP COLUMN IF EXISTS service_components_snapshot,
  DROP COLUMN IF EXISTS legacy_compliance_status;

DROP TYPE IF EXISTS public.legacy_compliance_status_enum;
DROP TYPE IF EXISTS public.payment_method_snapshot_enum;
DROP TYPE IF EXISTS public.document_status_enum;
DROP TYPE IF EXISTS public.customer_type_enum;
DROP TYPE IF EXISTS public.contract_type_enum;