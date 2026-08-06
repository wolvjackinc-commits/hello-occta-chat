DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.dd_admin_change_mandate_status(uuid, text, text, text, timestamptz, text, text, uuid) TO sandbox_exec';
    EXECUTE 'GRANT SELECT, INSERT ON public.dd_mandates, public.dd_mandate_status_history, public.dd_email_outbox, public.journey2_test_tickets TO sandbox_exec';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.dd_admin_change_mandate_status(uuid, text, text, text, timestamptz, text, text, uuid) FROM anon;