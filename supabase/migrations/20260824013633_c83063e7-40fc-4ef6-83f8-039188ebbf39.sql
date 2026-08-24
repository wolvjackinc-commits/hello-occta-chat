-- SECURITY ISSUE REMEDIATION 2026-08-24 (Part 5)
-- Continuing hardening of trigger functions and internal RPCs.

-- 1. Trigger functions lockdown
REVOKE EXECUTE ON FUNCTION public.complaints_before_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_business_invoice() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.anonymize_old_account_deletions() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.campaign_drafts_block_publish() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotes_block_update_if_approved() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.sim_sync_invoice_paid() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_checkout_tracking() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_consent_changes() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.draft_order_pack_guard() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.kb_article_snapshot_on_approve() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_certificate_immutability() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_support_ticket_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.journey_notes_block_delete() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.cs_block_update_if_accepted() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_user_roles_change() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.journey_notes_audit() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_certificate_no_delete() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_contract_summary_no_delete() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.qr_followups_audit() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_tasks_set_updated_at() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.rewards_block_red_margin() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ticket_message_activity() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_chat_analytics_to_live_chat() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_guest_order() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cip_no_delete() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_billing_snapshots_immutable() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_dd_mandate_created() FROM public, authenticated;

-- 2. Sensitive Helper Functions
REVOKE EXECUTE ON FUNCTION public.compute_cancellation_preview(uuid, date) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_event(text, uuid, jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_event(text, jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.first_billing_job_is_eligible(uuid) FROM public, authenticated;

-- 3. Business Logic Functions (Auth checks expected internally)
REVOKE EXECUTE ON FUNCTION public.customer_create_complaint(text, text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.admin_approve_final_quote(uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_request_more_info(uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reject_quote_request(uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_override_quote_floor(uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_service_live_tx(uuid, uuid, date, text, text, text, text, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_cancellation_manual_review(uuid, text[]) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_proceed_with_quote_authed(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.customer_add_ticket_message(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.lookup_guest_order(text, text) FROM public;

-- 4. Data retrieval functions (Revoke public)
REVOKE EXECUTE ON FUNCTION public.get_customer_contract_summary_acceptance(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_reward_account() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_contract_summary_by_id(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_points_ledger(integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.admin_checkout_timeline(text, uuid) FROM public, authenticated;

-- 5. Access check helpers
REVOKE EXECUTE ON FUNCTION public.has_business_role(uuid, uuid, business_user_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_any_admin_role(uuid) FROM public;
