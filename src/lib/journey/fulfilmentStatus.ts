/**
 * Customer-safe mapping for manual fulfilment status.
 * NEVER renders supplier name, portal reference, product IDs, admin notes,
 * or raw internal status names.
 */
export type CustomerFulfilmentStage =
  | "payment_pending"
  | "payment_confirming"
  | "payment_received"
  | "preparing_setup"
  | "installation_arranged"
  | "activation_in_progress"
  | "service_active"
  | "cancelled";

const STAGE_LABEL: Record<CustomerFulfilmentStage, string> = {
  payment_pending: "Payment pending",
  payment_confirming: "Payment being confirmed",
  payment_received: "Payment received",
  preparing_setup: "Preparing your setup",
  installation_arranged: "Installation being arranged",
  activation_in_progress: "Service activation in progress",
  service_active: "Service active",
  cancelled: "Order cancelled — contact support",
};

const STAGE_HINT: Record<CustomerFulfilmentStage, string> = {
  payment_pending: "Use your secure payment link to complete your one-off setup payment.",
  payment_confirming: "We've received your payment and we're waiting on the bank to confirm it. No action needed.",
  payment_received: "Your setup is being prepared. Our team will contact you with the next steps.",
  preparing_setup: "Our team is preparing your order and will be in touch about installation.",
  installation_arranged: "We'll be in touch to confirm your installation slot.",
  activation_in_progress: "Your service is being activated. Final checks are underway.",
  service_active: "Your service is live. Enjoy!",
  cancelled: "If this is unexpected, please get in touch with OCCTA support.",
};

export function fulfilmentLabel(stage: CustomerFulfilmentStage) {
  return STAGE_LABEL[stage];
}

export function fulfilmentHint(stage: CustomerFulfilmentStage) {
  return STAGE_HINT[stage];
}

/**
 * Derive a customer-safe stage from the payment_requests snapshot alone.
 * Fulfilment tracker table is admin-only — we deliberately do not read it
 * from the customer dashboard. Once a downstream customer-safe view exists,
 * a FulfilmentTracker component can refine "preparing_setup" further.
 */
export function deriveStageFromPayment(input: {
  status?: string | null;
  webhook_verified?: boolean | null;
  paid_at?: string | null;
}): CustomerFulfilmentStage | null {
  if (!input || !input.status) return null;
  const s = input.status;
  if (s === "paid" && input.webhook_verified === true && input.paid_at) {
    return "payment_received";
  }
  if (s === "checkout_created") return "payment_confirming";
  if (s === "draft" || s === "pending") return "payment_pending";
  if (s === "cancelled" || s === "failed") return "cancelled";
  return null;
}