// Phase F billing gate.
// Any first-invoice / recurring-billing edge function that runs inside the
// two-document compliance flow MUST call assertServiceLive() before
// creating invoices or charging cards. Legacy paths continue to work
// unchanged because they never import this helper.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BillingGateInput {
  orderId: string;
  // Optional service id. When provided the gate also checks the service-level
  // activation_blocked_pending_review flag and (when the two-doc flow is on)
  // delegates to the DB assert_service_live() function.
  serviceId?: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

export interface BillingGateResult {
  allowed: boolean;
  reason?: string;
  actualServiceLiveAtUtc?: string | null;
}

/**
 * Returns { allowed: true } only when the order has a recorded
 * actual_service_live_at_utc timestamp AND the two-document flow flag
 * is enabled. Otherwise the caller MUST abort — no invoice, no card
 * charge, no Direct Debit collection.
 */
export async function assertServiceLive(
  input: BillingGateInput,
): Promise<BillingGateResult> {
  const supabase = createClient(input.supabaseUrl, input.serviceRoleKey);

  const { data: flagRow } = await supabase
    .from("platform_settings")
    .select("two_document_contract_flow_enabled")
    .maybeSingle();

  const flagOn = !!flagRow?.two_document_contract_flow_enabled;
  if (!flagOn) {
    // Legacy flow — this helper is not authoritative, defer to caller.
    return { allowed: true, reason: "legacy-flow-flag-off" };
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, actual_service_live_at_utc, status, activation_blocked_pending_review, contract_summary_id")
    .eq("id", input.orderId)
    .maybeSingle();

  if (error || !order) {
    return { allowed: false, reason: "order-not-found" };
  }

  if ((order as any).activation_blocked_pending_review === true) {
    return { allowed: false, reason: "activation-blocked-pending-review" };
  }

  if (!order.actual_service_live_at_utc) {
    return {
      allowed: false,
      reason: "service-not-live",
      actualServiceLiveAtUtc: null,
    };
  }

  // Two-doc flow requires an accepted Contract Summary. The signed PDF/hash
  // live on the contract_summaries row (source of truth), not on orders.
  if (!(order as any).contract_summary_id) {
    return { allowed: false, reason: "missing-contract-summary" };
  }
  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("id, status, accepted_at, pdf_hash, pdf_storage_key, pdf_url, monthly_price_incl_vat")
    .eq("id", (order as any).contract_summary_id)
    .maybeSingle();
  if (!cs) return { allowed: false, reason: "contract-summary-not-found" };
  if (cs.status !== "accepted" || !cs.accepted_at) {
    return { allowed: false, reason: "contract-summary-not-accepted" };
  }
  if (!cs.monthly_price_incl_vat) {
    return { allowed: false, reason: "missing-monthly-price" };
  }

  if (input.serviceId) {
    const { data: svc } = await supabase
      .from("services")
      .select("activation_blocked_pending_review, actual_activation_date, activation_confirmed_at, billing_enabled")
      .eq("id", input.serviceId)
      .maybeSingle();
    if (!svc) return { allowed: false, reason: "service-not-found" };
    if ((svc as any).activation_blocked_pending_review === true) {
      return { allowed: false, reason: "service-activation-blocked-pending-review" };
    }
    if (!(svc as any).actual_activation_date || !(svc as any).activation_confirmed_at || (svc as any).billing_enabled !== true) {
      return { allowed: false, reason: "service-not-confirmed-live" };
    }
  }

  return {
    allowed: true,
    actualServiceLiveAtUtc: order.actual_service_live_at_utc,
  };
}