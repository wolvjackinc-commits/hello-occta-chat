-- 1) complaints: require customer-created complaints to be owned by the caller
DROP POLICY IF EXISTS "customers create own complaints" ON public.complaints;
CREATE POLICY "customers create own complaints"
ON public.complaints
FOR INSERT
TO authenticated
WITH CHECK (customer_id = auth.uid());

-- 2) cancellation_quotes: customers may only create zeroed preview quotes for themselves
DROP POLICY IF EXISTS "Customers create own cancellation quotes" ON public.cancellation_quotes;
CREATE POLICY "Customers create own cancellation quotes"
ON public.cancellation_quotes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    user_id = auth.uid()
    AND status = 'preview'
    AND accepted_at IS NULL
    AND (created_by IS NULL OR created_by = auth.uid())
    AND monthly_amount = 0
    AND remaining_months = 0
    AND outstanding_charges = 0
    AND etf_amount = 0
    AND notice_days = 0
    AND termination_date IS NULL
    AND breakdown = '[]'::jsonb
  )
);
