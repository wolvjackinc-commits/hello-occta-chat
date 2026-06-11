/**
 * Phase G0 — Customer-safe journey milestone derivation.
 *
 * IMPORTANT: this module deliberately only consumes the narrow, customer-safe
 * fields below. It MUST NOT receive supplier cost, margin, supplier IDs, admin
 * notes, raw webhook payloads, token hashes, payment_attempts.raw_response,
 * audit_logs internals, or any provider secrets. Keep the input shapes tight.
 */

export type MilestoneKey =
  | "quote_request_received"
  | "quote_in_review"
  | "final_quote_ready"
  | "cs_generated"
  | "cs_accepted"
  | "payment_request_created"
  | "awaiting_payment"
  | "payment_being_confirmed"
  | "payment_received"
  | "preparing_setup"
  | "supplier_order_pending";

export type MilestoneState = "done" | "current" | "upcoming";

export interface Milestone {
  key: MilestoneKey;
  label: string;
  description: string;
  state: MilestoneState;
  at: string | null;
}

export interface JourneySafeInputs {
  quoteRequest?: { status: string; created_at: string } | null;
  quote?: { status: string; created_at: string } | null;
  contractSummary?: { issued_at: string | null } | null;
  contractAccepted?: { accepted_at: string | null } | null;
  paymentRequest?: {
    status: string;
    webhook_verified: boolean | null;
    paid_at: string | null;
    created_at: string;
  } | null;
  readinessStatus?: string | null;
  hasDraftOrderPack?: boolean;
}

const REVIEWING_QR = new Set([
  "in_review",
  "assigned",
  "checking",
  "needs_info",
  "draft_quote_created",
]);
const FINAL_QR = new Set([
  "final_quote_ready",
  "quoted",
  "contract_summary_generated",
  "contract_summary_accepted",
  "converted",
]);
const FINAL_QUOTE = new Set([
  "sent",
  "viewed",
  "approved",
  "accepted",
  "contract_summary_generated",
  "contract_summary_accepted",
  "converted",
]);

export function deriveMilestones(input: JourneySafeInputs): Milestone[] {
  const qr = input.quoteRequest;
  const q = input.quote;
  const cs = input.contractSummary;
  const ca = input.contractAccepted;
  const pr = input.paymentRequest;

  const qrInReview = !!qr && REVIEWING_QR.has(qr.status);
  const qrFinal = !!qr && FINAL_QR.has(qr.status);
  const finalQuoteReady = (!!q && FINAL_QUOTE.has(q.status)) || qrFinal;
  const csIssued = !!cs?.issued_at;
  const csAccepted = !!ca?.accepted_at;
  const prCreated = !!pr;
  const awaiting = !!pr && (pr.status === "draft" || pr.status === "pending");
  const confirming =
    !!pr && pr.status === "checkout_created" && pr.webhook_verified !== true;
  const paid =
    !!pr && pr.status === "paid" && pr.webhook_verified === true && !!pr.paid_at;
  const preparing = input.readinessStatus === "admin_review_complete";
  const supplierPending = !!input.hasDraftOrderPack;

  const rows: Array<Omit<Milestone, "state"> & { done: boolean }> = [
    {
      key: "quote_request_received",
      label: "Quote request received",
      description: "We've received your enquiry.",
      at: qr?.created_at ?? null,
      done: !!qr,
    },
    {
      key: "quote_in_review",
      label: "Quote being reviewed",
      description: "A real person is checking the details.",
      at: qrInReview ? qr?.created_at ?? null : null,
      done: qrInReview || finalQuoteReady,
    },
    {
      key: "final_quote_ready",
      label: "Final quote ready",
      description: "Your final quote is ready to review.",
      at: finalQuoteReady ? q?.created_at ?? null : null,
      done: finalQuoteReady,
    },
    {
      key: "cs_generated",
      label: "Contract Summary generated",
      description: "Your Contract Summary is ready.",
      at: cs?.issued_at ?? null,
      done: csIssued,
    },
    {
      key: "cs_accepted",
      label: "Contract Summary accepted",
      description: "Thanks for accepting your Contract Summary.",
      at: ca?.accepted_at ?? null,
      done: csAccepted,
    },
    {
      key: "payment_request_created",
      label: "Payment request created",
      description: "Your secure payment link has been generated.",
      at: pr?.created_at ?? null,
      done: prCreated,
    },
    {
      key: "awaiting_payment",
      label: "Awaiting payment",
      description: "Waiting for your one-off setup payment.",
      at: awaiting ? pr?.created_at ?? null : null,
      done: awaiting || confirming || paid,
    },
    {
      key: "payment_being_confirmed",
      label: "Payment being confirmed",
      description:
        "We've received the payment and we're waiting for the bank to confirm it. No action needed.",
      at: confirming ? pr?.created_at ?? null : null,
      done: confirming || paid,
    },
    {
      key: "payment_received",
      label: "Payment received",
      description: "Payment fully confirmed.",
      at: paid ? pr?.paid_at ?? null : null,
      done: paid,
    },
    {
      key: "preparing_setup",
      label: "Preparing your setup",
      description: "Our team is preparing your order.",
      at: null,
      done: preparing,
    },
    {
      key: "supplier_order_pending",
      label: "Supplier order pending",
      description: "Order pack prepared — supplier order not yet submitted.",
      at: null,
      done: supplierPending,
    },
  ];

  // Determine current = first not-done after the last done.
  let firstUpcomingMarked = false;
  return rows.map<Milestone>((r) => {
    if (r.done) return { ...r, state: "done" };
    if (!firstUpcomingMarked) {
      firstUpcomingMarked = true;
      return { ...r, state: "current" };
    }
    return { ...r, state: "upcoming" };
  });
}

export function nextStepCopy(milestones: Milestone[]): string {
  const current = milestones.find((m) => m.state === "current");
  if (!current) return "Everything is up to date.";
  switch (current.key) {
    case "quote_request_received":
      return "Next: start a quote request and we'll take it from there.";
    case "quote_in_review":
      return "Next: a member of our team will review your request and come back with a quote.";
    case "final_quote_ready":
      return "Next: we'll send your final quote shortly.";
    case "cs_generated":
      return "Next: we'll prepare your Contract Summary for you to review.";
    case "cs_accepted":
      return "Next: please review and accept your Contract Summary when ready — no rush.";
    case "payment_request_created":
      return "Next: we'll send your secure payment link.";
    case "awaiting_payment":
      return "Next: complete your one-off setup payment using the secure link we sent.";
    case "payment_being_confirmed":
      return "Next: we're just waiting on the bank to confirm your payment. No action needed.";
    case "payment_received":
      return "Next: we'll confirm payment and start preparing your setup.";
    case "preparing_setup":
      return "Next: our team will prepare your setup and be in touch.";
    case "supplier_order_pending":
      return "Next: we'll submit your supplier order once final checks are complete.";
    default:
      return "We'll keep you posted at every step.";
  }
}