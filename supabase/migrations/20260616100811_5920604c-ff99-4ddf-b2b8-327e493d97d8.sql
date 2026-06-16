
-- 1) Tighten dd_mandates RLS: only finance/compliance/admin may SELECT full record
DROP POLICY IF EXISTS dd_mandates_block_non_admin_select ON public.dd_mandates;
DROP POLICY IF EXISTS dd_mandates_admin_select ON public.dd_mandates;
DROP POLICY IF EXISTS dd_mandates_admin_write ON public.dd_mandates;

CREATE POLICY dd_mandates_priv_select ON public.dd_mandates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_admin'::app_role)
  );

CREATE POLICY dd_mandates_priv_write ON public.dd_mandates
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_admin'::app_role)
  );

-- Customers may still read their own row (masked at app layer)
DROP POLICY IF EXISTS dd_mandates_owner_select ON public.dd_mandates;
CREATE POLICY dd_mandates_owner_select ON public.dd_mandates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2) Add idempotency key + bank_name column to payment_methods for Phase E intake
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS bank_name text;

CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_idem_unique
  ON public.payment_methods(idempotency_key) WHERE idempotency_key IS NOT NULL;
