UPDATE public.invoices 
SET status = 'issued', 
    issue_date = CURRENT_DATE,
    due_date = '2026-09-03',
    pdf_generated_at = CURRENT_TIMESTAMP
WHERE id = '0324ab8c-8758-4493-b564-0c93ebb02ff2';

UPDATE public.dd_mandates
SET status = 'active',
    submitted_to_provider_at = CURRENT_TIMESTAMP
WHERE id = 'd3c9e365-cc43-4da3-a1e2-2a893cbf1350';