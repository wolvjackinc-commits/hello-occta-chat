/**
 * Journey 2 — the single canonical contractual snapshot.
 *
 * There is exactly ONE snapshot builder and ONE fingerprint function in the
 * whole system. Contract preparation stores the snapshot together with its
 * fingerprint; acceptance and final submission rebuild the canonical form from
 * the stored snapshot and compare the recomputed SHA-256 byte-for-byte with the
 * stored fingerprint. Every contractual document renders from this snapshot, so
 * the figures a customer signs are the figures that are committed and billed.
 */

/** Deterministic JSON: object keys sorted recursively, arrays order-preserving. */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object") {
      const src = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(src).sort()) out[k] = walk(src[k]);
      return out;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error("snapshot_non_finite_number");
      // Money is always stored to 2dp so the canonical form is stable.
      return Number.isInteger(v) ? v : Number(v.toFixed(6));
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

/** The one and only snapshot fingerprint function. */
export async function snapshotFingerprint(snapshot: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(snapshot));
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

export type Journey2Snapshot = {
  snapshot_version: string;
  journey_version: "v2";
  test_session: boolean;
  checkout_session_id: string;
  pricing_version: string;
  created_at: string;
  customer: {
    full_name: string; email: string; phone: string; date_of_birth: string | null;
    accessibility_needs: string | null; vulnerability_support_needs: string | null;
    marketing_consent: boolean;
  };
  service_address: Record<string, string | null>;
  billing_address: Record<string, string | null> | "same_as_service_address";
  switching: {
    current_provider: string | null; current_contract_status: string | null;
    current_contract_end_date: string | null; number_action: string; number_to_port: string | null;
  };
  product: {
    plan_name: string; speed_bucket: string; contract_term: string;
    minimum_term_months: number; setup: { option: string; label: string; one_off_incl_vat: number };
    estimated_download_mbps: number; estimated_upload_mbps: number; speed_statement: string;
  };
  router: Record<string, unknown>;
  addons: { id: string; label: string; monthly: number }[];
  digital_voice: { selected: boolean; power_cut_acknowledged: boolean; information: string | null };
  pricing: {
    monthly_ex_vat: number; monthly_vat: number; monthly_incl_vat: number;
    one_off_charges_incl_vat: number; amount_due_today: number;
    estimated_first_bill_incl_vat: number; vat_rate_percent: number;
    one_off_charged_on_first_bill: boolean;
  };
  schedule: {
    preferred_start_date: string; billing_day: number;
    expected_first_collection_rule: string; billing_commencement_rule: string;
  };
  cooling_off: { days: number; acknowledged: boolean; statement: string };
  direct_debit: {
    account_holder_name: string; bank_name: string; last4: string; sort_last2: string;
    guarantee_provided: boolean; advance_notice_days: number;
  };
  legal_document_versions: Record<string, string>;
};

const DIGITAL_VOICE_NOTICE =
  "Digital Voice works over your broadband and mains power. In a power cut or broadband outage it will not " +
  "work, including for 999 calls. If anyone at the property relies on the phone line for emergencies, tell us " +
  "and we will arrange a suitable alternative at no charge.";

const FIRST_COLLECTION_RULE =
  "Nothing is payable today. Your first Direct Debit is collected on your chosen billing day once your service " +
  "is live and your mandate is active, and never sooner than 3 working days after we send your advance notice. " +
  "One-off charges appear on your first bill, not today.";

const BILLING_COMMENCEMENT_RULE =
  "Billing starts when your service goes live. Your monthly charge is collected on your chosen billing day each month.";

const COOLING_OFF_STATEMENT =
  "You have a 14-day cooling-off period from the day you accept this agreement. Cancel within that period and " +
  "you pay nothing for the service, though you must return any equipment we supplied.";

export const COOLING_OFF_DAYS = 14;
export const SNAPSHOT_VERSION = "journey2-snapshot-v2";

/** Estimated line speeds per speed bucket — estimates, never guarantees. */
export const SNAPSHOT_SPEED_ESTIMATES: Record<string, { download: number; upload: number }> = {
  essential: { download: 80, upload: 20 },
  superfast: { download: 330, upload: 50 },
  ultrafast: { download: 550, upload: 75 },
  gigabit: { download: 1000, upload: 115 },
};

/**
 * Estimated line speeds for a speed bucket. Used as the single fallback wherever
 * a stored snapshot or quote predates the speed fields, so the Contract Summary
 * always states an estimated speed instead of an em dash.
 */
