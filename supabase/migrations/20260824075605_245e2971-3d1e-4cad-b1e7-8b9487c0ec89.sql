GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_quote_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_quote_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_more_info(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_final_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override_quote_floor(uuid, text) TO authenticated;