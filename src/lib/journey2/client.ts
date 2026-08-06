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
export type Catalogue = {
  pricing_version: string;
  customer_type: "residential" | "business";
  setup: { option: string; label: string; one_off: number } | null;
  plans: { speed_bucket: SpeedBucket; label: string; terms: Partial<Record<PlanTerm, CatalogueTerm>> }[];
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
  } | null;
  price_snapshot: PriceSnapshot | null;
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
  if (error && !data) throw new Error(error.message ?? "network_error");
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

  saveStep: (token: string, step: "address" | "plan" | "router" | "extras" | "details", payload: Record<string, unknown>) =>
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

  finalise: (token: string) =>
    call<{ ok: boolean; submitted: boolean; order_number?: string | null; preferred_start_date?: string | null; error?: string }>(
      "journey2-finalise", { token },
    ),
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
};