export function speedEstimatesFor(bucket: string | null | undefined): { download: number; upload: number } | null {
  if (!bucket) return null;
  return SNAPSHOT_SPEED_ESTIMATES[String(bucket)] ?? null;
}

/** Customer-facing speed statement for a bucket. */
export function speedStatementFor(bucket: string | null | undefined): string | null {
  const est = speedEstimatesFor(bucket);
  if (!est) return null;
  return `Estimated download up to ${est.download} Mbps and estimated upload up to ${est.upload} Mbps. ` +
    `Speeds are estimates for your line and are not guaranteed.`;
}

export type SnapshotInput = {
  session: Record<string, any>;
  priced: any;
  vatPercent: number;
  pricingVersion: string;
  planName: string;
  legalVersions: Record<string, string>;
  createdAt?: string;
};

const round2 = (n: number) => Math.round(Number(n) * 100) / 100;

/** Builds the canonical snapshot. Used by BOTH the live and the test path. */
export function buildJourney2Snapshot(input: SnapshotInput): Journey2Snapshot {
  const { session, priced, vatPercent, pricingVersion, planName, legalVersions } = input;
  const d = (session.customer_details ?? {}) as Record<string, any>;
  const a = (session.service_address ?? {}) as Record<string, any>;
  const addons = ((priced.addons ?? []) as any[]).map((x) => ({
    id: String(x.id), label: String(x.label), monthly: round2(x.monthly ?? 0),
  })).sort((x, y) => x.id.localeCompare(y.id));

  const monthlyEx = round2(
    priced.internal.monthly_broadband_ex_vat + priced.internal.router_monthly_ex_vat +
    priced.internal.addons_monthly_ex_vat,
  );
  const monthlyIncl = round2(priced.monthly_total_incl_vat);
  const oneOff = round2(priced.router.oneOff + priced.setup.oneOff);
  const dvSelected = ((session.selected_addons ?? []) as string[]).includes("digital_voice");
  const mask = (session.dd_masked ?? {}) as Record<string, any>;

  return {
    snapshot_version: SNAPSHOT_VERSION,
    journey_version: "v2",
    test_session: !!session.test_session,
    checkout_session_id: String(session.checkout_session_id),
    pricing_version: pricingVersion,
    created_at: input.createdAt ?? new Date().toISOString(),
    customer: {
      full_name: String(d.full_name ?? ""),
      email: String(d.email ?? ""),
      phone: String(d.phone ?? ""),
      date_of_birth: d.date_of_birth ?? null,
      accessibility_needs: d.accessibility_needs ?? null,
      vulnerability_support_needs: d.vulnerability_support_needs ?? null,
      marketing_consent: !!d.marketing_consent,
    },
    service_address: {
      address_line_1: a.address_line_1 ?? null,
      address_line_2: a.address_line_2 ?? null,
      town: a.town ?? null,
      county: a.county ?? null,
      postcode: String(session.postcode ?? "").toUpperCase(),
    },
    billing_address: d.billing_address_same === false && d.billing_address
      ? {
          address_line_1: d.billing_address.address_line_1 ?? null,
          address_line_2: d.billing_address.address_line_2 ?? null,
          town: d.billing_address.town ?? null,
          county: d.billing_address.county ?? null,
          postcode: String(d.billing_address.postcode ?? "").toUpperCase(),
        }
      : "same_as_service_address",
    switching: {
      current_provider: d.current_provider ?? null,
      current_contract_status: d.current_contract_status ?? null,
      current_contract_end_date: d.current_contract_end_date ?? null,
      number_action: String(d.number_action ?? "none"),
      number_to_port: d.number_to_port ?? null,
    },
    product: {
      plan_name: planName,
      speed_bucket: String(session.speed_bucket),
      contract_term: String(session.plan_term),
      minimum_term_months: session.plan_term === "price_lock_24" ? 24 : 1,
      estimated_download_mbps: SNAPSHOT_SPEED_ESTIMATES[String(session.speed_bucket)]?.download ?? 0,
      estimated_upload_mbps: SNAPSHOT_SPEED_ESTIMATES[String(session.speed_bucket)]?.upload ?? 0,
      speed_statement:
        `Estimated download up to ${SNAPSHOT_SPEED_ESTIMATES[String(session.speed_bucket)]?.download ?? 0} Mbps and ` +
        `estimated upload up to ${SNAPSHOT_SPEED_ESTIMATES[String(session.speed_bucket)]?.upload ?? 0} Mbps. ` +
        `Speeds are estimates for your line and are not guaranteed.`,
      setup: {
        option: String(priced.setup.option),
        label: String(priced.setup.label),
        one_off_incl_vat: round2(priced.setup.oneOff),
      },
    },
    router: {
      option: String(priced.router.option),
      label: String(priced.router.label),
      payment_type: String(priced.router.payment_type),
      monthly: round2(priced.router.monthly),
      one_off: round2(priced.router.oneOff),
    },
    addons,
    digital_voice: {
      selected: dvSelected,
      power_cut_acknowledged: dvSelected ? !!session.digital_voice_acknowledged : false,
      information: dvSelected ? DIGITAL_VOICE_NOTICE : null,
    },
    pricing: {
      monthly_ex_vat: monthlyEx,
      monthly_vat: round2(monthlyIncl - monthlyEx),
      monthly_incl_vat: monthlyIncl,
      one_off_charges_incl_vat: oneOff,
      amount_due_today: 0,
      estimated_first_bill_incl_vat: round2(monthlyIncl + oneOff),
      vat_rate_percent: round2(vatPercent),
      one_off_charged_on_first_bill: true,
    },
    schedule: {
      preferred_start_date: String(session.preferred_start_date),
      billing_day: Number(session.billing_anchor_day),
      expected_first_collection_rule: FIRST_COLLECTION_RULE,
      billing_commencement_rule: BILLING_COMMENCEMENT_RULE,
    },
    cooling_off: {
      days: COOLING_OFF_DAYS,
      acknowledged: !!session.cooling_off_acknowledged,
      statement: COOLING_OFF_STATEMENT,
    },
    direct_debit: {
      account_holder_name: String(mask.account_holder_name ?? ""),
      bank_name: String(mask.bank_name ?? ""),
      last4: String(mask.last4 ?? ""),
      sort_last2: String(mask.sort_last2 ?? ""),
      guarantee_provided: true,
      advance_notice_days: 3,
    },
    legal_document_versions: legalVersions ?? {},
  };
}

