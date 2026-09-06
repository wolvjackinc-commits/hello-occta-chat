import { getConsent } from "@/lib/consent";
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

export type CampaignPromotion = {
  code: string;
  title: string;
  eligible: boolean;
  eligibility_reason: string;
  reward_type: string;
  reward_amount: number;
  reward_currency: string;
  payout_delay_days: number;
  require_first_paid_invoice: boolean;
  one_per_address: boolean;
  starts_at: string;
  ends_at: string;
  terms_version: string;
  terms_text: string;
  landing_path: string;
  monthly_price_reduced: false;
  payout_rule: string;
};

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
  campaign_code?: string | null;
  campaign_snapshot?: CampaignPromotion | null;
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
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid", "ttclid", "offer"]) {
      if (["gclid", "fbclid", "msclkid", "ttclid"].includes(k) && getConsent() !== "granted") continue;
      const v = p.get(k);
      if (v) out[k] = v.slice(0, 300);
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

function readOfferCode(): string | null {
  try {
    const p = new URLSearchParams(window.location.search);
    const direct = p.get("offer")?.trim().toUpperCase();
    if (direct) return direct.slice(0, 40);
    const campaign = p.get("utm_campaign")?.trim().toUpperCase();
    return campaign === "SWITCH50" ? campaign : null;
  } catch {
    return null;
  }
}

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error && !data) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const parsed = await ctx.json().catch(() => null);
      if (parsed && typeof parsed === "object") return parsed as T;
    }
    throw new Error(error.message ?? "network_error");
  }
  return data as T;
}

async function refreshCampaign(token: string, offerCode?: string | null) {
  return call<{ ok: boolean; campaign_code?: string | null; promotion?: CampaignPromotion | null }>(
    "switch50-session",
    { token, offer_code: offerCode ?? undefined },
  ).catch(() => null);
}

export type StartResult = {
  ok: boolean;
  journey_version: "v1" | "v2" | null;
  token?: string;
  redirect?: string;
  unavailable?: boolean;
  crawler?: boolean;
  message?: string;
  resumed?: boolean;
  session?: Journey2Session;
  error?: string;
};

export const journey2 = {
  start: async (opts: { adminTest?: boolean } = {}) => {
    const result = await call<StartResult>("journey2-session", {
      action: "start",
      anonymous_session_id: getAnonymousSessionId(),
      admin_test: opts.adminTest || undefined,
      utm: readUtm(),
    });
    const offerCode = readOfferCode();
    if (result?.token && offerCode === "SWITCH50") {
      const attached = await refreshCampaign(result.token, offerCode);
      if (attached?.promotion && result.session) {
        result.session.campaign_code = attached.campaign_code ?? offerCode;
        result.session.campaign_snapshot = attached.promotion;
      }
    }
    return result;
  },

  get: async (token: string) => {
    const result = await call<{ ok: boolean; session: Journey2Session; quote_token_available: boolean; v2_test_mode: boolean; error?: string }>(
      "journey2-session", { action: "get", token },
    );
    if (result?.ok && result.session) {
      const refreshed = await refreshCampaign(token);
      if (refreshed?.campaign_code) result.session.campaign_code = refreshed.campaign_code;
      if (refreshed?.promotion) result.session.campaign_snapshot = refreshed.promotion;
    }
    return result;
  },

  saveStep: async (
    token: string,
    step: "address" | "plan" | "router" | "extras" | "details" | "start_date" | "billing",
    payload: Record<string, unknown>,
  ) => {
    const result = await call<{ ok: boolean; session?: Journey2Session; error?: string; message?: string; redirect?: string; details?: unknown }>(
      "journey2-session", { action: "save_step", token, step, payload },
    );
    if (result?.ok && result.session && step === "plan") {
      const refreshed = await refreshCampaign(token);
      if (refreshed?.campaign_code) result.session.campaign_code = refreshed.campaign_code;
      if (refreshed?.promotion) result.session.campaign_snapshot = refreshed.promotion;
    }
    return result;
  },

  cancel: (token: string) => call<{ ok: boolean }>("journey2-session", { action: "cancel", token }),

  catalogue: (customer_type: "residential" | "business" = "residential") =>
    call<{ ok: boolean; catalogue: Catalogue; error?: string }>("journey2-catalogue", { customer_type }),

  prepareContract: (token: string) =>
    call<{ ok: boolean; quote_token?: string; contract_ready?: boolean; contract_error?: string; error?: string; message?: string }>(
      "switch50-prepare-contract", { token },
    ),

  applyPostContract: (token: string, quote_token: string) =>
    call<{ ok: boolean; applied?: boolean; retryable?: boolean; failures?: { step: string; error: string }[]; error?: string; message?: string }>(
      "journey2-apply-postcontract", { token, quote_token },
    ),

  finalise: (token: string) =>
    call<{ ok: boolean; submitted: boolean; order_number?: string | null; preferred_start_date?: string | null; error?: string }>(
      "journey2-finalise", { token },
    ),

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
  promotion_reward?: { status: string; eligibility_due_at: string | null; issued_at: string | null } | null;
  promotion?: CampaignPromotion | null;
};

export const money = (n: number | null | undefined) =>
  `£${Number(n ?? 0).toFixed(2)}`;

export const PLAN_TERM_LABEL: Record<PlanTerm, string> = {
  flex_30: "Flex 30 (rolling monthly)",
  price_lock_24: "Price Lock 24 (fixed 24 months)",
};

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
