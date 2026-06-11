export type ReadinessStatus =
  | "awaiting_verified_payment"
  | "payment_verified_ready_for_review"
  | "admin_review_complete"
  | "draft_order_pack_prepared";

export const READINESS_STATUS_LABEL: Record<ReadinessStatus, string> = {
  awaiting_verified_payment: "Awaiting verified payment",
  payment_verified_ready_for_review: "Payment verified — ready for admin review",
  admin_review_complete: "Admin review complete",
  draft_order_pack_prepared: "Draft order pack prepared",
};

export const SUPPLIER_LOCK_TAG = "Supplier order not yet submitted";