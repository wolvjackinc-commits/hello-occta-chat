/**
 * Admin link helpers — Phase 5.
 *
 * Customer 360 is the single canonical customer page. Every admin link
 * routes by ACCOUNT NUMBER (`/admin/customers/OCC########`). Never by
 * profile.id, user_id, customer_id, or any UUID — UUID-based routing is
 * forbidden because it leaks internal identifiers and breaks the
 * "Account reconciliation required" surface.
 *
 * If a record has no account number yet, callers MUST treat it as
 * "Account reconciliation required" rather than fabricating a UUID
 * route.
 */

import { normalizeAccountNumber, isAccountNumberValid } from "./account";

export type CustomerLinkTarget = {
  href: string | null;          // null => reconciliation required
  label: string;                // human label, "Account reconciliation required" when null
  needsReconciliation: boolean;
};

export type CustomerLinkInput = {
  account_number?: string | null;
  /** Only ever used to decide if reconciliation is needed — never put in URL. */
  customer_id?: string | null;
  user_id?: string | null;
  id?: string | null;
};

export function customerDetailHref(
  input: CustomerLinkInput | null | undefined,
  suffix: "" | "/journey" = "",
): CustomerLinkTarget {
  const raw = input?.account_number ?? null;
  const normalised = raw ? normalizeAccountNumber(raw) : "";
  if (isAccountNumberValid(normalised)) {
    return {
      href: `/admin/customers/${normalised}${suffix}`,
      label: normalised,
      needsReconciliation: false,
    };
  }
  return {
    href: null,
    label: "Account reconciliation required",
    needsReconciliation: true,
  };
}

/**
 * Convenience: returns either a safe `/admin/customers/...` href, or a
 * sentinel path that opens the reconciliation tasks queue.
 */
export function customerDetailHrefOrReconciliation(
  input: CustomerLinkInput | null | undefined,
): string {
  const t = customerDetailHref(input);
  return t.href ?? "/admin/tasks?filter=reconciliation";
}