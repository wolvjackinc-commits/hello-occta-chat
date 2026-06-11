
-- Phase E: annotate pre-existing test payment_requests as internal test rows
-- (audit-preserving: no deletes, no core field mutations, no paid_at/webhook_verified clearing)

-- PR-0001: legacy non-CS draft
UPDATE public.payment_requests
SET notes = COALESCE(notes,'') || ' [INTERNAL TEST — legacy non-CS draft, do not action]'
WHERE payment_request_number = 'PR-2606-0001'
  AND COALESCE(notes,'') NOT LIKE '%INTERNAL TEST%';

-- PR-0002/0003/0004: already cancelled, mark as Phase E pre-secret tests
UPDATE public.payment_requests
SET notes = COALESCE(notes,'') || ' [INTERNAL TEST — Phase E pre-webhook-secret cancelled run]'
WHERE payment_request_number IN ('PR-2606-0002','PR-2606-0003','PR-2606-0004')
  AND COALESCE(notes,'') NOT LIKE '%INTERNAL TEST%';

-- PR-0005: paid via test path before WORLDPAY_WEBHOOK_SECRET existed.
-- Row remains terminal/paid (audit evidence preserved). Only notes are annotated.
UPDATE public.payment_requests
SET notes = COALESCE(notes,'') || ' [INTERNAL TEST — marked paid via pre-secret test path; preserved as audit evidence; not a real customer payment]'
WHERE payment_request_number = 'PR-2606-0005'
  AND COALESCE(notes,'') NOT LIKE '%INTERNAL TEST%';
