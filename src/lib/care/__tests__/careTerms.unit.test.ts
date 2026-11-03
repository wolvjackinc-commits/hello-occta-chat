// OCCTA Care: the rules the code promises must match the database, and no
// customer-facing copy may describe Care as insurance (FCA PERG 6.7), offer
// card payment (AGENTS.md) or leave out how to cancel.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARE_BANNED_PHRASES, CARE_FAQ, CARE_LETTER_TYPES, CARE_NOT_INCLUDED, CARE_PHONE_SCRIPT, CARE_PLANS, CARE_TERMS, CARE_TERMS_SUMMARY,
  CARE_TERMS_VERSION, careKeyFacts, carePriceMinor, careTermsCanonicalText,
} from "../../../../supabase/functions/_shared/careTerms.ts";
import { buildCareLetter, careLetterText } from "../../../../supabase/functions/_shared/careLetters.ts";

const root = path.resolve(__dirname, "../../../..");
// Every Care migration, in order: the schema plus later hardening.
const careMigrations = readdirSync(path.join(root, "supabase/migrations")).filter((f) => /_occta_care.*\.sql$/.test(f)).sort();
const migration = careMigrations.map((f) => readFileSync(path.join(root, "supabase/migrations", f), "utf8")).join("\n");
const hardening = readFileSync(path.join(root, "supabase/migrations/20261103100000_occta_care_hardening.sql"), "utf8");

const recipient = {
  name: "Mrs Test Person", email: "t@example.com", address_line1: "1 Test Road", city: "Huddersfield", postcode: "HD3 3WU",
  account_number: "A00001", reference: "OCCTA CARE-100001", needs: [],
};
const payloads: Record<string, Record<string, unknown>> = {
  welcome_pack: { plan_code: "essentials", frequency: "monthly", price_minor: 499, collection_day: 1, first_collection_date: "2026-12-01", cooling_off_ends_on: "2026-11-16", terms_version: CARE_TERMS_VERSION },
  dd_confirmation: { price_minor: 499, frequency: "monthly", collection_day: 1, first_collection_date: "2026-12-01", account_holder_name: "Mrs Test Person", masked_account_last4: "1234", masked_sort_last2: "56" },
  advance_notice: { due_date: "2027-01-15", amount_minor: 1497, period_start: "2027-01-15", period_end: "2027-04-14", frequency: "quarterly" },
  change_notice: { kind: "price_change", old_price_minor: 499, new_price_minor: 549, frequency: "monthly", effective_date: "2027-03-01" },
  renewal_reminder: { due_date: "2027-12-01", amount_minor: 4990, period_start: "2027-12-01", period_end: "2028-11-30", frequency: "annual", usage_count: 2 },
  usage_reminder: { usage_count: 0, low_use: true, price_minor: 499, frequency: "monthly", since: "2026-11-01" },
  payment_failed: { amount_minor: 499, due_date: "2026-12-01", reason_code: "0", retry_date: "2026-12-18" },
  service_paused: { amount_minor: 499, reason_code: "0", reason: "missed_payments" },
  mandate_cancelled: { kind: "bank_cancelled", reason_code: "1", effective_date: "2026-12-31" },
  cancellation_confirmation: { effective_date: "2026-11-02", refund_minor: 499, refunds: [{ amount_minor: 499 }], frequency: "monthly" },
  refund_confirmation: { amount_minor: 499, paid_on: "2026-11-10" },
  application_declined: {},
  indemnity_followup: { amount_minor: 499 },
};

/** Sentences that are allowed to use an insurance word because they say Care is NOT insurance. */
const NEGATION = /(not insurance|isn't insurance|is not insurance|no claims or excess|insurance policy from an insurer|home insurance|care is not insurance|you'd need an insurance)/i;

function bannedHits(text: string): string[] {
  const hits: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const lower = sentence.toLowerCase();
    for (const p of CARE_BANNED_PHRASES) {
      if (lower.includes(p) && !NEGATION.test(sentence)) hits.push(`"${p}" in: ${sentence.trim()}`);
    }
  }
  return hits;
}

