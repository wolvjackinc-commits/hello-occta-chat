-- Extend Journey 2 state for a saved sale awaiting exact network validation.
ALTER TABLE public.customer_journey_sessions
  DROP CONSTRAINT IF EXISTS cjs_status_chk;
ALTER TABLE public.customer_journey_sessions
  ADD CONSTRAINT cjs_status_chk CHECK (
    status = ANY (ARRAY[
      'active'::text,
      'network_validation_pending'::text,
      'contract_prepared'::text,
      'contract_accepted'::text,
      'order_submitted'::text,
      'completed'::text,
      'cancelled'::text,
      'expired'::text,
      'manual_review'::text
    ])
  );

-- Supplier-neutral network validation queue for broadband Journey 2.
-- This is forward-only and does not rewrite accepted historical contract evidence.

CREATE TABLE IF NOT EXISTS public.network_validation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.customer_journey_sessions(id) ON DELETE CASCADE,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','cancelled')),
  address_snapshot jsonb NOT NULL,
  speed_bucket text,
  plan_term text,
  source_label text,
  source_reference text,
  evidence_snapshot jsonb,
  evidence_sha256 text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  validated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.network_validation_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage network validation cases" ON public.network_validation_cases;
CREATE POLICY "Staff manage network validation cases"
ON public.network_validation_cases
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'compliance_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'compliance_admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_network_validation_cases_status
  ON public.network_validation_cases(status, requested_at);

CREATE OR REPLACE VIEW public.network_validation_queue
WITH (security_invoker = true) AS
SELECT
  n.id,
  n.session_id,
  n.quote_request_id,
  n.status,
  n.address_snapshot,
  n.speed_bucket,
  n.plan_term,
  n.source_label,
  n.source_reference,
  n.requested_at,
  n.validated_at,
  q.reference AS quote_request_reference,
  q.full_name,
  q.email,
  q.phone,
  q.postcode
FROM public.network_validation_cases n
LEFT JOIN public.quote_requests q ON q.id=n.quote_request_id
WHERE n.status='pending'
ORDER BY n.requested_at ASC;

GRANT SELECT ON public.network_validation_queue TO authenticated;
