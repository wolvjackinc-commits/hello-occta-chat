-- Keep every order link a customer has been given working until the order
-- expires.
--
-- A Journey 2 order is found by the hash of its secret link. Each reminder
-- email (and a restart from the same browser) issued a new link and replaced
-- the hash, so the customer's open tab and every earlier email link showed
-- "Order not found". Replaced hashes are now kept here; journey2-session
-- resolves them and hands the browser the current link.
--
-- Service role only: RLS on, no policies. Idempotent.

CREATE TABLE IF NOT EXISTS public.customer_journey_token_aliases (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  journey_session_id uuid NOT NULL REFERENCES public.customer_journey_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_journey_token_aliases_session_idx
  ON public.customer_journey_token_aliases (journey_session_id);

ALTER TABLE public.customer_journey_token_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_journey_token_aliases FROM anon, authenticated;
