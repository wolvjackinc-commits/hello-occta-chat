-- SECURITY ISSUE REMEDIATION 2026-08-24 (Part 6)
-- Continuing hardening of trigger functions and internal RPCs.

-- 1. Trigger functions lockdown
REVOKE EXECUTE ON FUNCTION public.notify_dd_status_change() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_guest_orders_customer_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_acceptance_certificate_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_contract_acceptance_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.pr_guard_cs_linked() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_tasks_audit() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_contract_summary_immutability() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.pr_protect_paid() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.dedupe_chat_message_insert() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_information_update_never_accepted() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_acceptance_not_information_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_support_ticket_activity() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_retired_card_payment_requests() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_internal_orders_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_journey_cancelled() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_new_worldpay_receipts() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_accepted_cip_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.throttle_public_help_write() FROM public, authenticated;

-- 2. Sensitive Helper Functions
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_action(text, text, uuid, jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_safe_account_number() FROM public, authenticated;

-- 3. Business Logic Functions (Auth checks expected internally)
REVOKE EXECUTE ON FUNCTION public.dd_admin_change_mandate_status(uuid, text, text, text, timestamp with time zone, text, text, uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_service_cancellation(uuid, date, uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_create_manual_fulfilment_for_journey(uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_quote_unified_opt_in(uuid, boolean) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_manual_fulfilment_tracker_for_order(uuid, uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_order_journey_by_token(text) FROM public;

-- 4. Data retrieval functions (Revoke public)
REVOKE EXECUTE ON FUNCTION public.get_customer_quote_requests() FROM public;
REVOKE EXECUTE ON FUNCTION public.admin_checkout_session_list(integer) FROM public, authenticated;
