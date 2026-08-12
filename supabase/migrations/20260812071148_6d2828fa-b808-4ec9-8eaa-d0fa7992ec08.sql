UPDATE public.contract_summaries
SET public_token_hash = '1c3bb7fcf15e9fc3ffbfd1fe3de1acfe83d054b56602ac10b49469d20fd7b250',
    token_expires_at = now() + interval '14 days',
    emailed_at = now()
WHERE id = '5325c248-4390-44df-a29a-1b47ff084087'
  AND status IN ('draft','issued','viewed');