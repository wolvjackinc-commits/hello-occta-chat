REVOKE ALL ON FUNCTION public.confirm_service_live_tx(uuid, uuid, date, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_service_live_tx(uuid, uuid, date, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_service_live_tx(uuid, uuid, date, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_service_live_tx(uuid, uuid, date, text, text, text, text, text) TO service_role;