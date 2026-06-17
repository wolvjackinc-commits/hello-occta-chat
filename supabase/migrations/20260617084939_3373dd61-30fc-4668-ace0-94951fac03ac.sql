REVOKE ALL ON FUNCTION public.confirm_service_live_tx(uuid, uuid, date, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_service_live_tx(uuid, uuid, date, text, text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.next_anchor_billing_date(date, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_anchor_billing_date(date, int) TO authenticated, service_role;