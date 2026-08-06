/**
 * Journey 2 — the contractual document pack, rendered from the accepted
 * immutable snapshot only.
 *
 * Journey 2 never reuses quote-only documents: every document below is built
 * from the same snapshot and stamped with the same fingerprint, so the Contract
 * Summary, Contract Information, acceptance certificate, agreement pack, order
 * summary, Direct Debit confirmation, Guarantee, cooling-off information and
 * Digital Voice information all state identical figures.
 */
import type { Journey2Snapshot } from "./journey2Snapshot.ts";

export type Journey2Doc = { doc_type: string; title: string; content: Record<string, unknown> };

export const REQUIRED_DOC_TYPES = [
  "contract_summary",
  "contract_information",
  "acceptance_certificate",
  "agreement_pack",
  "order_summary",
  "dd_instruction_confirmation",
  "dd_guarantee",
  "cooling_off_information",
] as const;

const money = (n: number) => `£${Number(n).toFixed(2)}`;

function pricingBlock(s: Journey2Snapshot) {
  return {
    monthly_ex_vat: s.pricing.monthly_ex_vat,
    monthly_vat: s.pricing.monthly_vat,
    monthly_incl_vat: s.pricing.monthly_incl_vat,
    vat_rate_percent: s.pricing.vat_rate_percent,
    one_off_charges_incl_vat: s.pricing.one_off_charges_incl_vat,
    one_off_charged_on_first_bill: true,
    amount_due_today: 0,
    amount_due_today_statement: "Nothing to pay today.",
    estimated_first_bill_incl_vat: s.pricing.estimated_first_bill_incl_vat,
    display: {
      monthly: `${money(s.pricing.monthly_incl_vat)} a month (incl. VAT) — ${money(s.pricing.monthly_ex_vat)} + ${money(s.pricing.monthly_vat)} VAT`,
      one_off: `${money(s.pricing.one_off_charges_incl_vat)} one-off charges, added to your first bill`,
      first_bill: `Estimated first bill ${money(s.pricing.estimated_first_bill_incl_vat)} (incl. VAT)`,
      today: "£0.00 due today",
    },
  };
}

function ddBlock(s: Journey2Snapshot, ddStatus: string) {
  return {
    account_holder_name: s.direct_debit.account_holder_name,
    bank_name: s.direct_debit.bank_name,
    account_number_masked: `****${s.direct_debit.last4}`,
    sort_code_masked: `**-**-${s.direct_debit.sort_last2}`,
    status: ddStatus,
    billing_day: s.schedule.billing_day,
    advance_notice_days: s.direct_debit.advance_notice_days,
    first_collection_rule: s.schedule.expected_first_collection_rule,
    guarantee_provided: true,
  };
}

/**
 * Builds the full pack. `ddStatus` and `orderNumber` are committed values, so a
 * test pack is labelled and a live pack is not.
 */
export function buildJourney2DocumentPack(
  s: Journey2Snapshot,
  meta: { order_number: string; snapshot_sha256: string; dd_status: string; test: boolean },
): Journey2Doc[] {
  const label = meta.test ? "TEST — not a customer document" : null;
  const base = {
    label,
    test_document: meta.test,
    order_number: meta.order_number,
    snapshot_sha256: meta.snapshot_sha256,
    snapshot_version: s.snapshot_version,
    pricing_version: s.pricing_version,
  };

  const product = {
    plan_name: s.product.plan_name,
    speed_bucket: s.product.speed_bucket,
    contract_term: s.product.contract_term,
    minimum_term_months: s.product.minimum_term_months,
    router: s.router,
    add_ons: s.addons,
    setup: s.product.setup,
  };
  const schedule = {
    preferred_start_date: s.schedule.preferred_start_date,
    billing_day: s.schedule.billing_day,
    billing_commencement_rule: s.schedule.billing_commencement_rule,
    expected_first_collection_rule: s.schedule.expected_first_collection_rule,
  };
  const care = {
    accessibility_needs: s.customer.accessibility_needs,
    vulnerability_support_needs: s.customer.vulnerability_support_needs,
  };

  const docs: Journey2Doc[] = [
    {
      doc_type: "contract_summary",
      title: `${meta.test ? "TEST " : ""}Contract Summary`,
      content: {
        ...base,
        customer: s.customer,
        service_address: s.service_address,
        billing_address: s.billing_address,
        product,
        pricing: pricingBlock(s),
        schedule,
        direct_debit: ddBlock(s, meta.dd_status),
        cooling_off: s.cooling_off,
        digital_voice: s.digital_voice,
        switching: s.switching,
        care,
        signed: true,
      },
    },
    {
      doc_type: "contract_information",
      title: `${meta.test ? "TEST " : ""}Contract Information`,
      content: {
        ...base,
        product,
        pricing: pricingBlock(s),
        schedule,
        switching: s.switching,
        cooling_off: s.cooling_off,
        digital_voice: s.digital_voice,
        care,
        direct_debit: ddBlock(s, meta.dd_status),
        legal_document_versions: s.legal_document_versions,
        complaints: "Our complaints code of practice is at /legal/complaints-code.",
      },
    },
    {
      doc_type: "acceptance_certificate",
      title: `${meta.test ? "TEST " : ""}Acceptance certificate`,
      content: {
        ...base,
        accepted_by: s.customer.full_name,
        accepted_email: s.customer.email,
        fingerprint_verified: true,
        cooling_off_days: s.cooling_off.days,
      },
    },
    {
      doc_type: "agreement_pack",
      title: `${meta.test ? "TEST " : ""}Signed agreement pack`,
      content: {
        ...base,
        includes: [...REQUIRED_DOC_TYPES],
        product,
        pricing: pricingBlock(s),
        schedule,
        direct_debit: ddBlock(s, meta.dd_status),
        cooling_off: s.cooling_off,
      },
    },
    {
      doc_type: "order_summary",
      title: `${meta.test ? "TEST " : ""}Order summary`,
      content: {
        ...base,
        product,
        pricing: pricingBlock(s),
        schedule,
        service_address: s.service_address,
        next_steps: [
          "We confirm your order with the network.",
          "We send your advance Direct Debit notice at least 3 working days before your first collection.",
          "We confirm your installation or activation date.",
        ],
      },
    },
    {
      doc_type: "dd_instruction_confirmation",
      title: `${meta.test ? "TEST " : ""}Direct Debit Instruction confirmation`,
      content: { ...base, direct_debit: ddBlock(s, meta.dd_status), full_bank_details_included: false },
    },
    {
      doc_type: "dd_guarantee",
      title: "Direct Debit Guarantee",
      content: { ...base, url: "/legal/direct-debit-guarantee", guarantee_provided: true },
    },
    {
      doc_type: "cooling_off_information",
      title: "Cooling-off information",
      content: { ...base, cooling_off: s.cooling_off, url: "/legal/switching-policy" },
    },
  ];

  if (s.digital_voice.selected) {
    docs.push({
      doc_type: "digital_voice_information",
      title: `${meta.test ? "TEST " : ""}Digital Voice information`,
      content: { ...base, digital_voice: s.digital_voice, url: "/landline" },
    });
  }
  return docs;
}
