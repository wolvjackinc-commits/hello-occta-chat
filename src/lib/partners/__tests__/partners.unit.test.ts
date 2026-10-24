import { describe, expect, it } from "vitest";
import { parseCampaignTouch, normaliseReferenceCode } from "@/lib/campaignAttribution";
import {
  partnerAttributionSearch,
  partnerErrorMessage,
  partnerShortUrl,
  suggestPartnerCode,
  summariseReferrals,
  validPartnerCode,
  type PartnerReferral,
} from "@/lib/partners/partners";

const NOW = Date.parse("2026-10-24T12:00:00.000Z");

function referral(overrides: Partial<PartnerReferral>): PartnerReferral {
  return {
    partner_id: "p1",
    partner_code: "VANILLA",
    partner_name: "Vanilla Lettings",
    order_id: crypto.randomUUID(),
    order_number: null,
    order_created_at: "2026-10-01T10:00:00Z",
    customer_id: "c1",
    plan_name: "Essential",
    order_status: "active",
    lifecycle_status: "live",
    attributed_by: "link",
    paid_invoices: 0,
    in_arrears: false,
    cancelled: false,
    commission_amount: 25,
    commission_status: "awaiting_payments",
    status_reason: "0 of 2 payments received",
    paid_on: null,
    bank_reference: null,
    ...overrides,
  };
}

describe("suggestPartnerCode", () => {
  it("drops company suffixes and generic lettings words", () => {
    expect(suggestPartnerCode("Vanilla Lettings Limited")).toBe("VANILLA");
    expect(suggestPartnerCode("Harvey & Ryall")).toBe("HARVEYRYALL");
    expect(suggestPartnerCode("Go Haven Ltd")).toBe("GOHAVEN");
  });

  it("always returns a code the order form accepts", () => {
    for (const name of ["Lettings Ltd", "A", "Ölçü Estates", "Huddersfield Sales + Lettings", "   "]) {
      const code = suggestPartnerCode(name);
      expect(normaliseReferenceCode(code)).toBe(code);
    }
  });

  it("caps long names", () => {
    expect(suggestPartnerCode("Extraordinarily Longnamed Property Management Group").length).toBeLessThanOrEqual(12);
  });
});

describe("validPartnerCode", () => {
  it("normalises case and rejects bad input", () => {
    expect(validPartnerCode(" vanilla ")).toBe("VANILLA");
    expect(validPartnerCode("ab")).toBeNull();
    expect(validPartnerCode("has space")).toBeNull();
  });
});

describe("partner links", () => {
  it("builds the short link used on QR codes", () => {
    expect(partnerShortUrl("VANILLA")).toBe("https://www.occta.co.uk/p/VANILLA");
  });

  it("produces a query the first-touch capture records as the partner", () => {
    const touch = parseCampaignTouch({
      search: partnerAttributionSearch("VANILLA"),
      pathname: "/p/VANILLA",
      hostname: "www.occta.co.uk",
      consentGranted: false,
      now: NOW,
    });
    expect(touch.cc).toBe("VANILLA");
    expect(touch.utm_source).toBe("partner");
    expect(touch.utm_medium).toBe("letting_agent");
    expect(touch.source_type).toBe("campaign");
  });
});

describe("summariseReferrals", () => {
  it("splits commission into due, paid and pending", () => {
    const rows = [
      referral({ commission_status: "eligible" }),
      referral({ commission_status: "eligible", commission_amount: 30 }),
      referral({ commission_status: "paid" }),
      referral({ commission_status: "awaiting_payments" }),
      referral({ commission_status: "not_eligible" }),
    ];
    expect(summariseReferrals(rows)).toEqual({ referrals: 5, due: 55, paid: 25, pending: 25 });
  });
});

describe("partnerErrorMessage", () => {
  it("explains database guard errors", () => {
    expect(partnerErrorMessage({ message: "partner_code_reserved_by_offer" })).toMatch(/promotion/);
    expect(partnerErrorMessage({ message: "not_eligible: 1 of 2 payments received" })).toBe("Not eligible yet: 1 of 2 payments received.");
    expect(partnerErrorMessage(new Error("already_paid"))).toMatch(/already been paid/);
  });
});
