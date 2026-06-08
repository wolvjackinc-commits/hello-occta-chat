/**
 * Pay-gate helper (Phase 2): new telecom sales require an accepted Contract Summary
 * in BOTH manual and live modes. Legacy invoice payments (/pay-invoice) and admin
 * payment-request links (/pay) are EXEMPT and untouched.
 */
import { supabase } from "@/integrations/supabase/client";

export type CheckoutKind =
  | "new_telecom_sale"
  | "legacy_invoice"
  | "payment_request"
  | "sim_instant";

export interface CheckoutContext {
  kind: CheckoutKind;
  reference?: string;
  quoteId?: string;
  contractSummaryId?: string;
  token?: string;
  cartId?: string;
  invoiceId?: string;
}

export function requiresContractSummary(ctx: CheckoutContext): boolean {
  if (ctx.kind === "legacy_invoice") return false;
  if (ctx.kind === "payment_request") return false;
  if (ctx.kind === "sim_instant") return false;
  return true;
}

export async function hasAcceptedContractSummary(
  ctx: CheckoutContext
): Promise<{ accepted: boolean; contractSummaryId: string | null }> {
  try {
    // 1. quoteId → RPC
    if (ctx.quoteId) {
      const { data, error } = await (supabase as any).rpc("has_accepted_contract_summary", {
        _quote_id: ctx.quoteId,
      });
      if (error) return { accepted: false, contractSummaryId: null };
      return { accepted: data === true, contractSummaryId: null };
    }
    // 2. token → fetch CS by token; status must be 'accepted'
    if (ctx.token) {
      const { data, error } = await supabase.functions.invoke("get-contract-summary-by-token", {
        body: { token: ctx.token },
      });
      if (error || !data) return { accepted: false, contractSummaryId: null };
      const cs = (data as any).contract_summary ?? data;
      const accepted = cs?.status === "accepted";
      return { accepted, contractSummaryId: cs?.id ?? null };
    }
    // 3. contractSummaryId → direct select
    if (ctx.contractSummaryId) {
      const { data, error } = await (supabase as any)
        .from("contract_summaries")
        .select("id, status")
        .eq("id", ctx.contractSummaryId)
        .maybeSingle();
      if (error || !data) return { accepted: false, contractSummaryId: null };
      return { accepted: data.status === "accepted", contractSummaryId: data.id };
    }
    return { accepted: false, contractSummaryId: null };
  } catch {
    return { accepted: false, contractSummaryId: null };
  }
}
