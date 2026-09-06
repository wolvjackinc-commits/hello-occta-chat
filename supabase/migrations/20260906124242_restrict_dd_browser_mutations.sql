-- Restore the intended browser boundary after full-stack CI exposed inherited
-- grants. Live catalog inspection confirmed the same grants. No rows change.
BEGIN;
REVOKE ALL ON public.dd_email_outbox, public.dd_mandate_status_history
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dd_email_outbox, public.dd_mandate_status_history TO authenticated;

REVOKE ALL ON public.dd_mandates FROM PUBLIC, anon, authenticated;
-- Table revocations do not remove the older explicit column-level INSERT grant.
REVOKE INSERT (
  user_id, status, mandate_reference, bank_last4, account_holder,
  account_holder_name, provider_code, is_test, payment_request_id, consent_timestamp
) ON public.dd_mandates FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (status, sort_code, account_number_full, bank_details_ciphertext)
  ON public.dd_mandates FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, user_id, status, mandate_reference, bank_last4, provider, provider_code,
  provider_reference, account_holder, account_holder_name, created_at, updated_at,
  consent_timestamp, payment_request_id, submitted_to_provider_at, is_test,
  masked_account_last4, masked_sort_last2, plaintext_purged_at
) ON public.dd_mandates TO authenticated;

-- Preserve the finance/admin UI's masked manual-intake creation under existing
-- RLS. The database supplies the initial details_received state; the browser cannot set
-- or update status, bank secrets, provider results, history or delivery state.
GRANT INSERT (user_id, mandate_reference, bank_last4, account_holder)
  ON public.dd_mandates TO authenticated;
COMMIT;
