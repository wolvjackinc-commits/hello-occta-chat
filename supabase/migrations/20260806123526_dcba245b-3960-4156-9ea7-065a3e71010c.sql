-- ============================================================
-- Journey 2 — dedicated, fully isolated TEST infrastructure
-- ============================================================

DROP VIEW IF EXISTS public.journey2_test_sessions;

-- ── Real test sessions table ────────────────────────────────
CREATE TABLE public.journey2_test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid,
  label text NOT NULL DEFAULT 'TEST — Journey 2 isolated run',
  journey_version text NOT NULL DEFAULT 'v2',
  test_session boolean NOT NULL DEFAULT true,
  public_token_hash text NOT NULL UNIQUE,
  checkout_session_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'in_progress',
  current_step text NOT NULL DEFAULT 'address',
  last_completed_step text,
  postcode text,
  service_address jsonb,
  speed_bucket text,
  plan_term text,
  router_option jsonb,
  setup_option jsonb,
  selected_addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  digital_voice_acknowledged boolean NOT NULL DEFAULT false,
  customer_details jsonb,
  preferred_start_date date,
  cooling_off_acknowledged boolean NOT NULL DEFAULT false,
  billing_anchor_day integer,
  dd_consent boolean NOT NULL DEFAULT false,
  dd_masked jsonb,
  dd_status text,
  price_snapshot jsonb,
  contract_locked boolean NOT NULL DEFAULT false,
  test_snapshot_id uuid,
  accepted_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_test_sessions_is_test CHECK (test_session = true),
  CONSTRAINT journey2_test_sessions_label CHECK (label LIKE 'TEST%'),
  CONSTRAINT journey2_test_sessions_version CHECK (journey_version = 'v2'),
  CONSTRAINT journey2_test_sessions_dd_status CHECK (
    dd_status IS NULL OR dd_status IN
      ('details_received','pending_contract','suppressed_test','setup_requested_test')
  )
);

GRANT SELECT ON public.journey2_test_sessions TO authenticated;
GRANT ALL ON public.journey2_test_sessions TO service_role;
ALTER TABLE public.journey2_test_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view isolated test sessions"
  ON public.journey2_test_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- ── Immutable test snapshots ────────────────────────────────
CREATE TABLE public.journey2_test_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid,
  session_id uuid NOT NULL REFERENCES public.journey2_test_sessions(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'TEST — isolated contract snapshot',
  snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL,
  pricing_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_test_snapshots_label CHECK (label LIKE 'TEST%'),
  CONSTRAINT journey2_test_snapshots_hash CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX journey2_test_snapshots_session_uniq
  ON public.journey2_test_snapshots (session_id);

GRANT SELECT ON public.journey2_test_snapshots TO authenticated;
GRANT ALL ON public.journey2_test_snapshots TO service_role;
ALTER TABLE public.journey2_test_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view isolated test snapshots"
  ON public.journey2_test_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.journey2_test_snapshot_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'journey2_test_snapshots is append-only';
END;
$$;

CREATE TRIGGER journey2_test_snapshots_no_change
  BEFORE UPDATE OR DELETE ON public.journey2_test_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.journey2_test_snapshot_immutable();

CREATE OR REPLACE FUNCTION public.journey2_test_sessions_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER journey2_test_sessions_set_updated_at
  BEFORE UPDATE ON public.journey2_test_sessions
  FOR EACH ROW EXECUTE FUNCTION public.journey2_test_sessions_touch();

-- ── Re-point existing isolated test tables at the test sessions ──
DELETE FROM public.journey2_test_events;
DELETE FROM public.journey2_test_email_outbox;
DELETE FROM public.journey2_test_documents;
DELETE FROM public.journey2_test_acceptances;
DELETE FROM public.journey2_test_contract_summaries;
DELETE FROM public.journey2_test_dd_intake;
DELETE FROM public.journey2_test_orders;
DELETE FROM public.journey2_test_runs;

ALTER TABLE public.journey2_test_runs
  ADD CONSTRAINT journey2_test_runs_session_fk
  FOREIGN KEY (session_id) REFERENCES public.journey2_test_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.journey2_test_orders
  ADD CONSTRAINT journey2_test_orders_session_fk
  FOREIGN KEY (session_id) REFERENCES public.journey2_test_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.journey2_test_dd_intake
  ADD CONSTRAINT journey2_test_dd_intake_session_fk
  FOREIGN KEY (session_id) REFERENCES public.journey2_test_sessions(id) ON DELETE CASCADE,
  ADD CONSTRAINT journey2_test_dd_intake_status CHECK (
    dd_status IN ('details_received','pending_contract','suppressed_test','setup_requested_test')
  );

ALTER TABLE public.journey2_test_contract_summaries
  ADD CONSTRAINT journey2_test_cs_session_fk
  FOREIGN KEY (session_id) REFERENCES public.journey2_test_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.journey2_test_acceptances
  ADD CONSTRAINT journey2_test_acc_session_fk
  FOREIGN KEY (session_id) REFERENCES public.journey2_test_sessions(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX journey2_test_orders_session_uniq
  ON public.journey2_test_orders (session_id);
CREATE UNIQUE INDEX journey2_test_dd_intake_session_uniq
  ON public.journey2_test_dd_intake (session_id);
CREATE UNIQUE INDEX journey2_test_acceptances_session_uniq
  ON public.journey2_test_acceptances (session_id);
CREATE UNIQUE INDEX journey2_test_cs_session_uniq
  ON public.journey2_test_contract_summaries (session_id);
CREATE UNIQUE INDEX journey2_test_documents_type_uniq
  ON public.journey2_test_documents (test_order_id, doc_type);
CREATE UNIQUE INDEX journey2_test_email_outbox_type_uniq
  ON public.journey2_test_email_outbox (test_order_id, email_type);

-- ── Every isolated row must carry a TEST label ──────────────
CREATE OR REPLACE FUNCTION public.journey2_require_test_label()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.label IS NULL OR NEW.label NOT LIKE 'TEST%' THEN
    RAISE EXCEPTION 'isolated test rows must be labelled TEST';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER journey2_test_orders_label
  BEFORE INSERT OR UPDATE ON public.journey2_test_orders
  FOR EACH ROW EXECUTE FUNCTION public.journey2_require_test_label();
CREATE TRIGGER journey2_test_dd_intake_label
  BEFORE INSERT OR UPDATE ON public.journey2_test_dd_intake
  FOR EACH ROW EXECUTE FUNCTION public.journey2_require_test_label();
CREATE TRIGGER journey2_test_acceptances_label
  BEFORE INSERT OR UPDATE ON public.journey2_test_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.journey2_require_test_label();
CREATE TRIGGER journey2_test_cs_label
  BEFORE INSERT OR UPDATE ON public.journey2_test_contract_summaries
  FOR EACH ROW EXECUTE FUNCTION public.journey2_require_test_label();
CREATE TRIGGER journey2_test_runs_label
  BEFORE INSERT OR UPDATE ON public.journey2_test_runs
  FOR EACH ROW EXECUTE FUNCTION public.journey2_require_test_label();