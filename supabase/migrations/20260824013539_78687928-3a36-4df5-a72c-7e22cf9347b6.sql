-- SECURITY ISSUE REMEDIATION 2026-08-24 (Part 3)
-- Hardening trigger functions and sensitive RPCs.

-- 1. Trigger functions should NEVER be directly executable by users
REVOKE EXECUTE ON FUNCTION public.enforce_artifact_immutability() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.journey2_snapshot_block_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_dd_intake_create_mandate() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pm_customer_linked_create_mandate() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_manual_fulfilment_eligibility() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_account_number_on_active() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_status_history_block_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_accepted_contract_summary_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_internal_guest_orders_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoices_before_insert_assign_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_order_live_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_internal_order_columns() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.pr_before_insert_assign_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_invoice_paid_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_chat_conv_handoff() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_ticket_activity() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_slot_booking() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, authenticated;

-- 2. Sensitive Helper Functions
REVOKE EXECUTE ON FUNCTION public.generate_user_account_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_occta_order_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_cooling_off(timestamp with time zone) FROM public, authenticated;

-- 3. Specific RPCs (These are meant to be called, so only revoking public is safest if they check auth internally)
REVOKE EXECUTE ON FUNCTION public.customer_accept_contract_summary(uuid, text, text, text, boolean) FROM public;
REVOKE EXECUTE ON FUNCTION public.link_my_customer_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.customer_proceed_with_quote_by_token(text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.journey2_commit_order(uuid, text, uuid) FROM public;

-- 4. Access helpers should be restricted
REVOKE EXECUTE ON FUNCTION public.has_billing_access() FROM public;
REVOKE EXECUTE ON FUNCTION public.has_finance_access(uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_compliance_access(uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_marketing_access(uuid) FROM public, authenticated;

-- 5. Data retrieval functions (Revoke public, allow authenticated)
REVOKE EXECUTE ON FUNCTION public.get_customer_ticket_messages(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_complaints() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_communication_threads() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_complaint_events(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_quotes() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_quote_by_id(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_my_customer_overview() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_tickets() FROM public;
