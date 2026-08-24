-- SECURITY ISSUE REMEDIATION 2026-08-24 (Part 4 - Corrected)
-- Continuing hardening of trigger functions and internal RPCs.

-- 1. Trigger functions lockdown
REVOKE EXECUTE ON FUNCTION public.pricing_rule_block_active_without_vat() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_internal_support_tickets_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_dd_mandate_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_tickets_set_sla() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_invoice_paid_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.checkout_journey_before_write() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_chat_handoff_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_acceptance_audit_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_profile_account_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profiles_customer_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cip_immutability() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_contract_signed_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_dd_mandate_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_order_live_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.complaints_before_insert() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_slot_booking() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_customer_journey_sessions() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_quotes() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, authenticated;

-- 2. Sensitive Helper Functions
REVOKE EXECUTE ON FUNCTION public.generate_complaint_reference() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_payment_request_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_event(text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, text, text, text, text) FROM public, authenticated;

-- 3. Business Logic Functions (Auth checks expected internally)
REVOKE EXECUTE ON FUNCTION public.customer_create_ticket(text, text, text, text, boolean) FROM public;
REVOKE EXECUTE ON FUNCTION public.journey2_link_provisioned_account(uuid, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.recompute_reward_balances(uuid) FROM public, authenticated; 
REVOKE EXECUTE ON FUNCTION public.can_send_quote(uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_archive_customer(uuid, text, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_override_red_margin(uuid) FROM public, authenticated;

-- 4. Data retrieval functions (Revoke public)
REVOKE EXECUTE ON FUNCTION public.get_customer_complaint_letters() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_platform_settings() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_communication_messages(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_rewards() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_referral_codes() FROM public;
REVOKE EXECUTE ON FUNCTION public.current_reward_unlock_rule() FROM public;

-- 5. Access check helpers
REVOKE EXECUTE ON FUNCTION public.has_accepted_contract_summary(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM public;
