// Phase B/C hard-block validators. Pure functions — no DB, no side effects.
// Called by generate-service-aware-cs (issue-time) AND accept-service-aware-cs
// (accept-time). Both call sites MUST fail closed on any block.

export type CustomerSegment =
  | "residential"
  | "microenterprise"
  | "small_business"
  | "not_for_profit"
  | "large_business";

export type ContractKind = "flex_30_rolling" | "fixed_term";

export interface EtfSnapshot {
  wording?: string;                  // customer-readable
  calculation_method?: string;       // e.g. "remaining monthly charges to end of term"
  cap_or_formula?: string;           // e.g. "capped at 6× monthly price"
  worked_example?: string;
  vat_treatment?: string;            // "amounts shown incl. VAT" / "ex VAT"
  date_basis?: string;               // "notice date to contract end date"
  based_on_accepted_agreement?: boolean;
}

export interface PriceChangeSnapshot {
  kind: "none" | "fixed_pounds";
  wording?: string;
  effective_date?: string;           // ISO
  new_monthly_price?: number;
  raw?: string;                      // if a legacy free-text value slipped in
}

export interface ServiceComponent {
  id: string;
  kind: "broadband" | "digital_voice" | "sim" | "router" | "addon";
  label: string;
  monthly_price_incl_vat: number;
  contract_kind: ContractKind;
  minimum_term_months: number;   // 0 for flex
  notice_period_days: number;
  etf?: EtfSnapshot;             // required when contract_kind === "fixed_term"
  price_change: PriceChangeSnapshot;
  cancellation_wording: string;
}

export interface DigitalVoiceAnswers {
  acknowledged_dependencies: boolean;
  relies_on_emergency?: boolean;
  uses_telecare?: boolean;
  uses_medical_equipment?: boolean;
  accessibility_needs?: boolean;
  poor_mobile_coverage?: boolean;
}

export interface ValidationInput {
  customer_segment: CustomerSegment;
  components: ServiceComponent[];
  digital_voice_answers?: DigitalVoiceAnswers | null;
}

export interface ValidationBlock {
  code: string;
  message: string;
  component_id?: string;
  field?: string;
}

export interface ValidationResult {
  ok: boolean;
  blocks: ValidationBlock[];
  vulnerability_review_required: boolean;
  requires_dv_acknowledgement: boolean;
}

const FORBIDDEN_PRICE_RISE = [
  /\bCPI\b/i,
  /\bRPI\b/i,
  /\binflation[- ]linked\b/i,
  /\bindex[- ]linked\b/i,
  /\b\d+(\.\d+)?\s*%\b/,        // any bare percentage
  /\bvariable\s+increase\b/i,
  /\bmay\s+increase\s+at\s+any\s+time\b/i,
  /\bannual\s+price\s+rise\b/i,
];

const PROTECTED_SEGMENTS: CustomerSegment[] = [
  "residential",
  "microenterprise",
  "small_business",
  "not_for_profit",
];

function validateEtf(c: ServiceComponent): ValidationBlock[] {
  const out: ValidationBlock[] = [];
  if (c.contract_kind !== "fixed_term") return out;
  const etf = c.etf;
  const push = (field: string, msg: string) =>
    out.push({ code: "etf_incomplete", message: msg, component_id: c.id, field });
  if (!etf) {
    push("etf", "Fixed-term component has no ETF snapshot. Acceptance blocked.");
    return out;
  }
  if (!etf.wording || etf.wording.trim().length < 30)
    push("wording", "ETF customer-readable wording is missing or too short.");
  if (!etf.calculation_method) push("calculation_method", "ETF calculation method is missing.");
  if (!etf.cap_or_formula) push("cap_or_formula", "ETF cap or formula is missing.");
  if (!etf.worked_example) push("worked_example", "ETF worked example is missing.");
  if (!etf.vat_treatment) push("vat_treatment", "ETF VAT treatment is missing.");
  if (!etf.date_basis) push("date_basis", "ETF date basis is missing.");
  if (etf.based_on_accepted_agreement !== true)
    push("based_on_accepted_agreement", "ETF must confirm it is based on the accepted agreement.");
  // Ban generic wording
  if (etf.wording && /\bmay\s+apply\b/i.test(etf.wording) && etf.wording.length < 80)
    push("wording", "ETF wording is too generic. Provide a concrete customer-readable explanation.");
  return out;
}