describe("OCCTA Care rules match the database", () => {
  it("terms summary is identical to the published terms version row", () => {
    expect(migration).toContain(`'${CARE_TERMS_SUMMARY.replace(/'/g, "''")}'`);
    expect(migration).toContain(`'${CARE_TERMS_VERSION}'`);
  });

  it("terms hash in the migration is the hash of the canonical terms text", () => {
    const sha = createHash("sha256").update(careTermsCanonicalText(), "utf8").digest("hex");
    expect(migration).toContain(`'${sha}'`);
  });

  it("plan prices and frequency multipliers match the migration", () => {
    for (const p of CARE_PLANS) expect(migration).toMatch(new RegExp(`\\('${p.code}', '${p.name}', ${p.monthlyMinor},`));
    expect(carePriceMinor("essentials", "monthly")).toBe(499);
    expect(carePriceMinor("essentials", "quarterly")).toBe(1497);
    expect(carePriceMinor("essentials", "annual")).toBe(4990);
    expect(carePriceMinor("plus", "annual")).toBe(8990);
    expect(migration).toContain("WHEN 'annual' THEN 10 WHEN 'quarterly' THEN 3 WHEN 'monthly' THEN 1");
    expect(CARE_TERMS_SUMMARY).toContain("£4.99");
    expect(CARE_TERMS_SUMMARY).toContain("£8.99");
  });

  it("Care mandates never use the broadband dd_mandates table", () => {
    expect(migration).not.toMatch(/INSERT INTO public\.dd_mandates/i);
    expect(migration).not.toMatch(/UPDATE public\.dd_mandates/i);
  });

  it("a collection can only be marked paid with a confirmed bank-received date", () => {
    expect(migration).toContain("CHECK (status <> 'paid' OR (paid_confirmed_at IS NOT NULL AND paid_confirmed_by IS NOT NULL AND bank_received_date IS NOT NULL))");
    expect(migration).toContain("bank_received_date_required");
  });
});

