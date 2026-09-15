/**
 * Real "open quote work" counting for the customer dashboard overview.
 *
 * Both inputs come from the auth-scoped, no-argument RPCs
 * `get_customer_quotes()` and `get_customer_quote_requests()`, so the caller
 * never supplies an identity. Counts are derived only from rows the customer
 * actually owns — never fabricated or hard-coded.
 */

export type QuoteCounts = {
  /** Quotes the customer can still act on (sent / viewed / approved). */
  openQuotes: number;
  /** Quote requests still in progress with OCCTA. */
  openRequests: number;
  /** Combined figure shown as "Open quotes" on the overview. */
  total: number;
};

/** Quote statuses that still need customer attention. */
const ACTIONABLE_QUOTE_STATUS = new Set([
  "sent",
  "viewed",
  "approved",
  "contract_summary_generated",
]);

/** Quote-request statuses that are still live work, not finished/dead. */
const CLOSED_REQUEST_STATUS = new Set([
  "converted",
  "rejected",
  "closed",
  "expired",
  "contract_summary_accepted",
]);

export const EMPTY_QUOTE_COUNTS: QuoteCounts = { openQuotes: 0, openRequests: 0, total: 0 };

export function countOpenQuoteWork(
  quotes: Array<{ status?: string | null; customer_intent_proceeded_at?: string | null }> | null | undefined,
  requests: Array<{ status?: string | null }> | null | undefined,
): QuoteCounts {
  const openQuotes = (quotes ?? []).filter(
    (q) => ACTIONABLE_QUOTE_STATUS.has(String(q?.status ?? "")) && !q?.customer_intent_proceeded_at,
  ).length;

  const openRequests = (requests ?? []).filter(
    (r) => !CLOSED_REQUEST_STATUS.has(String(r?.status ?? "")),
  ).length;

  return { openQuotes, openRequests, total: openQuotes + openRequests };
}