function validatePriceChange(
  c: ServiceComponent,
  segment: CustomerSegment,
): ValidationBlock[] {
  const out: ValidationBlock[] = [];
  if (!PROTECTED_SEGMENTS.includes(segment)) return out;
  const pc = c.price_change;
  const push = (msg: string, field = "price_change") =>
    out.push({ code: "price_change_forbidden", message: msg, component_id: c.id, field });
  if (!pc || !pc.kind) {
    push("Price-change snapshot is missing.");
    return out;
  }
  if (pc.kind !== "none" && pc.kind !== "fixed_pounds") {
    push(`Price-change kind '${pc.kind}' is not allowed for this customer segment.`);
    return out;
  }
  const haystack = [pc.wording ?? "", pc.raw ?? ""].join(" \n ");
  for (const rx of FORBIDDEN_PRICE_RISE) {
    if (rx.test(haystack)) {
      push(`Price-change wording contains prohibited pattern '${rx.source}'.`);
      return out;
    }
  }
  if (pc.kind === "fixed_pounds") {
    if (!pc.effective_date) push("Fixed-pounds price change must include an effective date.", "effective_date");
    if (typeof pc.new_monthly_price !== "number" || pc.new_monthly_price <= 0)
      push("Fixed-pounds price change must include the new monthly price.", "new_monthly_price");
  }
  return out;
}

function validateDigitalVoice(input: ValidationInput): {
  blocks: ValidationBlock[];
  vulnerability: boolean;
  requires_ack: boolean;
} {
  const dvComp = input.components.find((c) => c.kind === "digital_voice");
  if (!dvComp) return { blocks: [], vulnerability: false, requires_ack: false };
  const blocks: ValidationBlock[] = [];
  const a = input.digital_voice_answers;
  if (!a || a.acknowledged_dependencies !== true) {
    blocks.push({
      code: "dv_ack_required",
      message: "Digital Voice acknowledgement checkbox must be ticked to accept.",
      component_id: dvComp.id,
      field: "acknowledged_dependencies",
    });
  }
  const vulnerability =
    !!a?.relies_on_emergency ||
    !!a?.uses_telecare ||
    !!a?.uses_medical_equipment ||
    !!a?.accessibility_needs ||
    !!a?.poor_mobile_coverage;
  return { blocks, vulnerability, requires_ack: true };
}

export function validateTwoDocAcceptance(input: ValidationInput): ValidationResult {
  const blocks: ValidationBlock[] = [];
  if (!Array.isArray(input.components) || input.components.length === 0) {
    blocks.push({ code: "no_components", message: "No service components provided." });
  }
  for (const c of input.components ?? []) {
    blocks.push(...validateEtf(c));
    blocks.push(...validatePriceChange(c, input.customer_segment));
  }
  const dv = validateDigitalVoice(input);
  blocks.push(...dv.blocks);
  return {
    ok: blocks.length === 0,
    blocks,
    vulnerability_review_required: dv.vulnerability,
    requires_dv_acknowledgement: dv.requires_ack,
  };
}

// Convenience: block set that must ALWAYS be enforced at issue-time, even
// when the customer hasn't submitted DV answers yet (i.e. no DV ack required
// yet, but ETF + price-change must still be valid).
export function validateTwoDocIssue(
  input: Omit<ValidationInput, "digital_voice_answers">,
): ValidationResult {
  // DV acknowledgement is an accept-time concern (the customer ticks the
  // box). At issue-time we only enforce component-level correctness — ETF
  // completeness, price-change safety, and component presence. The
  // DV ack requirement is still enforced by validateTwoDocAcceptance at
  // the accept-service-aware-cs entrypoint.
  const blocks: ValidationBlock[] = [];
  if (!Array.isArray(input.components) || input.components.length === 0) {
    blocks.push({ code: "no_components", message: "No service components provided." });
  }
  for (const c of input.components ?? []) {
    blocks.push(...validateEtf(c));
    blocks.push(...validatePriceChange(c, input.customer_segment));
  }
  const requiresAck = (input.components ?? []).some((c) => c.kind === "digital_voice");
  return {
    ok: blocks.length === 0,
    blocks,
    vulnerability_review_required: false,
    requires_dv_acknowledgement: requiresAck,
  };
}
