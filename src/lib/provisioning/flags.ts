/**
 * Phase F0 — Post-Payment Readiness Pack (preparation only).
 *
 * Supplier submission, service activation, provisioning, invoice and DD writes
 * remain locked until Phase E (Worldpay live webhook verification) closes.
 * Any code attempting to bypass this MUST assert this flag and throw.
 */
export const SUPPLIER_SUBMISSION_ENABLED = false as const;

export function assertSupplierSubmissionEnabled(): never | void {
  if (!SUPPLIER_SUBMISSION_ENABLED) {
    throw new Error(
      "Supplier order is locked until verified payment is received. Phase E webhook sign-off pending.",
    );
  }
}