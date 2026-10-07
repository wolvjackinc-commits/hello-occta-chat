-- Keep the supplier-neutral network-validation queue scoped to the 2026.10.1
-- release without rewriting any historical contractual evidence.

-- This migration must also work on a clean database before the later
-- 20261007101500 production-hardening migration is reached. Create the generic
-- status column here if it does not yet exist; the later migration uses
-- ADD COLUMN IF NOT EXISTS and remains idempotent.
ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS network_validation_status text NOT NULL DEFAULT 'pending';
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.customer_journey_sessions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%network_validation_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.customer_journey_sessions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.customer_journey_sessions
  ADD CONSTRAINT customer_journey_sessions_network_validation_status_check
  CHECK (network_validation_status IN ('pending','verified','failed','legacy_not_required'));

UPDATE public.customer_journey_sessions
SET network_validation_status = 'legacy_not_required'
WHERE network_validation_status = 'pending'
  AND created_at < TIMESTAMPTZ '2026-10-06 00:00:00+00';
