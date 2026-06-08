/**
 * Pay-gate helper (Phase 1 scaffolding for the OCCTA Contract Summary rule).
 *
 * Rule: payment/order for NEW telecom sales requires an accepted Contract Summary
 * in BOTH manual and live modes.
 *
 * Legacy/arrears invoice payments and standalone payment-request links are
 * EXEMPT — those existing flows must keep working untouched.
 *
 * The full Contract Summary table and acceptance flow lands in Phase 2.
 * In Phase 1 this helper:
 *  - identifies whether a checkout context is a "new telecom sale" or "legacy payment"
 *  - exposes hasAcceptedContractSummary() which Phase 2 will wire to DB
 */
export type CheckoutKind =
  | "new_telecom_sale" // Broadband / Voice / Business sales checkout
  | "legacy_invoice" // /pay-invoice with an existing INV-... reference
  | "payment_request" // /pay with PR-... token (admin-generated link)
  | "sim_instant"; // SIM only when sim_checkout_mode === 'instant'

export interface CheckoutContext {
  kind: CheckoutKind;
  reference?: string;
  quoteId?: string;
  cartId?: string;
  invoiceId?: string;
}

export function requiresContractSummary(ctx: CheckoutContext): boolean {
  // Legacy invoices and admin payment requests are EXEMPT.
  if (ctx.kind === "legacy_invoice") return false;
  if (ctx.kind === "payment_request") return false;
  // SIM instant: only when explicitly enabled by admin. No CS required for SIM-only.
  if (ctx.kind === "sim_instant") return false;
  // All new telecom sales require an accepted Contract Summary.
  return true;
}

/**
 * Phase 1 stub. Phase 2 will query the `contract_summaries` table.
 * Returns `null` to mean "no acceptance found" so the gate redirects to the quote/CS flow.
 */
export async function hasAcceptedContractSummary(
  _ctx: CheckoutContext
): Promise<{ accepted: boolean; contractSummaryId: string | null }> {
  return { accepted: false, contractSummaryId: null };
}
