-- 1 · Journey 2 session: pre-contract start date, billing and acknowledgements
ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS preferred_start_date date,
  ADD COLUMN IF NOT EXISTS cooling_off_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_anchor_day integer,
  ADD COLUMN IF NOT EXISTS dd_masked jsonb,
  ADD COLUMN IF NOT EXISTS digital_voice_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS contract_snapshot_id uuid,
  ADD COLUMN IF NOT EXISTS post_contract_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.customer_journey_sessions
  ADD CONSTRAINT customer_journey_sessions_billing_day_ck
  CHECK (billing_anchor_day IS NULL OR (billing_anchor_day BETWEEN 1 AND 31)) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS customer_journey_sessions_checkout_uk
  ON public.customer_journey_sessions (checkout_session_id);

-- 2 · Encrypted Direct Debit intake held by the Journey 2 session
CREATE TABLE IF NOT EXISTS public.journey2_dd_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.customer_journey_sessions(id) ON DELETE CASCADE,
  bank_details_ciphertext bytea NOT NULL,
  nonce bytea NOT NULL,
  enc_key_id text NOT NULL,
  enc_alg text NOT NULL DEFAULT 'AES-256-GCM',
  masked_account_last4 text NOT NULL,
  masked_sort_last2 text NOT NULL,
  bank_name text,
  account_holder_name text,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_dd_intake_session_uk ON public.journey2_dd_intake (session_id);

GRANT ALL ON public.journey2_dd_intake TO service_role;
ALTER TABLE public.journey2_dd_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey2_dd_intake_service_only"
  ON public.journey2_dd_intake FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER journey2_dd_intake_updated_at
  BEFORE UPDATE ON public.journey2_dd_intake
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3 · Immutable final contractual snapshot
CREATE TABLE IF NOT EXISTS public.journey2_contract_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.customer_journey_sessions(id) ON DELETE RESTRICT,
  checkout_session_id uuid NOT NULL,
  journey_version text NOT NULL DEFAULT 'v2',
  test_session boolean NOT NULL DEFAULT false,
  pricing_version text NOT NULL,
  legal_document_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS journey2_contract_snapshots_session_uk
  ON public.journey2_contract_snapshots (session_id);

GRANT SELECT ON public.journey2_contract_snapshots TO authenticated;
GRANT ALL ON public.journey2_contract_snapshots TO service_role;
ALTER TABLE public.journey2_contract_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey2_snapshots_admin_read"
  ON public.journey2_contract_snapshots FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "journey2_snapshots_service_all"
  ON public.journey2_contract_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.journey2_snapshot_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'journey2_contract_snapshots is append-only';
END;
$$;

CREATE TRIGGER journey2_snapshot_no_update
  BEFORE UPDATE OR DELETE ON public.journey2_contract_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.journey2_snapshot_block_mutation();

-- 4 · Journey traceability on downstream records
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS journey_version text,
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid;
ALTER TABLE public.order_journeys
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid;
ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS journey_version text,
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid;
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS journey_version text,
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid;

-- One checkout session can only ever produce one order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_session_uk
  ON public.orders (checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_journey_sessions_order_uk
  ON public.customer_journey_sessions (order_id) WHERE order_id IS NOT NULL;