-- OPT-IN DATA FIX. SIM invoices stored vat_rate as a fraction (0.20) copied
-- from sim_orders.vat_rate_snapshot. Every other invoice stores a percentage
-- (20), and readers render "VAT (x%)" and re-itemise PDFs from it, so these
-- rows show or compute 0.2% VAT. New SIM invoices now store the percentage.
--
-- Changes only the vat_rate unit; no amounts, totals or statuses.
-- Step 1 (read-only): review the rows.
SELECT id, invoice_number, invoice_type, vat_rate, vat_enabled, vat_total, total
FROM public.invoices
WHERE sim_order_id IS NOT NULL AND vat_rate > 0 AND vat_rate <= 1
ORDER BY issue_date;

-- Step 2: run only after reviewing step 1.
-- UPDATE public.invoices
-- SET vat_rate = round(vat_rate * 100, 2), updated_at = now()
-- WHERE sim_order_id IS NOT NULL AND vat_rate > 0 AND vat_rate <= 1;
