-- Journey 2 isolated test tables must never reference live journey sessions.
ALTER TABLE public.journey2_test_runs
  DROP CONSTRAINT IF EXISTS journey2_test_runs_session_id_fkey;

ALTER TABLE public.journey2_test_orders
  DROP CONSTRAINT IF EXISTS journey2_test_orders_session_id_fkey;

-- Redundant duplicate unique constraints left over from earlier iterations.
ALTER TABLE public.journey2_test_contract_summaries DROP CONSTRAINT IF EXISTS journey2_test_cs_session_uk;
ALTER TABLE public.journey2_test_dd_intake DROP CONSTRAINT IF EXISTS journey2_test_dd_session_uk;
ALTER TABLE public.journey2_test_email_outbox DROP CONSTRAINT IF EXISTS journey2_test_email_uk;
ALTER TABLE public.journey2_test_documents DROP CONSTRAINT IF EXISTS journey2_test_documents_uk;