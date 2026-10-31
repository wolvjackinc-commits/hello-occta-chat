import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  REFERRAL_RULES, REFERRAL_TERMS_SUMMARY, REFERRAL_TERMS_VERSION, referralLink, referralReasonLabel, referralStatusLabel, formatReward,
} from "@/lib/referral/terms";
import { allowedActions, disputeReply, monthlyReportCsv, type MonthlyReport } from "@/lib/referral/admin";
import { REFERRAL_TEMPLATES, referralCopy, renderReferralMessage, isReferralWorkerAuthorized } from "../../../../supabase/functions/_shared/referralMessages";
import { mergeReferralCredit, parseReferralCreditRows } from "../../../../supabase/functions/_shared/referralCredit";
import { handleReferralDelivery } from "../../../../supabase/functions/_shared/referralDelivery";

const migration = readFileSync(path.resolve(__dirname, "../../../../supabase/migrations/20261031150000_referral_scheme.sql"), "utf8");
const termsInsert = migration.slice(migration.indexOf("INSERT INTO public.referral_terms_versions"), migration.indexOf("ON CONFLICT (version) DO NOTHING"));
const rulesJson = JSON.parse(termsInsert.slice(termsInsert.indexOf("'{") + 1, termsInsert.lastIndexOf("}'") + 1));

describe("terms: website copy matches the database snapshot", () => {
  it("same version and same summary text", () => {
    expect(termsInsert).toContain(`'${REFERRAL_TERMS_VERSION}'`);
    expect(termsInsert).toContain(REFERRAL_TERMS_SUMMARY);
  });
  it("same numbers (decisions A–E)", () => {
    expect(rulesJson.qualify_days).toBe(REFERRAL_RULES.qualifyDays);
    expect(rulesJson.invoices_required).toBe(REFERRAL_RULES.invoicesRequired);
    expect(rulesJson.caps).toEqual(REFERRAL_RULES.caps);
    expect(rulesJson.rewards).toEqual(REFERRAL_RULES.rewards);
    expect(rulesJson.clawback_months).toBe(REFERRAL_RULES.clawbackMonths);
    expect(rulesJson.unpaid_clawback_days).toBe(REFERRAL_RULES.unpaidClawbackDays);
    expect(rulesJson.credit_expiry_months).toBe(REFERRAL_RULES.creditExpiryMonths);
    expect(rulesJson.manual_attach_days).toBe(REFERRAL_RULES.manualAttachDays);
    expect(rulesJson.new_customer_lookback_months).toBe(REFERRAL_RULES.newCustomerLookbackMonths);
    expect(rulesJson.charge_back_used_credit).toBe(false); // decision D
    expect(rulesJson.allow_promotion_stacking).toBe(false);
  });
  it("summary says bill credit only, never cash, and that history counts", () => {
    expect(REFERRAL_TERMS_SUMMARY).toMatch(/Bill credit only, never cash/);
    expect(REFERRAL_TERMS_SUMMARY).toMatch(/up to date with payments the whole time/);
  });
});

describe("customer-facing labels", () => {
  it("never calls a pre-approval reward confirmed", () => {
    for (const s of ["tracked", "pending", "qualifying", "approved_awaiting_admin"]) {
      const l = referralStatusLabel(s, "referrer");
      expect(l.tone).toBe("wait");
      expect(l.label.toLowerCase()).not.toMatch(/added|approved|ready|confirmed|earned/);
    }
    expect(referralStatusLabel("booked", "referrer").label).toBe("Credit added");
  });
  it("reason labels only translate machine codes; admin free text is never shown", () => {
    expect(referralReasonLabel("referrer_payment_history:late_or_unpaid_invoice:INV-1")).toMatch(/late or returned/);
    expect(referralReasonLabel("Customer rang and was rude to staff")).toBe("Reviewed by our team");
    expect(referralReasonLabel(null)).toBeNull();
  });
  it("link carries the code as cc (captured before ordering)", () => {
    expect(referralLink("abcd2345")).toBe("https://www.occta.co.uk/?cc=ABCD2345&ref=ABCD2345");
    expect(formatReward(25, "gross")).toBe("£25");
    expect(formatReward(25, "net")).toBe("£25 + VAT");
  });
});

