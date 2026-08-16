-- 1. Delete the incorrect payment attempt (if not already deleted)
DELETE FROM public.payment_attempts WHERE id = 'f97e043c-6d54-4d84-b9c5-57c18a6770bc';

-- 2. Revert invoice status to 'issued' (a valid state for an unpaid active invoice)
UPDATE public.invoices 
SET status = 'issued', 
    notes = NULL 
WHERE id = 'b627a98b-98f2-484c-b5f9-e6e852077aa6';

-- 3. Revert billing dates
UPDATE public.services SET next_billing_date = '2026-08-01' WHERE user_id = '8962f90e-b142-4582-b1dc-14d372894691';
UPDATE public.billing_settings SET next_invoice_date = '2026-08-01' WHERE user_id = '8962f90e-b142-4582-b1dc-14d372894691';

-- 4. Delete the incorrect communication log entry
DELETE FROM public.communications_log 
WHERE user_id = '8962f90e-b142-4582-b1dc-14d372894691' 
AND template_name = 'manual_payment_confirmation'
AND subject = 'Payment Received - INV-2607-0004';