/**
 * Rebuilds the fingerprint from a STORED snapshot and compares it byte-for-byte
 * with the stored value. Never checks only the length.
 */
export async function verifyStoredSnapshot(
  snapshot: unknown,
  storedFingerprint: unknown,
): Promise<{ ok: boolean; recomputed: string; reason?: string }> {
  if (typeof storedFingerprint !== "string" || !/^[0-9a-f]{64}$/i.test(storedFingerprint)) {
    return { ok: false, recomputed: "", reason: "stored_fingerprint_invalid" };
  }
  if (!snapshot || typeof snapshot !== "object") {
    return { ok: false, recomputed: "", reason: "snapshot_missing" };
  }
  let recomputed: string;
  try {
    recomputed = await snapshotFingerprint(snapshot);
  } catch (e) {
    return { ok: false, recomputed: "", reason: `recompute_failed:${(e as Error).message}` };
  }
  if (recomputed.toLowerCase() !== storedFingerprint.toLowerCase()) {
    return { ok: false, recomputed, reason: "fingerprint_mismatch" };
  }
  return { ok: true, recomputed };
}

/** Contractual fields that must never drift between acceptance and commit. */
export function snapshotMatchesSession(
  snapshot: Journey2Snapshot,
  session: Record<string, any>,
): { ok: boolean; field?: string } {
  const checks: [string, unknown, unknown][] = [
    ["preferred_start_date", snapshot.schedule?.preferred_start_date, session.preferred_start_date],
    ["billing_day", Number(snapshot.schedule?.billing_day), Number(session.billing_anchor_day)],
    ["speed_bucket", snapshot.product?.speed_bucket, session.speed_bucket],
    ["contract_term", snapshot.product?.contract_term, session.plan_term],
    ["dd_last4", snapshot.direct_debit?.last4, (session.dd_masked ?? {}).last4],
    ["dd_sort_last2", snapshot.direct_debit?.sort_last2, (session.dd_masked ?? {}).sort_last2],
    ["email", snapshot.customer?.email, (session.customer_details ?? {}).email],
  ];
  for (const [field, a, b] of checks) {
    if (String(a ?? "") !== String(b ?? "")) return { ok: false, field };
  }
  if (Number(snapshot.pricing?.amount_due_today ?? 1) !== 0) return { ok: false, field: "amount_due_today" };
  return { ok: true };
}
