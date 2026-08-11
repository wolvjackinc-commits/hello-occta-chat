// Notice period resolution for Contract Summary issuance.
//
// The customer's notice period is NEVER invented. It is taken, in order, from
// an explicit two-doc snapshot override, the quote's stored notice_period text,
// or the governed default for a Build Plan term (Flex 30 / Price Lock 24 are
// both 30 days). Anything legacy that cannot be resolved returns null so the
// caller can fail safely into manual review instead of assuming 30.

export interface NoticeQuoteLike {
  notice_period?: string | null;
  plan_term?: string | null;
  plan_type?: string | null;
  final_snapshot?: unknown;
}

export interface NoticeResolution {
  days: number;
  text: string;
  source: "snapshot_override" | "quote_text" | "governed_term_default";
}

function overrideDays(q: NoticeQuoteLike): number | null {
  const fs = q.final_snapshot as any;
  const v = fs?.two_doc?.broadband?.notice_period_days;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 365 ? Math.round(v) : null;
}

/** Parses stored free text. Returns null when the text is not unambiguous. */
export function parseNoticeText(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (/^(none|no notice|not applicable|n\/a)$/.test(s)) return 0;
  const days = s.match(/^(\d{1,3})\s*(calendar\s*)?days?$/);
  if (days) return parseInt(days[1], 10);
  const months = s.match(/^(\d{1,2})\s*(calendar\s*)?months?$/);
  if (months) return parseInt(months[1], 10) * 30;
  return null;
}

export function noticeText(days: number): string {
  if (days === 0) return "No notice period";
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Resolves the exact notice period for a quote.
 * Returns null when legacy/ambiguous data means it must go to manual review.
 */
export function resolveNoticePeriod(q: NoticeQuoteLike): NoticeResolution | null {
  const ov = overrideDays(q);
  if (ov != null) return { days: ov, text: noticeText(ov), source: "snapshot_override" };

  const parsed = parseNoticeText(q.notice_period);
  if (parsed != null) return { days: parsed, text: noticeText(parsed), source: "quote_text" };

  // Governed Build Plan terms carry a 30-day notice by contract design.
  if (q.notice_period == null || String(q.notice_period).trim() === "") {
    if (q.plan_term === "flex_30" || q.plan_term === "price_lock_24") {
      return { days: 30, text: noticeText(30), source: "governed_term_default" };
    }
  }

  // Legacy quote with unresolved or unparseable notice data — fail safely.
  return null;
}