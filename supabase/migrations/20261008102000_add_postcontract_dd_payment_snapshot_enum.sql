-- Hotfix: Journey 2 now captures Direct Debit after contract acceptance.
-- The Contract Summary generator records that post-contract payment setup state
-- in payment_method_snapshot. Production still had only the legacy enum values,
-- which caused new Contract Summary inserts to fail with an invalid enum value.
--
-- Historical rows and accepted evidence are untouched.

ALTER TYPE public.payment_method_snapshot_enum
  ADD VALUE IF NOT EXISTS 'direct_debit_to_be_set_up_after_contract_acceptance';