describe("emails: only five, and no promise before approval", () => {
  const base = { code: "ABCD2345", summary: REFERRAL_TERMS_SUMMARY, terms_version: REFERRAL_TERMS_VERSION, terms_url: "https://www.occta.co.uk/legal/refer-a-friend-terms" };
  it("exactly the five allowed templates", () => {
    expect([...REFERRAL_TEMPLATES]).toEqual(["your_code", "friend_joined", "reward_credited", "credit_expiring", "reward_withdrawn"]);
    expect(() => referralCopy("ready_for_payment", base)).toThrow("unknown_template");
  });
  it("your code always carries the summary, terms link and version", () => {
    const m = renderReferralMessage("your_code", base);
    expect(m.text).toContain(REFERRAL_TERMS_SUMMARY);
    expect(m.text).toContain(REFERRAL_TERMS_VERSION);
    expect(m.text).toContain("/legal/refer-a-friend-terms");
  });
  it("friend joined says pending, not a reward, and repeats the conditions", () => {
    const m = renderReferralMessage("friend_joined", { referral_ref: "RF-1", amount: 25, amount_basis: "gross", qualify_days: 60, invoices_required: 2, terms_version: REFERRAL_TERMS_VERSION });
    expect(m.text).toMatch(/isn't a reward yet/);
    expect(m.text).toMatch(/only confirmed after/);
    expect(m.text).toMatch(/once an OCCTA team member has confirmed it/);
    expect(m.text.toLowerCase()).not.toMatch(/ready for payment|you will receive|you'll receive|has been approved/);
  });
  it("withdrawn needs a reason and carries the complaints and ADR route", () => {
    expect(() => referralCopy("reward_withdrawn", { amount: 25, amount_basis: "gross" })).toThrow("reason_required");
    const m = renderReferralMessage("reward_withdrawn", { amount: 25, amount_basis: "gross", reason: "A Direct Debit on the account was returned.", reward_ref: "RR-1" });
    expect(m.text).toMatch(/Complaints Code/);
    expect(m.text).toMatch(/Alternative Dispute Resolution/);
  });
  it("payment wording never mentions card or phone payment", () => {
    for (const t of REFERRAL_TEMPLATES) {
      const p = { ...base, referral_ref: "RF-1", reward_ref: "RR-1", amount: 25, amount_basis: "gross" as const, balance_minor: 500, expires_at: "2027-11-01T00:00:00Z", reason: "Explained reason for the customer." };
      const text = renderReferralMessage(t, p).text.toLowerCase();
      expect(text).not.toMatch(/\bcard\b|pay by phone|pay now/);
    }
  });
  it("worker secret must be long and exact", () => {
    expect(isReferralWorkerAuthorized("x", "x")).toBe(false);
    const s = "a".repeat(40);
    expect(isReferralWorkerAuthorized(s, s)).toBe(true);
    expect(isReferralWorkerAuthorized(null, s)).toBe(false);
  });
});

describe("delivery worker", () => {
  const secret = "s".repeat(40);
  const req = () => new Request("https://x/referral-message-worker", { method: "POST", headers: { "x-cron-secret": secret } });
  it("re-checks relevance right before sending and suppresses held messages", async () => {
    const finish = vi.fn(async () => true);
    const send = vi.fn();
    const res = await handleReferralDelivery(req(), {
      secret, enabled: "true", apiKey: "k", send: send as unknown as typeof fetch,
      getStore: () => ({
        claim: async () => ({ messages: [{ id: "m1", lease_token: "l1", template: "reward_credited", payload: { recipient_email: "a@b.c", amount: 25, amount_basis: "gross" } }] }),
        stillRelevant: async () => false,
        finish,
      }),
    });
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith("m1", "l1", null, "superseded");
    expect(await res.json()).toMatchObject({ ok: true, suppressed: 1, sent: 0 });
  });
  it("does nothing while emails are switched off", async () => {
    const res = await handleReferralDelivery(req(), { secret, enabled: "false", apiKey: "k", send: fetch, getStore: () => { throw new Error("must not run"); } });
    expect(await res.json()).toMatchObject({ disabled: true });
  });
});

describe("invoice credit lines", () => {
  const totals = {
    lines: [{ description: "Monthly", period_label: null, net_minor: 2499, vat_minor: 500, gross_minor: 2999, vat_rate: 20 }],
    subtotal_net_minor: 2499, vat_total_minor: 500, total_gross_minor: 2999, vat_rate: 20,
  } as unknown as Parameters<typeof mergeReferralCredit>[0];
  it("adds a negative line that lowers VAT as well as the gross", () => {
    const rows = parseReferralCreditRows([{ reward_id: "r", description: "Referral credit – friend OCC1 (ref RR-1)", gross_minor: -2500, net_minor: -2083, vat_rate: 20 }]);
    const out = mergeReferralCredit(totals, rows);
    expect(out.total_gross_minor).toBe(499);
    expect(out.vat_total_minor).toBe(500 - 417);
    expect(out.lines.at(-1)?.description).toMatch(/^Referral credit – friend OCC1 \(ref RR-1\)$/);
  });
  it("refuses positive credit rows and credit bigger than the bill", () => {
    expect(() => parseReferralCreditRows([{ gross_minor: 100, net_minor: 83 }])).toThrow("referral_credit_row_invalid");
    expect(() => mergeReferralCredit(totals, parseReferralCreditRows([{ gross_minor: -5000, net_minor: -4167 }]))).toThrow("referral_credit_exceeds_invoice");
  });
});

describe("admin helpers", () => {
  it("approve is only offered for awaiting-admin rewards that aren't on hold", () => {
    expect(allowedActions({ status: "approved_awaiting_admin", hold: false, needs_review: false })).toContain("approve");
    expect(allowedActions({ status: "approved_awaiting_admin", hold: true, needs_review: false })).not.toContain("approve");
    expect(allowedActions({ status: "qualifying", hold: false, needs_review: false })).not.toContain("approve");
    expect(allowedActions({ status: "booked", hold: false, needs_review: false })).toEqual(expect.arrayContaining(["reverse", "claw_back", "hold"]));
  });
  it("dispute replies always include the complaints code and ADR", () => {
    for (const o of ["upheld", "rejected", "goodwill"] as const) {
      const t = disputeReply(o, "RD-1", "Checked the click and order records.", REFERRAL_TERMS_VERSION);
      expect(t).toMatch(/Complaints Code/); expect(t).toMatch(/Alternative Dispute Resolution/); expect(t).toContain(REFERRAL_TERMS_VERSION);
    }
  });
  it("monthly CSV is in pounds and lists liability and cost per customer", () => {
    const r: MonthlyReport = {
      month: "2026-12", minor: { booked: 3500, applied: 2500, unapplied: 0, expired: 0, reversed: 1000, clawed_back: 0 },
      liability_minor_at_month_end: 0, customers_acquired: 1, cost_per_acquired_customer_minor: 3500,
      goodwill_booked_minor: 0, awaiting_review_now: 2, open_disputes_now: 0,
    };
    const csv = monthlyReportCsv(r);
    expect(csv).toContain("2026-12,credit_booked,35.00");
    expect(csv).toContain("cost_per_acquired_customer,35.00");
    expect(csv).toContain("outstanding_credit_liability_at_month_end,0.00");
  });
});
