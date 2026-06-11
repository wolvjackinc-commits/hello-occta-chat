CREATE OR REPLACE FUNCTION public.pr_protect_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role')
                     OR (current_user = 'service_role');
BEGIN
  -- Only enforce for CS-linked payment requests (do not break legacy invoice payments)
  IF OLD.contract_summary_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Once paid, key fields are immutable; paid_at and webhook_verified cannot be cleared.
  IF OLD.status = 'paid' THEN
    IF (NEW.amount, NEW.currency, NEW.user_id, NEW.contract_summary_id,
        NEW.contract_acceptance_id, NEW.quote_id, NEW.quote_request_id,
        NEW.provider_reference)
       IS DISTINCT FROM
       (OLD.amount, OLD.currency, OLD.user_id, OLD.contract_summary_id,
        OLD.contract_acceptance_id, OLD.quote_id, OLD.quote_request_id,
        OLD.provider_reference) THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: core fields are immutable';
    END IF;
    IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS NULL THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: paid_at cannot be cleared';
    END IF;
    IF OLD.webhook_verified = true AND NEW.webhook_verified = false THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: webhook_verified cannot be cleared';
    END IF;
    -- Phase E: paid is terminal. No paid -> cancelled downgrade via normal UI/table update.
    -- Refund/void/chargeback is a separate audited flow (out of Phase E scope).
    IF NEW.status <> 'paid' THEN
      RAISE EXCEPTION 'Paid CS-linked payment_request: status is terminal (paid). Use the audited refund/void flow.';
    END IF;
  END IF;

  -- Only service_role may set status='paid' or webhook_verified=true on CS-linked rows.
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    IF NOT is_service THEN
      RAISE EXCEPTION 'Only webhook (service role) may mark CS-linked payment_request as paid';
    END IF;
  END IF;
  IF NEW.webhook_verified = true AND OLD.webhook_verified = false THEN
    IF NOT is_service THEN
      RAISE EXCEPTION 'Only webhook (service role) may set webhook_verified=true';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;