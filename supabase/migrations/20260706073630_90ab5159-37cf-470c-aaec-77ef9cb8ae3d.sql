
-- =========================================================================
-- PHASE A — Snapshot fields, versioning, new legal-document tables
-- Additive only. No accepted legal row is modified.
-- =========================================================================

-- 1. Enums (idempotent creation)
DO $$ BEGIN
  CREATE TYPE public.contract_type_enum AS ENUM ('flex_30_rolling','fixed_term');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.customer_type_enum AS ENUM (
    'residential_consumer','business','microenterprise_or_small_business','not_for_profit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_status_enum AS ENUM (
    'draft','issued','accepted','superseded','cancelled','void_manual_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method_snapshot_enum AS ENUM (
    'manual_invoice_card_worldpay','direct_debit_setup_request'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.legacy_compliance_status_enum AS ENUM ('ok','manual_review_required','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Snapshot columns on quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contract_type public.contract_type_enum,
  ADD COLUMN IF NOT EXISTS customer_type_v2 public.customer_type_enum,
  ADD COLUMN IF NOT EXISTS minimum_term_months integer,
  ADD COLUMN IF NOT EXISTS notice_period_days integer,
  ADD COLUMN IF NOT EXISTS etf_policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS price_change_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_snapshot public.payment_method_snapshot_enum,
  ADD COLUMN IF NOT EXISTS billing_start_rule text DEFAULT 'actual_service_live_confirmation',
  ADD COLUMN IF NOT EXISTS speed_estimate_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS activation_fee_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS one_off_charges_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS router_addon_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS digital_voice_addon_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS vat_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS service_components_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS legacy_compliance_status public.legacy_compliance_status_enum DEFAULT 'ok';

-- 3. Snapshot columns on contract_summaries
ALTER TABLE public.contract_summaries
  ADD COLUMN IF NOT EXISTS contract_type public.contract_type_enum,
  ADD COLUMN IF NOT EXISTS customer_type_v2 public.customer_type_enum,
  ADD COLUMN IF NOT EXISTS minimum_term_months integer,
  ADD COLUMN IF NOT EXISTS notice_period_days integer,
  ADD COLUMN IF NOT EXISTS etf_policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS price_change_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_snapshot public.payment_method_snapshot_enum,
  ADD COLUMN IF NOT EXISTS billing_start_rule text DEFAULT 'actual_service_live_confirmation',
  ADD COLUMN IF NOT EXISTS speed_estimate_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS activation_fee_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS one_off_charges_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS router_addon_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS digital_voice_addon_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS vat_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS service_components_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS document_status public.document_status_enum,
  ADD COLUMN IF NOT EXISTS pdf_hash text,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS created_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS issued_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS display_timezone text DEFAULT 'Europe/London',
  ADD COLUMN IF NOT EXISTS supersedes_id uuid,
  ADD COLUMN IF NOT EXISTS legacy_compliance_status public.legacy_compliance_status_enum DEFAULT 'ok';

-- 4. Snapshot columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contract_type public.contract_type_enum,
  ADD COLUMN IF NOT EXISTS customer_type_v2 public.customer_type_enum,
  ADD COLUMN IF NOT EXISTS payment_method_snapshot public.payment_method_snapshot_enum,
  ADD COLUMN IF NOT EXISTS billing_start_rule text DEFAULT 'actual_service_live_confirmation',
  ADD COLUMN IF NOT EXISTS actual_service_live_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS service_components_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS legacy_compliance_status public.legacy_compliance_status_enum DEFAULT 'ok';

-- 5. Policy version + timestamp columns on contract_acceptances (ADD COLUMN only)
ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS accepted_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS contract_information_pack_id uuid,
  ADD COLUMN IF NOT EXISTS contract_information_pack_version integer,
  ADD COLUMN IF NOT EXISTS contract_information_pack_pdf_hash text,
  ADD COLUMN IF NOT EXISTS contract_summary_template_version text,
  ADD COLUMN IF NOT EXISTS contract_information_pack_template_version text,
  ADD COLUMN IF NOT EXISTS price_guide_version text,
  ADD COLUMN IF NOT EXISTS cookie_policy_version text,
  ADD COLUMN IF NOT EXISTS complaints_code_version text,
  ADD COLUMN IF NOT EXISTS acceptable_use_policy_version text,
  ADD COLUMN IF NOT EXISTS vulnerable_customers_policy_version text,
  ADD COLUMN IF NOT EXISTS digital_voice_policy_version text,
  ADD COLUMN IF NOT EXISTS cancellation_policy_version text,
  ADD COLUMN IF NOT EXISTS billing_policy_version text,
  ADD COLUMN IF NOT EXISTS broadband_terms_version text,
  ADD COLUMN IF NOT EXISTS digital_voice_terms_version text,
  ADD COLUMN IF NOT EXISTS sim_only_terms_version text,
  ADD COLUMN IF NOT EXISTS mobile_roaming_policy_version text,
  ADD COLUMN IF NOT EXISTS mobile_fair_usage_policy_version text,
  ADD COLUMN IF NOT EXISTS number_porting_policy_version text,
  ADD COLUMN IF NOT EXISTS equipment_terms_version text,
  ADD COLUMN IF NOT EXISTS bundle_terms_version text,
  ADD COLUMN IF NOT EXISTS service_components_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS legacy_compliance_status public.legacy_compliance_status_enum DEFAULT 'ok';

-- 6. Policy version columns on acceptance_certificates
ALTER TABLE public.acceptance_certificates
  ADD COLUMN IF NOT EXISTS accepted_at_utc timestamptz,
  ADD COLUMN IF NOT EXISTS contract_information_pack_id uuid,
  ADD COLUMN IF NOT EXISTS contract_information_pack_version integer,
  ADD COLUMN IF NOT EXISTS contract_information_pack_pdf_hash text,
  ADD COLUMN IF NOT EXISTS contract_summary_template_version text,
  ADD COLUMN IF NOT EXISTS contract_information_pack_template_version text,
  ADD COLUMN IF NOT EXISTS policy_versions jsonb,
  ADD COLUMN IF NOT EXISTS legacy_compliance_status public.legacy_compliance_status_enum DEFAULT 'ok';

-- 7. NEW TABLE contract_information_packs
CREATE TABLE IF NOT EXISTS public.contract_information_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cip_number text NOT NULL DEFAULT
    ('CIP-' || to_char(now(), 'YYMM') || '-' || substring(replace(gen_random_uuid()::text,'-',''), 1, 8)),
  quote_id uuid NOT NULL,
  quote_request_id uuid,
  contract_summary_id uuid,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  document_status public.document_status_enum NOT NULL DEFAULT 'draft',
  template_version text NOT NULL,
  body_snapshot jsonb NOT NULL,
  pdf_hash text,
  pdf_storage_path text,
  supersedes_id uuid REFERENCES public.contract_information_packs(id),
  created_at_utc timestamptz NOT NULL DEFAULT now(),
  issued_at_utc timestamptz,
  accepted_at_utc timestamptz,
  superseded_at_utc timestamptz,
  cancelled_at_utc timestamptz,
  display_timezone text NOT NULL DEFAULT 'Europe/London',
  legacy_compliance_status public.legacy_compliance_status_enum NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contract_information_packs TO authenticated;
GRANT ALL ON public.contract_information_packs TO service_role;

ALTER TABLE public.contract_information_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own contract information packs"
  ON public.contract_information_packs;
CREATE POLICY "Customers can view own contract information packs"
  ON public.contract_information_packs FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all contract information packs"
  ON public.contract_information_packs;
CREATE POLICY "Admins can view all contract information packs"
  ON public.contract_information_packs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP TRIGGER IF EXISTS trg_contract_information_packs_updated_at
  ON public.contract_information_packs;
CREATE TRIGGER trg_contract_information_packs_updated_at
  BEFORE UPDATE ON public.contract_information_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.prevent_accepted_cip_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.document_status = 'accepted' THEN
      RAISE EXCEPTION 'compliance_immutability: cannot delete accepted contract_information_packs row (id=%).', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.document_status = 'accepted' THEN
    RAISE EXCEPTION 'compliance_immutability: cannot update accepted contract_information_packs row (id=%). Insert a new version with supersedes_id.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_accepted_cip_mutation
  ON public.contract_information_packs;
CREATE TRIGGER trg_prevent_accepted_cip_mutation
  BEFORE UPDATE OR DELETE ON public.contract_information_packs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_accepted_cip_mutation();

-- 8. NEW TABLE acceptance_audit_records (internal-only)
CREATE TABLE IF NOT EXISTS public.acceptance_audit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_certificate_id uuid REFERENCES public.acceptance_certificates(id),
  contract_acceptance_id uuid REFERENCES public.contract_acceptances(id),
  auth_user_id uuid,
  ip_address inet,
  user_agent text,
  session_id text,
  request_id text,
  acceptance_route text,
  security_event_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at_utc timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.acceptance_audit_records TO service_role;

ALTER TABLE public.acceptance_audit_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view acceptance audit records"
  ON public.acceptance_audit_records;
CREATE POLICY "Admins can view acceptance audit records"
  ON public.acceptance_audit_records FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.prevent_acceptance_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'compliance_immutability: acceptance_audit_records are append-only (id=%).', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RAISE EXCEPTION 'compliance_immutability: acceptance_audit_records are append-only (id=%).', OLD.id
    USING ERRCODE = 'check_violation';
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_acceptance_audit_mutation
  ON public.acceptance_audit_records;
CREATE TRIGGER trg_prevent_acceptance_audit_mutation
  BEFORE UPDATE OR DELETE ON public.acceptance_audit_records
  FOR EACH ROW EXECUTE FUNCTION public.prevent_acceptance_audit_mutation();

-- 9. Legacy tagging pass using existing admin_reconciliation_tasks schema
--    (columns: kind, severity, payload, status).
INSERT INTO public.admin_reconciliation_tasks (kind, severity, payload, status)
SELECT
  'legacy_pre_two_document_acceptance',
  'high',
  jsonb_build_object(
    'contract_acceptance_id', ca.id,
    'customer_id', ca.customer_id,
    'quote_id', ca.quote_id,
    'contract_summary_id', ca.contract_summary_id,
    'accepted_at', ca.accepted_at,
    'issue_summary', 'Existing accepted contract predates the two-document (Summary + Information Pack) system. Original record left unchanged.',
    'required_action', 'No action required unless customer requests documentation update. Do not regenerate.'
  ),
  'open'
FROM public.contract_acceptances ca
LEFT JOIN public.admin_reconciliation_tasks t
  ON t.kind = 'legacy_pre_two_document_acceptance'
 AND (t.payload ->> 'contract_acceptance_id') = ca.id::text
WHERE t.id IS NULL;

-- 10. Record this run.
INSERT INTO public.compliance_upgrade_runs (
  phase, migration_version, status, completed_at_utc,
  operator_label, rollback_script_path, notes
) VALUES (
  'phase_a_snapshot_fields',
  'phase_a_snapshot_fields',
  'completed',
  now(),
  'lovable_agent',
  'docs/compliance-upgrade/rollbacks/phase_a_rollback.sql',
  jsonb_build_object(
    'summary', 'Additive snapshot fields, enums, contract_information_packs and acceptance_audit_records tables installed. No accepted document modified.',
    'legacy_reconciliation_tasks_kind', 'legacy_pre_two_document_acceptance',
    'legacy_reconciliation_tasks_count',
      (SELECT count(*) FROM public.admin_reconciliation_tasks
        WHERE kind = 'legacy_pre_two_document_acceptance')
  )
);
