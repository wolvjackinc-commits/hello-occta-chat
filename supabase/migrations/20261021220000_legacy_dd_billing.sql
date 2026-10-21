-- Customers who pre-date the order flow (no order, no Contract Summary) were
-- never invoiced by OCCTA even though AccessPay collects from them every month,
-- because the two-document billing gate needs an order. An admin can now
-- approve a specific service for legacy billing; process-recurring-billing
-- then invoices it from services.price_monthly and, when the customer has an
-- active mandate, marks the bill as paid by Direct Debit (no Pay button).

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS legacy_billing_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_billing_note text;

COMMENT ON COLUMN public.services.legacy_billing_approved_at IS
  'Set by an admin to bill a service that has no order/Contract Summary (pre-order-flow customer). Only consulted when the service has no order_id.';

-- Approved by the owner on 21 Oct 2026: bill from the November cycle onwards
-- (no back-billing). All four are collected by AccessPay on the 1st.
UPDATE public.services s
   SET legacy_billing_approved_at = now(),
       legacy_billing_note = 'Owner-approved 21 Oct 2026: invoice monthly from 1 Nov 2026; collected by AccessPay Direct Debit on the 1st.',
       billing_enabled = true,
       billing_anchor_day = 1,
       next_billing_date = DATE '2026-11-01'
  FROM public.profiles p
 WHERE p.id = s.user_id
   AND p.account_number IN ('OCC70547490', 'OCC83366679', 'OCC51989830', 'OCC11519831')
   AND s.status = 'active'
   AND s.order_id IS NULL;
