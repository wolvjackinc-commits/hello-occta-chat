-- SECURITY ISSUE REMEDIATION 2026-08-24 (Part 7)
-- Final hardening of exposed SECURITY DEFINER functions.

-- 1. Revoke public/auth from trigger functions (should be called by system only)
REVOKE EXECUTE ON FUNCTION public.checkout_journey_after_write() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.acceptance_certificates_before_insert() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.acceptance_certificates_block_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_artifact_immutability() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.journey2_snapshot_block_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_internal_orders_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_journey_cancelled() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_ticket_activity() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_dd_intake_create_mandate() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pm_customer_linked_create_mandate() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_status_history_block_mutation() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_internal_guest_orders_update() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_order_live_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoices_before_insert_assign_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_internal_order_columns() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.pr_before_insert_assign_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_invoice_paid_notify() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_chat_conv_handoff() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.pricing_rule_block_active_without_vat() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_customer_internal_support_tickets_update() FROM public, authenticated;

-- 2. Revoke public/auth from sensitive helper functions
REVOKE EXECUTE ON FUNCTION public.generate_acceptance_certificate_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_occta_order_number() FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_link_quote_request(uuid, uuid, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_override_red_margin(uuid) FROM public, authenticated;

-- 3. Revoke public from user-facing RPCs (allow authenticated)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_quotes() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_customer_quote_by_id(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.quote_below_retail_floor(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.dd_sync_mandate_from_intake(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_public_kb_articles() FROM public;
REVOKE EXECUTE ON FUNCTION public.link_quote_requests_to_user(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_billing_access() FROM public;
REVOKE EXECUTE ON FUNCTION public.assert_service_live(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.customer_proceed_with_quote_by_token(text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_vat_active() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_kb_articles_by_kind(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_accepted_contract_summary(uuid) FROM public;
