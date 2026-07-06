// Phase F billing gate.
// Any first-invoice / recurring-billing edge function that runs inside the
// two-document compliance flow MUST call assertServiceLive() before
// creating invoices or charging cards. Legacy paths continue to work
// unchanged because they never import this helper.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BillingGateInput {
  orderId: string;
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
    .select("id, actual_service_live_at_utc, status")
    .eq("id", input.orderId)
    .maybeSingle();

  if (error || !order) {
    return { allowed: false, reason: "order-not-found" };
  }

  if (!order.actual_service_live_at_utc) {
    return {
      allowed: false,
      reason: "service-not-live",
      actualServiceLiveAtUtc: null,
    };
  }

  return {
    allowed: true,
    actualServiceLiveAtUtc: order.actual_service_live_at_utc,
  };
}