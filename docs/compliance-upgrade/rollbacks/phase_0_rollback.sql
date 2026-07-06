-- Rollback for Phase 0 (compliance preflight).
-- Safe to run ONLY if no downstream phase has referenced compliance_upgrade_runs
-- and no accepted document mutation attempt has been logged.
-- This rollback does NOT touch any legal record (contract_summaries,
-- contract_acceptances, acceptance_certificates) — only removes the audit
-- table and the immutability triggers created in Phase 0.

DROP TRIGGER IF EXISTS trg_prevent_ac_mutation ON public.acceptance_certificates;
DROP TRIGGER IF EXISTS trg_prevent_ca_mutation ON public.contract_acceptances;
DROP TRIGGER IF EXISTS trg_prevent_accepted_cs_mutation ON public.contract_summaries;

DROP FUNCTION IF EXISTS public.prevent_acceptance_certificate_mutation();
DROP FUNCTION IF EXISTS public.prevent_contract_acceptance_mutation();
DROP FUNCTION IF EXISTS public.prevent_accepted_contract_summary_mutation();

DROP TRIGGER IF EXISTS trg_compliance_upgrade_runs_updated_at ON public.compliance_upgrade_runs;
DROP TABLE IF EXISTS public.compliance_upgrade_runs;