UPDATE public.services SET next_billing_date = '2026-08-29' WHERE user_id = '347597e6-809e-468d-a806-8a61b04d47b2'; 
UPDATE public.billing_settings SET next_invoice_date = '2026-08-29' WHERE user_id = '347597e6-809e-468d-a806-8a61b04d47b2';

INSERT INTO public.payment_attempts (user_id, invoice_id, amount, provider, provider_ref, status, attempted_at, reason) 
VALUES ('8962f90e-b142-4582-b1dc-14d372894691', 'b627a98b-98f2-484c-b5f9-e6e852077aa6', 40.00, 'direct_debit', 'DD-MANUAL-RECONCILE-INV-2607-0004', 'success', '2026-08-15T09:00:00Z', 'Direct Debit collection reported successful by customer on 15 Aug'); 

UPDATE public.invoices SET status = 'paid', notes = 'Direct Debit collection of £40.00 successful on 15 Aug 2026. Mandate verified by customer.' WHERE id = 'b627a98b-98f2-484c-b5f9-e6e852077aa6'; 

UPDATE public.services SET next_billing_date = '2026-09-01' WHERE user_id = '8962f90e-b142-4582-b1dc-14d372894691'; 

UPDATE public.billing_settings SET next_invoice_date = '2026-09-01' WHERE user_id = '8962f90e-b142-4582-b1dc-14d372894691';