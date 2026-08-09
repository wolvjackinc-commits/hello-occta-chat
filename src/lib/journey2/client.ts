/**
 * Customer Journey 2.0 — browser client.
 *
 * All pricing, validation and state transitions happen server-side. This
 * module only carries selections to the edge functions and back.
 */
import { supabase } from "@/integrations/supabase/client";

export type SpeedBucket = "essential" | "superfast" | "ultrafast" | "gigabit";
export type PlanTerm = "price_lock_24" | "flex_30";
export type RouterOption = "own" | "standard" | "premium" | "business";
export type RouterPayType = "none" | "one_off" | "monthly";
export type AddonId = "priority_support" | "static_ip" | "digital_voice" | "paper_billing";

export type CatalogueTerm = { monthly_incl_vat: number; monthly_ex_vat: number; vat_amount: number };

/**
 * Estimated line speeds per speed bucket. Mirrors the server catalogue so the
 * same estimates appear in the journey, the order summary and the contract.
 * Estimates only — never presented as guaranteed speeds.
 */
export const SPEED_ESTIMATES: Record<SpeedBucket, { download: number; upload: number }> = {
  essential: { download: 80, upload: 20 },
  superfast: { download: 330, upload: 50 },
  ultrafast: { download: 550, upload: 75 },
  gigabit: { download: 1000, upload: 115 },
};

export type Catalogue = {
  pricing_version: string;
  customer_type: "residential" | "business";
  setup: { option: string; label: string; one_off: number } | null;
  plans: {
    speed_bucket: SpeedBucket;
    label: string;
    estimated_download_mbps?: number;
    estimated_upload_mbps?: number;
    terms: Partial<Record<PlanTerm, CatalogueTerm>>;
  }[];
  routers: { key: string; option: RouterOption; payment_type: RouterPayType; label: string; monthly: number; one_off: number }[];
  extras: { id: AddonId; label: string; monthly: number }[];
};

export type PriceSnapshot = {
  monthly_total_incl_vat: number;
  monthly_total_ex_vat: number;
  vat_amount: number;
  one_off_total_incl_vat?: number;
  plan_term: PlanTerm;
  speed_bucket: SpeedBucket;
  plan_label?: string;
  router?: { label: string; monthly: number; oneOff: number; option: RouterOption; payment_type: RouterPayType };
  setup?: { label: string; oneOff: number; option: string };
  addons?: { id: AddonId; label: string; monthly: number }[];
  minimum_term_months?: number;
};

export type Journey2Session = {
  id: string;
  journey_version: "v1" | "v2";
  status: string;
  current_step: string;
  last_completed_step: string | null;
  test_session: boolean;
  postcode: string | null;
  service_address: { postcode: string; address_line_1: string; address_line_2?: string | null; town: string; county?: string | null } | null;
  speed_bucket: SpeedBucket | null;
  plan_term: PlanTerm | null;
  router_option: { router_option: RouterOption; router_payment_type: RouterPayType } | null;
  selected_addons: AddonId[] | null;
  customer_details: {
    full_name: string; email: string; phone: string;
    date_of_birth?: string | null; current_provider?: string | null; marketing_consent?: boolean;
    billing_address_same?: boolean;
    billing_address?: { address_line_1: string; address_line_2?: string | null; town: string; county?: string | null; postcode: string } | null;
    current_contract_status?: "out_of_contract" | "in_contract" | "unknown" | "new_line";
    current_contract_end_date?: string | null;
    number_action?: "none" | "keep_existing" | "port_in" | "new_number";
    number_to_port?: string | null;
    accessibility_needs?: string | null;
    vulnerability_support_needs?: string | null;
  } | null;
  price_snapshot: PriceSnapshot | null;
  preferred_start_date: string | null;
  cooling_off_acknowledged: boolean | null;
  billing_anchor_day: number | null;
  dd_masked: { last4: string; sort_last2: string; bank_name: string; account_holder_name: string; status: string } | null;
  digital_voice_acknowledged: boolean | null;
  checkout_session_id: string | null;
  quote_id: string | null;
  order_id: string | null;
  expires_at: string;
  completed_at: string | null;
};

const ANON_KEY = "occta_j2_anon_id";

export function getAnonymousSessionId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

function readUtm(): Record<string, string> | undefined {
  try {
    const p = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"]) {
      const v = p.get(k);
      if (v) out[k] = v.slice(0, 300);
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error && !data) {
    // Non-2xx responses arrive as an error with the JSON body on the attached
    // Response. Surfacing that body means the customer sees the real, actionable
    // reason instead of a generic "we couldn't reach our ordering service".
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const parsed = await ctx.json().catch(() => null);
      if (parsed && typeof parsed === "object") return parsed as T;
    }
    throw new Error(error.message ?? "network_error");
  }
  return data as T;
}

