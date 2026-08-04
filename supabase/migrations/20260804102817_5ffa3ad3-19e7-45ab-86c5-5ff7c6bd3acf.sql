
-- Block customers from changing internal-only fields on their own orders.
CREATE OR REPLACE FUNCTION public.guard_orders_customer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and internal/service-role paths keep full control.
  IF auth.uid() IS NULL OR public.has_any_admin_role(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.internal_notes IS DISTINCT FROM OLD.internal_notes
     OR NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
     OR NEW.giacom_reference IS DISTINCT FROM OLD.giacom_reference
     OR NEW.giacom_product_ref IS DISTINCT FROM OLD.giacom_product_ref
     OR NEW.entered_in_giacom_at IS DISTINCT FROM OLD.entered_in_giacom_at
     OR NEW.activation_blocked_pending_review IS DISTINCT FROM OLD.activation_blocked_pending_review
     OR NEW.legacy_compliance_status IS DISTINCT FROM OLD.legacy_compliance_status
     OR NEW.actual_activation_date IS DISTINCT FROM OLD.actual_activation_date
     OR NEW.actual_service_live_at_utc IS DISTINCT FROM OLD.actual_service_live_at_utc
     OR NEW.expected_activation_date IS DISTINCT FROM OLD.expected_activation_date
     OR NEW.cease_date IS DISTINCT FROM OLD.cease_date
     OR NEW.minimum_term_end_date IS DISTINCT FROM OLD.minimum_term_end_date
     OR NEW.etf_policy_snapshot IS DISTINCT FROM OLD.etf_policy_snapshot
     OR NEW.plan_price IS DISTINCT FROM OLD.plan_price
     OR NEW.plan_name IS DISTINCT FROM OLD.plan_name
     OR NEW.contract_type IS DISTINCT FROM OLD.contract_type
     OR NEW.payment_method_snapshot IS DISTINCT FROM OLD.payment_method_snapshot
     OR NEW.billing_start_rule IS DISTINCT FROM OLD.billing_start_rule
     OR NEW.billing_anchor_day IS DISTINCT FROM OLD.billing_anchor_day
     OR NEW.service_components_snapshot IS DISTINCT FROM OLD.service_components_snapshot
     OR NEW.occta_order_number IS DISTINCT FROM OLD.occta_order_number
     OR NEW.quote_id IS DISTINCT FROM OLD.quote_id
     OR NEW.contract_summary_id IS DISTINCT FROM OLD.contract_summary_id
     OR NEW.contract_acceptance_id IS DISTINCT FROM OLD.contract_acceptance_id
     OR NEW.journey_id IS DISTINCT FROM OLD.journey_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.guest_order_id IS DISTINCT FROM OLD.guest_order_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'internal_fields_not_customer_editable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_orders_customer_update ON public.orders;
CREATE TRIGGER trg_guard_orders_customer_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_customer_update();

CREATE OR REPLACE FUNCTION public.guard_guest_orders_customer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_any_admin_role(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.plan_name IS DISTINCT FROM OLD.plan_name
     OR NEW.plan_price IS DISTINCT FROM OLD.plan_price
     OR NEW.service_type IS DISTINCT FROM OLD.service_type
     OR NEW.order_number IS DISTINCT FROM OLD.order_number
     OR NEW.account_number IS DISTINCT FROM OLD.account_number
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.linked_at IS DISTINCT FROM OLD.linked_at
     OR NEW.linked_order_id IS DISTINCT FROM OLD.linked_order_id
  THEN
    RAISE EXCEPTION 'internal_fields_not_customer_editable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_guest_orders_customer_update ON public.guest_orders;
CREATE TRIGGER trg_guard_guest_orders_customer_update
  BEFORE UPDATE ON public.guest_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_guest_orders_customer_update();
