-- Cancel stale internal-test PR-2606-LIVE1 so a fresh Phase E test PR can be created.
UPDATE public.payment_requests
SET status = 'cancelled', failed_at = now(), updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cancelled_reason','superseded_by_fresh_test_pr')
WHERE payment_request_number = 'PR-2606-LIVE1'
  AND status NOT IN ('paid','completed');