describe("OCCTA Care wording", () => {
  it("the wording check catches insurance language (guards against a vacuous test)", () => {
    expect(bannedHits("Your phone is covered if it breaks.").length).toBeGreaterThan(0);
    expect(bannedHits("Make a claim online.").length).toBeGreaterThan(0);
    expect(bannedHits("OCCTA Care is not insurance, so nothing is covered.")).toHaveLength(0);
  });

  it("never describes Care as insurance in terms, plans, FAQ, key facts or the phone script", () => {
    const copy = [
      CARE_TERMS_SUMMARY, ...CARE_TERMS.flatMap((s) => s.points), ...CARE_PLANS.flatMap((p) => [p.tagline, ...p.features]),
      ...CARE_FAQ.flatMap((f) => [f.q, f.a]), ...CARE_NOT_INCLUDED, ...CARE_PHONE_SCRIPT.map((l) => l.line),
      ...careKeyFacts({ planCode: "plus", frequency: "annual", priceMinor: 8990, collectionDay: 15, firstCollectionDate: "15 December 2026" }),
    ].join("\n");
    expect(bannedHits(copy)).toEqual([]);
  });

  it("key facts always say it's not insurance and how to cancel", () => {
    const k = careKeyFacts({ planCode: "essentials", frequency: "monthly", priceMinor: 499, collectionDay: 1 }).join(" ");
    expect(k).toMatch(/not insurance/i);
    expect(k).toMatch(/cancel any time/i);
    expect(k).toMatch(/14-day cooling-off/i);
  });

  it("customer-facing Care pages contain no banned insurance wording", () => {
    const files = [
      ...readdirSync(path.join(root, "src/pages/care")).filter((f) => f.endsWith(".tsx")).map((f) => `src/pages/care/${f}`),
      "src/components/care/CareBits.tsx", "src/components/dashboard/tabs/CareTab.tsx",
    ];
    const hits = files.flatMap((f) => bannedHits(readFileSync(path.join(root, f), "utf8").replace(/className="[^"]*"/g, "")).map((h) => `${f}: ${h}`));
    expect(hits).toEqual([]);
  });

  it("legal rights are never sold as a Care benefit", () => {
    const faq = CARE_FAQ.find((f) => /router/i.test(f.q))!;
    expect(faq.a).toMatch(/every customer/i);
    expect(faq.a).toMatch(/legal right/i);
    expect(faq.a).toMatch(/within 5 working days/);
    expect(CARE_NOT_INCLUDED.join(" ")).toMatch(/doesn't change your legal rights/i);
    // Essentials gets nothing faster than every customer already gets, so it must not list a router swap at all.
    expect(CARE_PLANS.find((p) => p.code === "essentials")!.features.join(" ")).not.toMatch(/router|hub/i);
    // Plus's faster swap is always stated against the standard everyone gets.
    const plusSwap = CARE_PLANS.find((p) => p.code === "plus")!.features.find((f) => /router|hub/i.test(f))!;
    expect(plusSwap).toMatch(/standard for every customer is within 5 working days/);
  });

  it("offers no repairs or repair prices (there is no repair partner)", () => {
    const sales = [...CARE_PLANS.flatMap((p) => [p.tagline, ...p.features]), ...CARE_TERMS.flatMap((s) => s.points), ...CARE_FAQ.map((f) => f.a)].join(" ");
    expect(sales).not.toMatch(/member price|repair partner|repair quote|fixed[- ]price repair/i);
    const brain = readFileSync(path.join(root, "supabase/functions/occta-companion/brain.ts"), "utf8");
    const careLine = brain.split("\n").find((l) => l.startsWith("**OCCTA Care.**"))!;
    expect(careLine).toMatch(/never offer repairs/i);
    expect(careLine).not.toMatch(/(Essentials|Plus)[^.]*member repair prices/i);
  });
});

describe("OCCTA Care money rules (hardening)", () => {
  it("notice counts only once delivered, not when queued", () => {
    expect(hardening).toContain("CREATE OR REPLACE FUNCTION public.care_notice_delivered_on");
    expect(hardening).toMatch(/care_notice_ok\(c\.notice_dedupe, c\.due_date\)/);
    expect(hardening).not.toMatch(/care_working_days_between\(c\.notice_sent_at/);
  });
  it("price and plan changes apply only from their effective period", () => {
    expect(hardening).toContain("pending_price_minor");
    expect(hardening).not.toMatch(/UPDATE public\.care_subscriptions SET price_minor = p_new_minor/);
  });
  it("re-presents only ARUDD 0, and paid needs the return window", () => {
    expect(hardening).toContain("p_reason_code = '0' AND c.kind <> 'represent'");
    expect(hardening).toContain("care_add_working_days(c.due_date, 3)");
  });
  it("Stannp test mode never counts as posted", () => {
    const dispatch = readFileSync(path.join(root, "supabase/functions/care-dispatch/index.ts"), "utf8");
    expect(dispatch).toContain('Deno.env.get("STANNP_MODE") === "live" ? Deno.env.get("STANNP_API_KEY") : undefined');
    expect(dispatch).not.toMatch(/delivery: "stannp", provider_id: sent\.id, posted_on/);
  });
});

describe("OCCTA Care letters", () => {
  it.each(CARE_LETTER_TYPES.map((t) => [t]))("%s builds with a reference and support line, and never offers card payment", (type) => {
    const c = buildCareLetter(type, payloads[type] ?? {}, recipient, new Date("2026-11-02T12:00:00Z"));
    const text = careLetterText(c);
    expect(c.subject).toContain(recipient.reference);
    expect(text).toContain(recipient.reference);
    expect(text).toMatch(/tell us|call us|please call/i);
    expect(text).not.toMatch(/pay by card|card payment|pay now|debit card|credit card/i);
    expect(bannedHits(text)).toEqual([]);
  });

  it("every payment-notice letter carries the Direct Debit Guarantee", () => {
    for (const t of ["dd_confirmation", "advance_notice", "change_notice", "renewal_reminder", "payment_failed"] as const) {
      const c = buildCareLetter(t, payloads[t], recipient);
      expect(c.guarantee, t).toMatch(/Direct Debit Guarantee|Guarantee is offered/);
      expect(c.guarantee).toContain("538166");
      expect(c.guarantee).toContain("10 working days");
    }
  });

  it("letters that keep a member tell them how to cancel", () => {
    for (const t of ["welcome_pack", "dd_confirmation", "advance_notice", "change_notice", "renewal_reminder", "usage_reminder", "payment_failed"] as const) {
      expect(careLetterText(buildCareLetter(t, payloads[t], recipient)), t).toMatch(/cancel/i);
    }
  });

  it("missed-payment letters promise no fees and no debt collectors", () => {
    expect(careLetterText(buildCareLetter("payment_failed", payloads.payment_failed, recipient))).toMatch(/never pass Care balances to debt collectors/);
    expect(careLetterText(buildCareLetter("service_paused", payloads.service_paused, recipient))).toMatch(/don't owe us anything/);
  });

  it("advance notices carry the Bacs contents: amount, date, frequency, reference, notice period, name and phone", () => {
    const t = careLetterText(buildCareLetter("advance_notice", payloads.advance_notice, recipient));
    for (const x of ["£14.97", "15 January 2027", "Every 3 months", "OCCTA CARE-100001", "10 working days", "APS Re OCCTA", "0800 260 6626"]) expect(t, x).toContain(x);
  });

  it("a return that isn't lack of funds promises no automatic re-try", () => {
    const t = careLetterText(buildCareLetter("payment_failed", { ...payloads.payment_failed, reason_code: "4", retry_date: null }, recipient));
    expect(t).toMatch(/won't try to take it again without speaking to you/);
  });

  it("a sale waiting for review gets no payment date in its Direct Debit confirmation", () => {
    const t = careLetterText(buildCareLetter("dd_confirmation", { ...payloads.dd_confirmation, pending_review: true }, recipient));
    expect(t).not.toContain("1 December 2026");
    expect(t).toMatch(/at least 10 working days before/);
  });

  it("the indemnity letter never asks for the money back", () => {
    const t = careLetterText(buildCareLetter("indemnity_followup", payloads.indemnity_followup, recipient));
    expect(t).not.toMatch(/pay it back|bank transfer/i);
    expect(t).toMatch(/don't owe us anything/);
  });

  it("the cancellation confirmation states the refund", () => {
    expect(careLetterText(buildCareLetter("cancellation_confirmation", payloads.cancellation_confirmation, recipient))).toContain("£4.99");
  });
});
