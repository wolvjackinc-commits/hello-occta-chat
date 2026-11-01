-- Refer-a-friend message dispatch uses the platform's single-use cron tokens
-- (invoke_edge_function_from_cron mints one per call; the worker spends it
-- with consume_cron_token). No separate worker secret or vault entry needed.
-- Still a no-op while rewards_enabled is false or the outbox is empty.
CREATE OR REPLACE FUNCTION public.referral_dispatch_messages() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.referral_enabled() THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.referral_message_outbox
                 WHERE status = 'pending' OR (status = 'processing' AND locked_until < now())) THEN
    RETURN false;
  END IF;
  PERFORM public.invoke_edge_function_from_cron('referral-message-worker', '{}'::jsonb);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.referral_dispatch_messages() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_dispatch_messages() TO service_role;
