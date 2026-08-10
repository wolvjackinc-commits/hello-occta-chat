// Phase B canonical safe copy for the two-document acceptance flow.
// Never rename to "Full Contract Summary" — the long document is the
// "OCCTA Contract Information & Customer Agreement Pack".

export const TWO_DOC_TEMPLATE_VERSION = "2026-07-01";

export const CONTRACT_SUMMARY_TITLE = "OCCTA Contract Summary";
export const CONTRACT_INFORMATION_PACK_TITLE =
  "OCCTA Contract Information & Customer Agreement Pack";

// ─── Digital Voice / Home Phone ──────────────────────────────────────────────
export const DV_DEPENDENCY_POINTS: readonly string[] = [
  "Depends on your broadband connection being live.",
  "Depends on mains power to your router and any DECT / handset base.",
  "Will not work during a mains power cut unless suitable battery backup is in place.",
  "Will not work during a broadband outage.",
  "Requires an OCCTA-supplied or approved router/ATA configured for Digital Voice.",
  "999 / 112 emergency calls will not work if power, broadband or the router is unavailable.",
  "Personal telecare alarms, medical alert pendants and lift/lifeline devices connected to your line may stop working without a compatible backup solution.",
  "If you have poor or no mobile coverage at the property, you should not rely on Digital Voice for emergency calls without a backup.",
];

export const DV_ACKNOWLEDGEMENT_CHECKBOX =
  "I understand that Digital Voice / Home Phone depends on broadband and mains power and may not work during a power cut or broadband outage unless suitable backup is in place.";

export const DV_VULNERABILITY_QUESTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "relies_on_emergency", label: "Do you rely on this line for 999 / 112 emergency calls?" },
  { id: "uses_telecare", label: "Is a telecare alarm, medical alert pendant or lifeline device connected to this line?" },
  { id: "uses_medical_equipment", label: "Is any medical equipment connected to this line?" },
  { id: "accessibility_needs", label: "Do you have accessibility needs that make a working phone line essential?" },
  { id: "poor_mobile_coverage", label: "Is mobile coverage at the property poor or non-existent?" },
];

// ─── SIM-only ────────────────────────────────────────────────────────────────
export const SIM_ONLY_HEADER_NOTE =
  "This Contract Summary covers a SIM-only mobile service. Broadband and Digital Voice terms do not apply.";

// ─── Price-change ────────────────────────────────────────────────────────────
// Only two shapes are allowed by the hard-block validator for residential /
// microenterprise / small-business / not-for-profit customers.
export const PRICE_CHANGE_NONE =
  "No scheduled price increase during the minimum term. If we ever need to change a price, we'll tell you in writing at least 30 days in advance and you can leave penalty-free.";

export function priceChangeFixedPoundsWording(opts: {
  effective_date: string;
  new_monthly_price: number;
  currency?: string;
}): string {
  const cur = opts.currency ?? "£";
  return `A price increase of a fixed pounds-and-pence amount takes effect on ${opts.effective_date}, taking your monthly price to ${cur}${opts.new_monthly_price.toFixed(2)}. You may leave penalty-free within 30 days of that change.`;
}

// ─── Payment schedule (safe wording) ─────────────────────────────────────────
export const PAYMENT_SCHEDULE_SAFE =
  "Billing starts after your service is confirmed live. Your first invoice is issued once we confirm the service-live date and will include the activation fee plus a pro-rata charge from the service-live date to your billing date. From then on, your service is billed monthly in advance on your billing date via the payment method you set up (secure Worldpay payment link or Direct Debit setup request).";

// ─── Complaints / ADR ────────────────────────────────────────────────────────
export const COMPLAINTS_ADR_SAFE =
  "If something goes wrong, contact complaints@occta.co.uk. If we cannot resolve your complaint within 6 weeks, or if we issue a deadlock letter sooner, you have the right to refer it free of charge to our Alternative Dispute Resolution (ADR) scheme.";

// ─── Speeds ──────────────────────────────────────────────────────────────────
export const SPEED_ESTIMATE_DISCLAIMER =
  "Estimated speeds depend on your address and line check. Actual speeds may vary. If your line consistently underperforms the estimate shown, contact us — we will investigate with the access network and set out the remedies available to you, including any statutory or regulatory rights that apply.";

// ─── SIM-only fields (defaults; individual plans should override) ────────────
export const SIM_ROAMING_DEFAULT =
  "Roaming within the EU / EEA is included at fair-use levels as published in the OCCTA Mobile Price Guide. Roaming outside the EU / EEA is charged at the rates in the Price Guide.";

export const SIM_FAIR_USE_DEFAULT =
  "Fair usage limits apply to unlimited allowances as set out in the OCCTA Mobile Price Guide.";
