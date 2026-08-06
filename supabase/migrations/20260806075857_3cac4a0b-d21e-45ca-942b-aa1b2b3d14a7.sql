-- ── Journey 2 isolated test path ──────────────────────────────────────────────
CREATE TABLE public.journey2_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.customer_journey_sessions(id) ON DELETE SET NULL,
  checkout_session_id uuid,
  started_by uuid,
  label text NOT NULL DEFAULT 'TEST',
  status text NOT NULL DEFAULT 'running',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.journey2_test_runs TO authenticated;
GRANT ALL ON public.journey2_test_runs TO service_role;
ALTER TABLE public.journey2_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "j2_test_runs_admin_read" ON public.journey2_test_runs FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "j2_test_runs_service" ON public.journey2_test_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER journey2_test_runs_updated_at BEFORE UPDATE ON public.journey2_test_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey2_test_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.journey2_test_runs(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.customer_journey_sessions(id) ON DELETE SET NULL,
  checkout_session_id uuid NOT NULL,
  test_order_number text NOT NULL,
  label text NOT NULL DEFAULT 'TEST',
  plan_name text,
  monthly_ex_vat numeric(10,2),
  monthly_vat_amount numeric(10,2),
  monthly_incl_vat numeric(10,2),
  one_off_incl_vat numeric(10,2) NOT NULL DEFAULT 0,
  amount_due_today numeric(10,2) NOT NULL DEFAULT 0,
  estimated_first_bill_incl_vat numeric(10,2),
  preferred_start_date date,
  billing_anchor_day integer,
  dd_masked jsonb,
  dd_status text,
  snapshot_sha256 text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_test_orders_due_today_zero CHECK (amount_due_today = 0),
  CONSTRAINT journey2_test_orders_checkout_uk UNIQUE (checkout_session_id)
);
GRANT SELECT ON public.journey2_test_orders TO authenticated;
GRANT ALL ON public.journey2_test_orders TO service_role;
ALTER TABLE public.journey2_test_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "j2_test_orders_admin_read" ON public.journey2_test_orders FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "j2_test_orders_service" ON public.journey2_test_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER journey2_test_orders_updated_at BEFORE UPDATE ON public.journey2_test_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.journey2_test_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_order_id uuid NOT NULL REFERENCES public.journey2_test_orders(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text NOT NULL,
  snapshot_sha256 text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_test_documents_uk UNIQUE (test_order_id, doc_type)
);
GRANT SELECT ON public.journey2_test_documents TO authenticated;
GRANT ALL ON public.journey2_test_documents TO service_role;
ALTER TABLE public.journey2_test_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "j2_test_docs_admin_read" ON public.journey2_test_documents FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "j2_test_docs_service" ON public.journey2_test_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.journey2_test_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_order_id uuid NOT NULL REFERENCES public.journey2_test_orders(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient_masked text NOT NULL,
  subject text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'suppressed_test',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_test_email_uk UNIQUE (test_order_id, email_type),
  CONSTRAINT journey2_test_email_never_sent CHECK (status = 'suppressed_test')
);
GRANT SELECT ON public.journey2_test_email_outbox TO authenticated;
GRANT ALL ON public.journey2_test_email_outbox TO service_role;
ALTER TABLE public.journey2_test_email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "j2_test_email_admin_read" ON public.journey2_test_email_outbox FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "j2_test_email_service" ON public.journey2_test_email_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.journey2_test_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.journey2_test_runs(id) ON DELETE CASCADE,
  gate_key text NOT NULL,
  ok boolean NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.journey2_test_events TO authenticated;
GRANT ALL ON public.journey2_test_events TO service_role;
ALTER TABLE public.journey2_test_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "j2_test_events_admin_read" ON public.journey2_test_events FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "j2_test_events_service" ON public.journey2_test_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Live welcome-pack email outbox ────────────────────────────────────────────
CREATE TABLE public.journey2_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.customer_journey_sessions(id) ON DELETE SET NULL,
  checkout_session_id uuid,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journey2_email_outbox_uk UNIQUE (order_id, email_type),
  CONSTRAINT journey2_email_outbox_status_chk CHECK (status IN ('pending','sending','sent','failed','cancelled'))
);
GRANT SELECT ON public.journey2_email_outbox TO authenticated;
GRANT ALL ON public.journey2_email_outbox TO service_role;
ALTER TABLE public.journey2_email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "j2_outbox_admin_read" ON public.journey2_email_outbox FOR SELECT TO authenticated USING (public.has_any_admin_role(auth.uid()));
CREATE POLICY "j2_outbox_service" ON public.journey2_email_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER journey2_email_outbox_updated_at BEFORE UPDATE ON public.journey2_email_outbox FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Direct Debit lifecycle ────────────────────────────────────────────────────
ALTER TABLE public.customer_journey_sessions
  ADD COLUMN IF NOT EXISTS dd_status text,
  ADD COLUMN IF NOT EXISTS test_run_id uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.customer_journey_sessions
  ADD CONSTRAINT customer_journey_sessions_dd_status_chk
  CHECK (dd_status IS NULL OR dd_status IN ('details_received','pending_contract','setup_requested','submitted_to_provider','active','failed','cancelled'));

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_dd_setup_status_chk
  CHECK (dd_setup_status IS NULL OR dd_setup_status IN ('details_received','pending_contract','setup_requested','submitted_to_provider','active','failed','cancelled'));

-- ── Duplicate-submission protection ───────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS quotes_checkout_session_uk
  ON public.quotes (checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS order_journeys_checkout_session_uk
  ON public.order_journeys (checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_checkout_session_uk
  ON public.payment_methods (checkout_session_id) WHERE checkout_session_id IS NOT NULL;