export type StartResult = {
  ok: boolean;
  journey_version: "v1" | "v2" | null;
  token?: string;
  redirect?: string;
  unavailable?: boolean;
  message?: string;
  resumed?: boolean;
  session?: Journey2Session;
  error?: string;
};

export const journey2 = {
  start: (opts: { adminTest?: boolean } = {}) =>
    call<StartResult>("journey2-session", {
      action: "start",
      anonymous_session_id: getAnonymousSessionId(),
      admin_test: opts.adminTest || undefined,
      utm: readUtm(),
    }),

  get: (token: string) =>
    call<{ ok: boolean; session: Journey2Session; quote_token_available: boolean; v2_test_mode: boolean; error?: string }>(
      "journey2-session", { action: "get", token },
    ),

  saveStep: (
    token: string,
    step: "address" | "plan" | "router" | "extras" | "details" | "start_date" | "billing",
    payload: Record<string, unknown>,
  ) =>
    call<{ ok: boolean; session?: Journey2Session; error?: string; message?: string; redirect?: string; details?: unknown }>(
      "journey2-session", { action: "save_step", token, step, payload },
    ),

  cancel: (token: string) => call<{ ok: boolean }>("journey2-session", { action: "cancel", token }),

  catalogue: (customer_type: "residential" | "business" = "residential") =>
    call<{ ok: boolean; catalogue: Catalogue; error?: string }>("journey2-catalogue", { customer_type }),

  prepareContract: (token: string) =>
    call<{ ok: boolean; quote_token?: string; contract_ready?: boolean; contract_error?: string; error?: string; message?: string }>(
      "journey2-prepare-contract", { token },
    ),

  /**
   * Replays the already captured start date and Direct Debit into the shared
   * production services once the contract has been accepted.
   */
  applyPostContract: (token: string, quote_token: string) =>
    call<{ ok: boolean; applied?: boolean; retryable?: boolean; failures?: { step: string; error: string }[]; error?: string; message?: string }>(
      "journey2-apply-postcontract", { token, quote_token },
    ),

  finalise: (token: string) =>
    call<{ ok: boolean; submitted: boolean; order_number?: string | null; preferred_start_date?: string | null; error?: string }>(
      "journey2-finalise", { token },
    ),

  /**
   * Transactional final submission. Success is only returned once the server
   * has committed the order, its links and the welcome-pack outbox record.
   */
  submit: (token: string) =>
    call<{ ok: boolean; test_session?: boolean; order_id?: string; order_number?: string; error?: string; message?: string; retryable?: boolean }>(
      "journey2-submit", { token, final_consent: true },
    ),

  completion: (token: string) =>
    call<{ ok: boolean; completion?: Journey2Completion; error?: string }>(
      "journey2-completion", { token },
    ),
};

export type Journey2Completion = {
  test_session: boolean;
  order_number: string | null;
  plan_name: string | null;
  contract_term?: string | null;
  minimum_term_months?: number | null;
  estimated_download_mbps?: number | null;
  estimated_upload_mbps?: number | null;
  speed_statement?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  service_address?: string | null;
  addons?: { id: string; label: string; monthly: number }[];
  router_label?: string | null;
  current_provider?: string | null;
  number_action?: string | null;
  monthly_ex_vat: number;
  monthly_vat: number;
  monthly_incl_vat: number;
  one_off_charges_incl_vat: number;
  amount_due_today: number;
  estimated_first_bill_incl_vat: number;
  vat_rate_percent: number;
  preferred_start_date: string | null;
  billing_anchor_day: number | null;
  dd_masked: { last4: string; sort_last2: string; bank_name: string; account_holder_name: string } | null;
  dd_status: string | null;
  cooling_off_ends_at: string | null;
  documents: { label: string; url: string | null }[];
  digital_voice_selected: boolean;
  snapshot_sha256: string;
};

export const money = (n: number | null | undefined) =>
  `£${Number(n ?? 0).toFixed(2)}`;

export const PLAN_TERM_LABEL: Record<PlanTerm, string> = {
  flex_30: "Flex 30 (rolling monthly)",
  price_lock_24: "Price Lock 24 (fixed 24 months)",
};

/** Journey 2 quote-token handoff is per-browser; keep it out of the URL. */
const QT_KEY = (sessionId: string) => `occta_j2_qt_${sessionId}`;
export const quoteTokenStore = {
  get(sessionId: string): string | null {
    try { return sessionStorage.getItem(QT_KEY(sessionId)); } catch { return null; }
  },
  set(sessionId: string, token: string) {
    try { sessionStorage.setItem(QT_KEY(sessionId), token); } catch { /* ignore */ }
  },
  clear(sessionId: string) {
    try { sessionStorage.removeItem(QT_KEY(sessionId)); } catch { /* ignore */ }
  },
};