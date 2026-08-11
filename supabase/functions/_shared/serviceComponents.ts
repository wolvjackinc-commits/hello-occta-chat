// Phase B service-aware snapshot builder. Reads a quote (and its selected
// addons, router, setup, SIM plan if present) and produces the
// service_components_snapshot consumed by the two-document generators and
// validators. Pure — no side effects — safe to call in tests.

import type { ServiceComponent, PriceChangeSnapshot } from "./twoDocValidators.ts";
import { PRICE_CHANGE_NONE } from "./twoDocLegalText.ts";
import { resolveNoticePeriod, noticeText } from "./noticePeriod.ts";

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
  final_snapshot?: unknown;             // may contain { two_doc: { broadband_etf?, digital_voice?, sim_plan_snapshot?, price_change? } }
}

function twoDocOverrides(q: QuoteLike): {
  broadband_etf?: import("./twoDocValidators.ts").EtfSnapshot;
  broadband?: {
    contract_kind?: "fixed_term" | "flex_30_rolling";
    minimum_term_months?: number;
    notice_period_days?: number;
    cancellation_wording?: string;
    label?: string;
    monthly_price_incl_vat?: number;
  };
  digital_voice?: { monthly_price_incl_vat?: number };
  sim_plan_snapshot?: any;
  price_change?: PriceChangeSnapshot;
} {
  const fs = q.final_snapshot as any;
  if (fs && typeof fs === "object" && fs.two_doc && typeof fs.two_doc === "object") return fs.two_doc;
  return {};
}

function isFixedPlan(q: QuoteLike): boolean {
  const ov = twoDocOverrides(q);
  if (ov.broadband?.contract_kind === "fixed_term") return true;
  if (ov.broadband?.contract_kind === "flex_30_rolling") return false;
  if (ov.broadband_etf && (q.contract_length_months ?? 0) > 0) return true;
  const pt = String(q.plan_type ?? "").toLowerCase();
  if (pt === "fixed" || pt === "contract_saver" || pt === "price_lock") return true;
  if (q.plan_term === "price_lock_24") return true;
  return false;
}

function parseTermMonths(q: QuoteLike): number {
  const ov = twoDocOverrides(q);
  if (typeof ov.broadband?.minimum_term_months === "number") return ov.broadband.minimum_term_months;
  if (q.plan_term === "price_lock_24") return 24;
  if (isFixedPlan(q)) return q.contract_length_months ?? 12;
  return 0;
}

/**
 * Broadband notice period, derived from the quote only. Throws when legacy data
 * cannot be resolved so the document is never built with an invented 30 days.
 */
function parseNoticeDays(q: QuoteLike): number {
  const resolved = resolveNoticePeriod(q as any);
  if (!resolved) {
    throw new Error("notice_period_unresolved: quote has no resolvable notice period — manual review required");
  }
  return resolved.days;
}

function defaultPriceChange(): PriceChangeSnapshot {
  return { kind: "none", wording: PRICE_CHANGE_NONE };
}

function broadbandComponent(q: QuoteLike): ServiceComponent {
  const ov = twoDocOverrides(q);
  const isFixed = isFixedPlan(q);
  const noticeDays = parseNoticeDays(q);
  const noticeLabel = noticeText(noticeDays);
  const cancelDefault = isFixed
    ? `Cancel by giving ${noticeLabel} notice — an early termination charge applies during the minimum term. See the Contract Information Pack for the exact ETF calculation.`
    : noticeDays > 0
      ? `Cancel with ${noticeLabel} notice at any time. No early termination charge.`
      : "Cancel at any time with no notice period. No early termination charge.";
  return {
    id: `broadband-${q.id}`,
    kind: "broadband",
    label: ov.broadband?.label ?? q.plan_name ?? "Broadband",
    monthly_price_incl_vat: Number(ov.broadband?.monthly_price_incl_vat ?? q.monthly_gross ?? 0),
    contract_kind: isFixed ? "fixed_term" : "flex_30_rolling",
    minimum_term_months: parseTermMonths(q),
    notice_period_days: noticeDays,
    price_change: ov.price_change ?? defaultPriceChange(),
    cancellation_wording: ov.broadband?.cancellation_wording ?? cancelDefault,
    etf: isFixed ? ov.broadband_etf : undefined,
  };
}

function digitalVoiceComponent(q: QuoteLike): ServiceComponent {
  const ov = twoDocOverrides(q);
  // Digital Voice cancels with the broadband service, so it inherits its notice.
  const noticeDays = parseNoticeDays(q);
  return {
    id: `digital-voice-${q.id}`,
    kind: "digital_voice",
    label: "Digital Voice / Home Phone",
    monthly_price_incl_vat: Number(ov.digital_voice?.monthly_price_incl_vat ?? 0),
    contract_kind: "flex_30_rolling",
    minimum_term_months: 0,
    notice_period_days: noticeDays,
    price_change: defaultPriceChange(),
    cancellation_wording:
      "Cancels with the associated broadband service. Digital Voice cannot continue as a standalone product on this account.",
  };
}

function simComponent(q: QuoteLike): ServiceComponent | null {
  const ov = twoDocOverrides(q);
  const s = (q.sim_plan_snapshot ?? ov.sim_plan_snapshot) as
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

  if (st === "digital_voice" || st === "broadband" || st === "bundle") {
    out.push(broadbandComponent(q));
    const addons = Array.isArray(q.selected_addons) ? (q.selected_addons as any[]) : [];
    const hasDvAddon = addons.some((a) => a?.kind === "digital_voice" || /digital[- ]?voice/i.test(a?.label ?? ""));
    if (st === "digital_voice" || hasDvAddon) {
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
