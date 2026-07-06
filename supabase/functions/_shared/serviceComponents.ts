// Phase B service-aware snapshot builder. Reads a quote (and its selected
// addons, router, setup, SIM plan if present) and produces the
// service_components_snapshot consumed by the two-document generators and
// validators. Pure — no side effects — safe to call in tests.

import type { ServiceComponent, PriceChangeSnapshot } from "./twoDocValidators.ts";
import { PRICE_CHANGE_NONE } from "./twoDocLegalText.ts";

interface QuoteLike {
  id: string;
  service_type?: string | null;         // 'broadband' | 'digital_voice' | 'sim' | 'bundle'
  plan_type?: string | null;            // 'flex' | 'fixed'
  plan_term?: string | null;            // 'flex_30' | 'price_lock_24'
  plan_name?: string | null;
  monthly_gross?: number | null;
  notice_period?: string | null;
  contract_length_months?: number | null;
  cease_fee_gross?: number | null;
  price_rise_policy?: string | null;
  selected_addons?: unknown;            // array of {id,label,monthly,kind?}
  router_option?: unknown;
  setup_option?: unknown;
  sim_plan_snapshot?: unknown;          // future-proof: injected by SIM checkout
}

function parseTermMonths(q: QuoteLike): number {
  if (q.plan_term === "price_lock_24") return 24;
  if (q.plan_type === "fixed") return q.contract_length_months ?? 12;
  return 0;
}

function parseNoticeDays(q: QuoteLike): number {
  const s = String(q.notice_period ?? "30 days").toLowerCase();
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
}

function defaultPriceChange(): PriceChangeSnapshot {
  return { kind: "none", wording: PRICE_CHANGE_NONE };
}

function broadbandComponent(q: QuoteLike): ServiceComponent {
  const isFixed = q.plan_type === "fixed" || q.plan_term === "price_lock_24";
  return {
    id: `broadband-${q.id}`,
    kind: "broadband",
    label: q.plan_name ?? "Broadband",
    monthly_price_incl_vat: Number(q.monthly_gross ?? 0),
    contract_kind: isFixed ? "fixed_term" : "flex_30_rolling",
    minimum_term_months: parseTermMonths(q),
    notice_period_days: parseNoticeDays(q),
    price_change: defaultPriceChange(),
    cancellation_wording: isFixed
      ? "Cancel by giving notice — an early termination charge applies during the minimum term. See the Contract Information Pack for the exact ETF calculation."
      : "Cancel with 30 days' notice at any time. No early termination charge.",
    // etf: intentionally undefined for fixed — must be populated by admin before
    //      the generator runs. Validators will hard-block otherwise.
  };
}

function digitalVoiceComponent(q: QuoteLike): ServiceComponent {
  return {
    id: `digital-voice-${q.id}`,
    kind: "digital_voice",
    label: "Digital Voice / Home Phone",
    monthly_price_incl_vat: 0, // usually bundled — override where itemised
    contract_kind: "flex_30_rolling",
    minimum_term_months: 0,
    notice_period_days: 30,
    price_change: defaultPriceChange(),
    cancellation_wording:
      "Cancels with the associated broadband service. Digital Voice cannot continue as a standalone product on this account.",
  };
}

function simComponent(q: QuoteLike): ServiceComponent | null {
  const s = q.sim_plan_snapshot as
    | { id?: string; label?: string; monthly_price_incl_vat?: number; contract_kind?: string; minimum_term_months?: number; notice_period_days?: number; etf?: any; price_change?: PriceChangeSnapshot }
    | undefined;
  if (!s || typeof s !== "object") return null;
  const kind = (s.contract_kind === "fixed_term" ? "fixed_term" : "flex_30_rolling") as ServiceComponent["contract_kind"];
  return {
    id: s.id ?? `sim-${q.id}`,
    kind: "sim",
    label: s.label ?? "SIM plan",
    monthly_price_incl_vat: Number(s.monthly_price_incl_vat ?? 0),
    contract_kind: kind,
    minimum_term_months: Number(s.minimum_term_months ?? (kind === "fixed_term" ? 12 : 0)),
    notice_period_days: Number(s.notice_period_days ?? 30),
    etf: s.etf,
    price_change: s.price_change ?? defaultPriceChange(),
    cancellation_wording:
      "SIM cancels independently of any broadband service. Final charges include any un-billed usage up to the cancellation date.",
  };
}

function addonComponents(q: QuoteLike): ServiceComponent[] {
  const list = Array.isArray(q.selected_addons) ? (q.selected_addons as any[]) : [];
  return list
    .filter((a) => a && typeof a === "object" && a.kind !== "sim" && a.kind !== "digital_voice")
    .map((a, i) => ({
      id: `addon-${q.id}-${a.id ?? i}`,
      kind: "addon" as const,
      label: String(a.label ?? a.id ?? "Add-on"),
      monthly_price_incl_vat: Number(a.monthly ?? 0),
      contract_kind: "flex_30_rolling" as const,
      minimum_term_months: 0,
      notice_period_days: 30,
      price_change: defaultPriceChange(),
      cancellation_wording: "Cancel or change at any time from your dashboard. Prorated on the next invoice.",
    }));
}

export function buildServiceComponentsSnapshot(q: QuoteLike): ServiceComponent[] {
  const out: ServiceComponent[] = [];
  const st = (q.service_type ?? "").toLowerCase();

  if (st === "sim") {
    const sim = simComponent(q);
    if (sim) out.push(sim);
    return out; // SIM-only: NO broadband/DV
  }

  if (st === "digital_voice" || st === "broadband") {
    out.push(broadbandComponent(q));
    if (st === "digital_voice") out.push(digitalVoiceComponent(q));
  } else if (st === "bundle") {
    out.push(broadbandComponent(q));
    // bundle may or may not include DV — detect via selected_addons
    const addons = Array.isArray(q.selected_addons) ? (q.selected_addons as any[]) : [];
    if (addons.some((a) => a?.kind === "digital_voice" || /digital[- ]?voice/i.test(a?.label ?? ""))) {
      out.push(digitalVoiceComponent(q));
    }
    const sim = simComponent(q);
    if (sim) out.push(sim);
  } else {
    // Unknown / legacy — treat as broadband to preserve prior behaviour.
    out.push(broadbandComponent(q));
  }

  out.push(...addonComponents(q));
  return out;
}

export function bundleTotalMonthly(components: ServiceComponent[]): number {
  return components.reduce((sum, c) => sum + (Number(c.monthly_price_incl_vat) || 0), 0);
}

export function hasComponent(
  components: ServiceComponent[],
  kind: ServiceComponent["kind"],
): boolean {
  return components.some((c) => c.kind === kind);
}
