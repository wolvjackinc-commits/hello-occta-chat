// Contract readiness for admin-built (non Build Plan) consumer broadband quotes.
//
// Admin quotes have no Journey 2 session, so nothing ever produced the server
// speed basis or the likely service date the 2026.10.1 contract gates require.
// This module fills ONLY what can be derived legitimately:
//  - an OCCTA plan estimate, when the quote's stored speeds are exactly one of
//    OCCTA's published plan caps (deterministic, clearly labelled, never
//    "verified" and never address-specific);
//  - a likely service date the CUSTOMER selects (provisional target date).
// Anything else is reported as a specific blocker instead of being invented.
import { PLAN_CAPS, buildContractSpeedMatrix, buildPlanEstimateEvidence, evidenceSha256, type SpeedBucket } from "./networkEvidence.ts";
import { canonicalJson } from "./journey2Snapshot.ts";
import { resolveNoticePeriod } from "./noticePeriod.ts";

/** Statutory benchmark caps (v2026.10.1): actual qualifying cost, never more. */
export const NETWORK_CEASE_CAP_WITHIN_12M_INCL_VAT = 114;
export const NETWORK_CEASE_CAP_AFTER_12M_INCL_VAT = 60;

export function isManualConsumerBroadband(q: any): boolean {
  return q?.customer_type !== "business" && q?.service_type === "broadband" && !(q?.speed_bucket && q?.plan_term);
}

/** Bucket only when stored speeds equal a published OCCTA plan cap exactly. */
export function derivePlanEstimateBucket(down: unknown, up: unknown): SpeedBucket | null {
  const d = Number(down), u = Number(up);
  if (!(d > 0) || !(u > 0)) return null;
  for (const [b, cap] of Object.entries(PLAN_CAPS)) {
    if (cap.download === d && cap.upload === u) return b as SpeedBucket;
  }
  return null;
}

/** Rolling manual consumer quotes can use the benchmark capped cease wording. */
export function manualExitBasis(q: any): "fixed_fee" | "benchmark_capped_flex" | null {
  if (q?.cease_fee_gross != null) return "fixed_fee";
  const fixed = q?.plan_type !== "flex" && Number(q?.contract_length_months ?? 0) > 0;
  if (q?.customer_type !== "business" && q?.plan_type === "flex" && !fixed) return "benchmark_capped_flex";
  return null;
}

/**
 * Customer-facing text must not contain template placeholders, and any monthly
 * price written in the notes must equal the quote's headline monthly total.
 * Applies to every quote type: a quote whose words and numbers disagree is not signable.
 */
export function offerConsistencyBlockers(q: any): { code: string; message: string }[] {
  const out: { code: string; message: string }[] = [];
  const text = [q?.customer_notes, q?.notes].filter((t) => typeof t === "string").join("\n");
  if (/\[\s*(insert|add|placeholder|tbc|todo)[^\]]*\]/i.test(text)) {
    out.push({ code: "placeholder_text", message: "Customer notes still contain placeholder text in [brackets]. Remove it before sending." });
  }
  const headline = Number(q?.monthly_gross);
  if (Number.isFinite(headline) && headline > 0) {
    const re = /£\s*(\d{1,4}(?:\.\d{2})?)\s*(?:\/\s*(?:mo|month)|per\s+month|a\s+month|monthly)/gi;
    const mismatched = new Set<string>();
    for (const m of text.matchAll(re)) {
      const v = Number(m[1]);
      if (Math.abs(v - headline) > 0.005) mismatched.add(`£${v.toFixed(2)}`);
    }
    if (mismatched.size) {
      out.push({ code: "monthly_price_mismatch", message: `Notes mention ${[...mismatched].join(", ")} per month but the quote's monthly total is £${headline.toFixed(2)}. Recurring charges (e.g. router rental) must be in the quote's monthly price, not only in the notes.` });
    }
  }
  return out;
}

/**
 * Blockers that staff must resolve before a consumer broadband quote is sent.
 * The likely service date is not a send blocker: the customer picks it.
 */
export function sendReadinessBlockers(q: any): { code: string; message: string }[] {
  const out: { code: string; message: string }[] = [];
  out.push(...offerConsistencyBlockers(q));
  if (q?.customer_type === "business" || q?.service_type !== "broadband") return out;
  if (!resolveNoticePeriod(q)) out.push({ code: "notice_period_unresolved", message: "Set the notice period on the quote." });
  if (!isManualConsumerBroadband(q)) return out;
  const hasBasis = buildContractSpeedMatrix(q.supplier_availability_snapshot, q.speed_bucket).ok;
  if (!hasBasis && !derivePlanEstimateBucket(q.estimated_download_speed, q.estimated_upload_speed)) {
    const caps = Object.values(PLAN_CAPS).map((c) => `${c.download}/${c.upload}`).join(", ");
    out.push({ code: "speed_basis_missing", message: `Estimated speeds must match an OCCTA plan (${caps} Mbps) or have verified network evidence before a contract can be issued.` });
  }
  if (!manualExitBasis(q)) out.push({ code: "termination_charges_unresolved", message: "Fixed-term manual quotes need an approved network cease/migration charge before sending." });
  return out;
}

/** Validate a customer-selected likely service date (YYYY-MM-DD). */
export function validateCustomerServiceDate(v: unknown, now: Date = new Date()): string | null {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = (d.getTime() - today) / 86400000;
  return days >= 1 && days <= 90 ? s : null;
}

/** Build the plan-estimate patch for a manual quote, or null if not derivable. */
export async function planEstimatePatch(q: any, postcode: unknown): Promise<Record<string, unknown> | null> {
  if (buildContractSpeedMatrix(q.supplier_availability_snapshot, q.speed_bucket).ok &&
      /^[0-9a-f]{64}$/i.test(String(q.supplier_availability_sha256 ?? ""))) return null;
  const bucket = derivePlanEstimateBucket(q.estimated_download_speed, q.estimated_upload_speed);
  const est = bucket ? buildPlanEstimateEvidence(bucket, postcode) : null;
  if (!est) return null;
  return { speed_bucket: bucket, supplier_availability_snapshot: est, supplier_availability_sha256: await evidenceSha256(canonicalJson(est)) };
}
