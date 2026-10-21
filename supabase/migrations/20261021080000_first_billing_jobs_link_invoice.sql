-- A first-billing job only recorded its invoice_id on success. When the email
-- step failed after the invoice was created, first_billing_job_is_eligible()
-- saw that invoice as a duplicate of a different job and skipped the retry
-- forever. process-first-billing now links the invoice as soon as it is
-- created; this backfills jobs already stuck that way.
--
-- Only jobs still waiting to retry whose invoice is still a draft (never
-- emailed, never chased) are linked, so nothing already sent or overdue is
-- emailed out of the blue.
UPDATE public.first_billing_jobs j
   SET invoice_id = i.id
  FROM public.invoices i
 WHERE j.invoice_id IS NULL
   AND j.status = 'retry_scheduled'
   AND i.service_id = j.service_id
   AND i.billing_period_start = j.period_start
   AND i.billing_period_end = j.period_end
   AND i.invoice_type = CASE WHEN j.is_pro_rata THEN 'first_pro_rata' ELSE 'monthly' END
   AND i.status = 'draft'
   AND i.email_sent_at IS NULL;
