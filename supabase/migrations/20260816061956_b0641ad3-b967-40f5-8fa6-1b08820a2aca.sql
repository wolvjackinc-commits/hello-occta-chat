-- 1. Update Brian Shotton (OCC51556104) billing rules
-- Set billing day to 1, next invoice/billing date to Sept 1st
UPDATE public.billing_settings 
SET billing_day = 1, 
    next_invoice_date = '2026-09-01' 
WHERE user_id = '347597e6-809e-468d-a806-8a61b04d47b2';

UPDATE public.services 
SET billing_anchor_day = 1, 
    next_billing_date = '2026-09-01' 
WHERE user_id = '347597e6-809e-468d-a806-8a61b04d47b2';

-- 2. Update Dullabhbhai Mistry (OCC70547490) records
-- Record INV-2607-0004 as paid via DD on 01/08/2026
INSERT INTO public.payment_attempts (user_id, invoice_id, amount, provider, provider_ref, status, attempted_at, reason) 
VALUES ('8962f90e-b142-4582-b1dc-14d372894691', 'b627a98b-98f2-484c-b5f9-e6e852077aa6', 40.00, 'direct_debit', 'DD-VERIFIED-AUG-01', 'success', '2026-08-01T09:00:00Z', 'Direct Debit collection confirmed by admin for 1st Aug');

UPDATE public.invoices 
SET status = 'paid', 
    notes = 'Direct Debit collection of £40.00 successful on 1 Aug 2026.' 
WHERE id = 'b627a98b-98f2-484c-b5f9-e6e852077aa6';

-- Set Mistry's next invoice to 29th August (for Sept 1st service)
UPDATE public.billing_settings 
SET next_invoice_date = '2026-08-29' 
WHERE user_id = '8962f90e-b142-4582-b1dc-14d372894691';

UPDATE public.services 
SET next_billing_date = '2026-09-01' 
WHERE user_id = '8962f90e-b142-4582-b1dc-14d372894691';