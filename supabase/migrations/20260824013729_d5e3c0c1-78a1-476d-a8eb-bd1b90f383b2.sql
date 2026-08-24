-- SECURITY ISSUE REMEDIATION 2026-08-24 (Part 8)
-- Final hardening of exposed SECURITY DEFINER functions.

-- 1. Trigger functions lockdown (Revoke EXECUTE from public and authenticated)
REVOKE EXECUTE ON FUNCTION public.support_tickets_set_sla() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_quotes() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_payment_request_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_invoice_paid_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_send_quote(uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.checkout_journey_before_write() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_chat_handoff_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profiles_customer_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cip_immutability() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_contract_signed_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_dd_mandate_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_order_live_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_archive_customer(uuid, text, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.complaints_before_insert() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_orders_customer_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.complaints_before_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_business_invoice() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.campaign_drafts_block_publish() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.sim_sync_invoice_paid() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotes_block_update_if_approved() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_checkout_tracking() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_consent_changes() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.draft_order_pack_guard() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_internal_orders_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.kb_article_snapshot_on_approve() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_certificate_immutability() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_support_ticket_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.journey_notes_block_delete() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.cs_block_update_if_accepted() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_user_roles_change() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.journey_notes_audit() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_certificate_no_delete() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_contract_summary_no_delete() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_event(text, uuid, jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_tasks_set_updated_at() FROM public, authenticated;

-- 2. User-facing RPCs hardening (Revoke EXECUTE from public, allow authenticated)
REVOKE EXECUTE ON FUNCTION public.get_customer_communication_messages(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_public_contract_benefits() FROM public;
REVOKE EXECUTE ON FUNCTION public.track_checkout_event(uuid, text, text, text, integer, text, text, text, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_rewards() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_referral_codes() FROM public;
REVOKE EXECUTE ON FUNCTION public.current_reward_unlock_rule() FROM public;
REVOKE EXECUTE ON FUNCTION public.customer_create_complaint(text, text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_contract_summary_acceptance(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.search_public_kb(text, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_reward_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.has_business_role(uuid, uuid, business_user_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.customer_proceed_with_quote_authed(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.customer_add_ticket_message(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.lookup_guest_order(text, text) FROM public;
