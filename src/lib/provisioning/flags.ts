/**
 * Phase F0 — Post-Payment Readiness Pack (preparation only).
 *
 * Supplier submission, service activation, provisioning, invoice and DD writes
 * remain locked. Payment verification is live via Worldpay SMB webhook.
 * Any code attempting to bypass this MUST assert this flag and throw.
 */
export const SUPPLIER_SUBMISSION_ENABLED = false as const;

export function assertSupplierSubmissionEnabled(): never | void {
  if (!SUPPLIER_SUBMISSION_ENABLED) {
    throw new Error(
      "Supplier order is locked. Payment verification is live; supplier automation remains disabled. Use manual fulfilment.",
    );
  }
}