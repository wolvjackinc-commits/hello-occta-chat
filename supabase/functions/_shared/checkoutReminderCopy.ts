/**
 * Pure helpers for the abandoned-checkout reminder emails
 * (journey2-resume-email). No imports, so the copy is unit-testable.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export const REMINDER_PHONE_LINE =
  `<p>Prefer to talk it through? Call us free on <strong>0800 260 6626</strong> and we can finish your order with you over the phone.</p>`;

/** What the customer had chosen, so the email is about their order rather than a generic one. */
export function reminderOrderSummary(o: {
  planLabel?: string | null; planTerm?: string | null; monthlyInclVat?: number | null; postcode?: string | null;
}): string {
  const lines: string[] = [];
  const term = o.planTerm === "price_lock_24" ? "Price Lock 24" : o.planTerm === "flex_30" ? "Flex 30" : null;
  if (o.planLabel || term) lines.push(esc([o.planLabel, term].filter(Boolean).join(" · ")));
  const monthly = Number(o.monthlyInclVat);
  if (o.planLabel && Number.isFinite(monthly) && monthly > 0) {
    lines.push(`£${monthly.toFixed(2)} a month including VAT, as shown when you saved it`);
  }
  const postcode = o.postcode?.trim();
  if (postcode) lines.push(`Installation postcode: ${esc(postcode.toUpperCase())}`);
  if (!lines.length) return "";
  return `<p style="border:2px solid #111;padding:12px"><strong>Your saved order</strong><br>${lines.join("<br>")}</p>`;
}

/** The provider rejected the message itself (bad address etc.): retrying cannot help. 429 is rate limiting, so it is retried. */
export function isPermanentSendFailure(error: unknown): boolean {
  return /^resend_4(?!29)\d\d\b/.test(String(error ?? ""));
}
