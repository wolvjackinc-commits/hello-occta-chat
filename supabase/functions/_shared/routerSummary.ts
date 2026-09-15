/**
 * Shared, side-effect-free helpers for describing the router selection stored
 * on a Contract Summary (`contract_summaries.router_option` / `router_charge`).
 *
 * Historic rows use either `one_off` or `oneOff` for the one-off amount, so
 * every reader must go through `normaliseRouterOption`. Nothing here mutates
 * data or reads the database.
 */

export interface RouterOptionShape {
  option: string;
  label: string;
  payment_type: string;
  monthly: number;
  one_off: number;
}

export function normaliseRouterOption(raw: unknown): RouterOptionShape | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const option = String(r.option ?? r.router_option ?? "").trim();
  if (!option) return null;
  const monthly = Number(r.monthly ?? 0);
  const oneOff = Number(r.one_off ?? r.oneOff ?? 0);
  const paymentType = String(r.payment_type ?? r.router_payment_type ?? "").trim() ||
    (monthly > 0 ? "monthly" : oneOff > 0 ? "one_off" : "none");
  return {
    option,
    label: String(r.label ?? "").trim() || defaultRouterLabel(option),
    payment_type: paymentType,
    monthly: Number.isFinite(monthly) && monthly > 0 ? monthly : 0,
    one_off: Number.isFinite(oneOff) && oneOff > 0 ? oneOff : 0,
  };
}

function defaultRouterLabel(option: string): string {
  switch (option) {
    case "own": return "Bring your own router";
    case "standard": return "Standard WiFi 6 router";
    case "premium": return "Premium WiFi / mesh router";
    case "business":
    case "business_hub": return "Business-grade router";
    default: return "Router";
  }
}

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * Customer-facing one-line description of the router selection, e.g.
 * "Standard WiFi 6 router — £4.99/month incl. VAT".
 */
export function describeRouterSelection(raw: unknown, routerCharge?: unknown): string | null {
  const r = normaliseRouterOption(raw);
  if (!r) return null;
  const charge = Number(routerCharge ?? 0);
  const oneOff = r.one_off > 0 ? r.one_off : (r.payment_type === "one_off" && charge > 0 ? charge : 0);
  if (r.option === "own") return `${r.label} — no OCCTA router charge`;
  if (r.monthly > 0) return `${r.label} — ${money(r.monthly)}/month incl. VAT`;
  if (oneOff > 0) return `${r.label} — ${money(oneOff)} one-off incl. VAT`;
  return `${r.label} — no charge`;
}

/** Equipment wording used in the Contract Summary PDF (section 1). */
export function routerEquipmentLine(raw: unknown, routerCharge?: unknown): string {
  const r = normaliseRouterOption(raw);
  const charge = Number(routerCharge ?? 0);
  if (!r) {
    return charge > 0
      ? `Router supplied by OCCTA — one-off charge ${money(charge)} incl. VAT.`
      : "No router is included. You may use your own compatible router; we provide the connection settings needed.";
  }
  if (r.option === "own") {
    return "No router is included. You may use your own compatible router; we provide the connection settings needed.";
  }
  if (r.monthly > 0) {
    return `${r.label} supplied by OCCTA — recurring charge ${money(r.monthly)} per month incl. VAT, included in your monthly price.`;
  }
  const oneOff = r.one_off > 0 ? r.one_off : charge;
  return oneOff > 0
    ? `${r.label} supplied by OCCTA — one-off charge ${money(oneOff)} incl. VAT.`
    : `${r.label} supplied by OCCTA — no charge.`;
}
