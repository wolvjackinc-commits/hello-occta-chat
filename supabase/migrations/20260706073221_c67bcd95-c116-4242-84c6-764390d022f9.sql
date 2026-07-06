
-- =========================================================================
-- PHASE 0: compliance upgrade audit table + immutability triggers
-- Additive only. No existing legal data is modified.
-- =========================================================================

-- 1. compliance_upgrade_runs audit table
CREATE TABLE IF NOT EXISTS public.compliance_upgrade_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  migration_version text,
  status text NOT NULL DEFAULT 'started',
  started_at_utc timestamptz NOT NULL DEFAULT now(),
  completed_at_utc timestamptz,
  operator_user_id uuid,
  operator_label text,
  rollback_script_path text,
  dry_run_result jsonb,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.compliance_upgrade_runs TO authenticated;
GRANT ALL ON public.compliance_upgrade_runs TO service_role;

ALTER TABLE public.compliance_upgrade_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view compliance runs" ON public.compliance_upgrade_runs;
CREATE POLICY "Admins can view compliance runs"
  ON public.compliance_upgrade_runs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- updated_at trigger (reuse existing function if present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_compliance_upgrade_runs_updated_at ON public.compliance_upgrade_runs;
CREATE TRIGGER trg_compliance_upgrade_runs_updated_at
  BEFORE UPDATE ON public.compliance_upgrade_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Immutability trigger for accepted Contract Summaries.
-- Rule: a row with status = 'accepted' cannot be UPDATEd or DELETEd by any role.
-- New versions must be inserted as separate rows.
CREATE OR REPLACE FUNCTION public.prevent_accepted_contract_summary_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'accepted' THEN
      RAISE EXCEPTION 'compliance_immutability: cannot delete accepted contract_summaries row (id=%). Insert a new version instead.', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.status = 'accepted' THEN
    RAISE EXCEPTION 'compliance_immutability: cannot update accepted contract_summaries row (id=%). Insert a new version with supersedes reference instead.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_accepted_cs_mutation ON public.contract_summaries;
CREATE TRIGGER trg_prevent_accepted_cs_mutation
  BEFORE UPDATE OR DELETE ON public.contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_accepted_contract_summary_mutation();


-- 3. Immutability trigger for contract_acceptances.
-- Rule: every row is immutable from the moment it exists.
-- Acceptances are legal evidence; no field may ever be changed and rows may never be deleted.
CREATE OR REPLACE FUNCTION public.prevent_contract_acceptance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'compliance_immutability: contract_acceptances rows are immutable legal evidence and cannot be deleted (id=%).', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RAISE EXCEPTION 'compliance_immutability: contract_acceptances rows are immutable legal evidence and cannot be updated (id=%).', OLD.id
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ca_mutation ON public.contract_acceptances;
CREATE TRIGGER trg_prevent_ca_mutation
  BEFORE UPDATE OR DELETE ON public.contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_contract_acceptance_mutation();


-- 4. Immutability trigger for acceptance_certificates.
-- Rule: every row is immutable from the moment it exists.
CREATE OR REPLACE FUNCTION public.prevent_acceptance_certificate_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'compliance_immutability: acceptance_certificates rows are immutable and cannot be deleted (id=%).', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RAISE EXCEPTION 'compliance_immutability: acceptance_certificates rows are immutable and cannot be updated (id=%).', OLD.id
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ac_mutation ON public.acceptance_certificates;
CREATE TRIGGER trg_prevent_ac_mutation
  BEFORE UPDATE OR DELETE ON public.acceptance_certificates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_acceptance_certificate_mutation();


-- 5. Record this run in the new audit table.
INSERT INTO public.compliance_upgrade_runs (
  phase, migration_version, status, completed_at_utc,
  operator_label, rollback_script_path, notes
) VALUES (
  'phase_0_preflight',
  'phase_0_compliance_preflight',
  'completed',
  now(),
  'lovable_agent',
  'supabase/migrations/rollbacks/phase_0_rollback.sql',
  jsonb_build_object(
    'summary', 'Compliance upgrade audit table created; immutability triggers installed on contract_summaries (accepted rows), contract_acceptances (all rows), acceptance_certificates (all rows).',
    'baseline_counts', jsonb_build_object(
      'contract_summaries_total', (SELECT count(*) FROM public.contract_summaries),
      'contract_summaries_accepted', (SELECT count(*) FROM public.contract_summaries WHERE status = 'accepted'),
      'contract_acceptances_total', (SELECT count(*) FROM public.contract_acceptances),
      'acceptance_certificates_total', (SELECT count(*) FROM public.acceptance_certificates)
    )
  )
);
