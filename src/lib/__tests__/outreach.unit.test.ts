import { describe, expect, it } from "vitest";
import {
  classifyEmailType,
  classifySendStatus,
  collectLinks,
  complianceFooterHtml,
  complianceFooterText,
  generateOutreachToken,
  isOutreachEligible,
  isOwnSiteUrl,
  isSuspectedBot,
  isWithinSendWindow,
  legalFormFromHint,
  listUnsubscribeHeaders,
  normaliseEmail,
  readOnSiteClick,
  outreachIneligibleReason,
  renderPlaceholders,
  retryDelayMinutes,
  rewriteLinksForTracking,
  sendAllowance,
  slugify,
  startOfZonedDay,
  unknownPlaceholders,
  withCampaignParams,
  withOnSiteClickTracking,
  withRecipientTerm,
  wrapEmailHtml,
  OUTREACH_PLACEHOLDERS,
} from "../../../supabase/functions/_shared/outreach.ts";

const corporate = {
  status: "active",
  lawful_basis: "corporate_subscriber",
  companies_house_verified: true,
  companies_house_number: "08579561",
  legal_form: "limited_company",
  email_type: "role",
  consent_evidence: null,
};

describe("outreach eligibility (PECR reg. 22)", () => {
  it("allows a verified limited company with a role inbox", () => {
    expect(isOutreachEligible(corporate)).toBe(true);
    expect(outreachIneligibleReason(corporate)).toBeNull();
  });

  it("blocks sole traders and partnerships without consent", () => {
    for (const legal_form of ["sole_trader", "partnership", "unknown", "charity_unincorporated"]) {
      const c = { ...corporate, legal_form };
      expect(isOutreachEligible(c)).toBe(false);
      expect(outreachIneligibleReason(c)).toMatch(/company/i);
    }
  });

  it("blocks unverified companies and named-person inboxes", () => {
    expect(isOutreachEligible({ ...corporate, companies_house_verified: false })).toBe(false);
    expect(isOutreachEligible({ ...corporate, companies_house_number: null })).toBe(false);
    expect(isOutreachEligible({ ...corporate, email_type: "personal" })).toBe(false);
  });

  it("blocks unsubscribed, bounced and complained contacts", () => {
    for (const status of ["unsubscribed", "bounced", "complained", "do_not_contact"]) {
      expect(isOutreachEligible({ ...corporate, status })).toBe(false);
    }
  });

  it("allows consent only with evidence", () => {
    const consent = { ...corporate, legal_form: "sole_trader", lawful_basis: "consent", consent_evidence: null };
    expect(isOutreachEligible(consent)).toBe(false);
    expect(isOutreachEligible({ ...consent, consent_evidence: "   " })).toBe(false);
    expect(isOutreachEligible({ ...consent, consent_evidence: "Signed form at Huddersfield expo 2026-10-01" })).toBe(true);
  });

  it("requires a lawful basis", () => {
    expect(isOutreachEligible({ ...corporate, lawful_basis: "none" })).toBe(false);
  });
});

describe("contact import helpers", () => {
  it("normalises and validates emails", () => {
    expect(normaliseEmail("  Info@Example.CO.UK ")).toBe("info@example.co.uk");
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(normaliseEmail("a@b")).toBeNull();
    expect(normaliseEmail(42)).toBeNull();
  });

  it("classifies role and personal inboxes", () => {
    expect(classifyEmailType("info@x.co.uk")).toBe("role");
    expect(classifyEmailType("customer.service@x.co.uk")).toBe("role");
    expect(classifyEmailType("john.smith@x.co.uk")).toBe("personal");
  });

  it("maps spreadsheet legal-form hints conservatively", () => {
    expect(legalFormFromHint("limited company")).toBe("limited_company");
    expect(legalFormFromHint("limited company? (name suffix; not verified at Companies House)")).toBe("unknown");
    expect(legalFormFromHint("limited company (charity/CIC? see source)")).toBe("unknown");
    expect(legalFormFromHint("charity (unincorporated / not matched to Companies House)")).toBe("charity_unincorporated");
    expect(legalFormFromHint("unknown")).toBe("unknown");
    expect(legalFormFromHint(null)).toBe("unknown");
  });

  it("slugifies campaign names", () => {
    expect(slugify("Last orders — Huddersfield Oct 2026!")).toBe("last-orders-huddersfield-oct-2026");
    expect(slugify("!!!")).toBe("campaign");
  });

  it("generates unique URL-safe tokens", () => {
    const a = generateOutreachToken();
    const b = generateOutreachToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });
});

describe("send window and caps (Europe/London)", () => {
  const w = { window_start_hour: 9, window_end_hour: 17, weekdays_only: true };

  it("respects BST and GMT hours", () => {
    // Mon 12 Oct 2026 08:30 UTC = 09:30 BST
    expect(isWithinSendWindow(new Date("2026-10-12T08:30:00Z"), w)).toBe(true);
    // 07:30 UTC = 08:30 BST
    expect(isWithinSendWindow(new Date("2026-10-12T07:30:00Z"), w)).toBe(false);
    // Mon 2 Nov 2026 16:30 UTC = 16:30 GMT
    expect(isWithinSendWindow(new Date("2026-11-02T16:30:00Z"), w)).toBe(true);
    expect(isWithinSendWindow(new Date("2026-11-02T17:00:00Z"), w)).toBe(false);
  });

  it("skips weekends when configured", () => {
    expect(isWithinSendWindow(new Date("2026-10-17T10:00:00Z"), w)).toBe(false);
    expect(isWithinSendWindow(new Date("2026-10-17T10:00:00Z"), { ...w, weekdays_only: false })).toBe(true);
  });

  it("finds London midnight in both seasons", () => {
    expect(startOfZonedDay(new Date("2026-10-12T15:00:00Z")).toISOString()).toBe("2026-10-11T23:00:00.000Z");
    expect(startOfZonedDay(new Date("2026-11-02T15:00:00Z")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    // 00:30 BST is still the same London day
    expect(startOfZonedDay(new Date("2026-10-11T23:30:00Z")).toISOString()).toBe("2026-10-11T23:00:00.000Z");
  });

  it("never exceeds daily, hourly or batch caps", () => {
    expect(sendAllowance({ dailyCap: 30, hourlyCap: 15, sentToday: 0, sentLastHour: 0 })).toBe(15);
    expect(sendAllowance({ dailyCap: 30, hourlyCap: 15, sentToday: 28, sentLastHour: 0 })).toBe(2);
    expect(sendAllowance({ dailyCap: 30, hourlyCap: 15, sentToday: 40, sentLastHour: 0 })).toBe(0);
    expect(sendAllowance({ dailyCap: 500, hourlyCap: 200, sentToday: 0, sentLastHour: 0, maxBatch: 25 })).toBe(25);
  });
});

describe("rendering", () => {
  it("escapes values in HTML and leaves text raw", () => {
    const vars = { business_name: `Tom & Jerry's <Cafe>` };
    expect(renderPlaceholders("Hi {{business_name}}", vars, "html")).toBe("Hi Tom &amp; Jerry&#39;s &lt;Cafe&gt;");
    expect(renderPlaceholders("Hi {{ business_name }}", vars, "text")).toBe("Hi Tom & Jerry's <Cafe>");
    expect(renderPlaceholders("{{missing}}!", vars, "text")).toBe("!");
  });

  it("reports placeholders the sender cannot fill", () => {
    expect(unknownPlaceholders("{{business_name}} {{first_name}} {{cta_url}}", OUTREACH_PLACEHOLDERS)).toEqual(["first_name"]);
  });

  it("tags only our own links with campaign parameters", () => {
    const p = { utmCampaign: "last-orders-oct", utmContent: "last-orders-landline", flyerRef: "LAST-A" };
    const ours = new URL(withCampaignParams("https://www.occta.co.uk/business/contact-sales", p));
    expect(ours.searchParams.get("utm_source")).toBe("occta_outreach");
    expect(ours.searchParams.get("utm_medium")).toBe("email");
    expect(ours.searchParams.get("utm_campaign")).toBe("last-orders-oct");
    expect(ours.searchParams.get("cc")).toBe("LAST-A");
    expect(withCampaignParams("https://www.openreach.com/x", p)).toBe("https://www.openreach.com/x");
    expect(withRecipientTerm("https://www.occta.co.uk/a?x=1", "TOKEN123")).toBe("https://www.occta.co.uk/a?x=1&utm_term=ob-TOKEN123");
    expect(withRecipientTerm("https://example.com/a", "TOKEN123")).toBe("https://example.com/a");
  });

  it("collects and rewrites links for click tracking", () => {
    const html = `<a href="https://www.occta.co.uk/a?x=1&amp;y=2">A</a> <a href="https://example.com/b">B</a> <a href="https://www.occta.co.uk/a?x=1&amp;y=2">A2</a> <a href="mailto:hi@x.com">M</a>`;
    const links = collectLinks(html);
    expect(links).toEqual(["https://www.occta.co.uk/a?x=1&y=2", "https://example.com/b"]);
    const out = rewriteLinksForTracking(html, links, (i) => `https://t.example/c?t=abc&l=${i}`);
    expect(out).toContain(`href="https://t.example/c?t=abc&amp;l=0"`);
    expect(out).toContain(`href="https://t.example/c?t=abc&amp;l=1"`);
    expect(out).toContain(`href="mailto:hi@x.com"`);
  });

  it("includes identity, unsubscribe and privacy information in every footer", () => {
    const f = {
      businessName: "Fixby Healthcare Ltd",
      postalAddress: "OCCTA Limited, 22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom",
      unsubscribeUrl: "https://x.supabase.co/functions/v1/outreach-unsubscribe?t=abc",
      privacyUrl: "https://www.occta.co.uk/privacy",
    };
    const html = complianceFooterHtml(f);
    const text = complianceFooterText(f);
    for (const s of [html, text]) {
      expect(s).toContain("Unsubscribe");
      expect(s).toContain("13828933");
      expect(s).toContain("22 Pavilion View");
      expect(s).toContain("privacy");
    }
    expect(html).toContain(`href="https://x.supabase.co/functions/v1/outreach-unsubscribe?t=abc"`);
  });

  it("wraps the body with the call to action, preheader and pixel", () => {
    const html = wrapEmailHtml({
      subject: "S",
      preheader: "Pre",
      bodyHtml: "<p>Body</p>",
      ctaLabel: "Book",
      ctaUrl: "https://t/c?l=0",
      heroImageUrl: null,
      footerHtml: "<p>Footer</p>",
      pixelUrl: "https://t/o?t=abc",
    });
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain(">Book</a>");
    expect(html).toContain("Pre");
    expect(html).toContain(`src="https://t/o?t=abc"`);
    expect(html.indexOf("<p>Footer</p>")).toBeGreaterThan(html.indexOf("<p>Body</p>"));
    expect(html).toContain("FOR UK BUSINESS");
  });

  it("uses the flyer image instead of the logo bar when there is one", () => {
    const html = wrapEmailHtml({
      subject: "Is X ready?",
      preheader: null,
      bodyHtml: "<p>Body</p>",
      ctaLabel: "Book",
      ctaUrl: "https://www.occta.co.uk/b",
      heroImageUrl: "https://www.occta.co.uk/email/hero.jpg",
      footerHtml: "",
      pixelUrl: null,
    });
    expect(html).toContain(`src="https://www.occta.co.uk/email/hero.jpg"`);
    expect(html).toContain(`alt="Is X ready?"`);
    expect(html).not.toContain("FOR UK BUSINESS");
  });

  it("tracks clicks on our own site without a redirect domain", () => {
    const url = withOnSiteClickTracking("https://www.occta.co.uk/business/contact-sales?utm_source=occta_outreach", "TOKEN1234567890abcd", 2);
    const u = new URL(url);
    expect(u.hostname).toBe("www.occta.co.uk");
    expect(u.searchParams.get("utm_term")).toBe("ob-TOKEN1234567890abcd");
    expect(readOnSiteClick(u.search)).toEqual({ token: "TOKEN1234567890abcd", link: 2 });
    expect(withOnSiteClickTracking("https://example.com/x", "TOKEN1234567890abcd", 0)).toBe("https://example.com/x");
    expect(isOwnSiteUrl("https://occta.co.uk/a")).toBe(true);
    expect(isOwnSiteUrl("https://evil.example/occta.co.uk")).toBe(false);
    expect(readOnSiteClick("?ot=short&ol=1")).toBeNull();
    expect(readOnSiteClick("?ot=TOKEN1234567890abcd&ol=abc")).toBeNull();
    expect(readOnSiteClick("?ot=TOKEN1234567890abcd&ol=500")).toBeNull();
    expect(readOnSiteClick("")).toBeNull();
  });

  it("builds RFC 8058 one-click unsubscribe headers", () => {
    const h = listUnsubscribeHeaders("https://t/u?t=abc", "unsubscribe@occta.co.uk");
    expect(h["List-Unsubscribe"]).toBe("<https://t/u?t=abc>, <mailto:unsubscribe@occta.co.uk?subject=unsubscribe>");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("provider responses and engagement quality", () => {
  it("classifies Resend statuses", () => {
    expect(classifySendStatus(200)).toBe("sent");
    expect(classifySendStatus(429)).toBe("rate_limited");
    expect(classifySendStatus(403)).toBe("pause_campaign");
    expect(classifySendStatus(401)).toBe("pause_campaign");
    expect(classifySendStatus(422)).toBe("failed");
    expect(classifySendStatus(500)).toBe("retry");
  });

  it("backs off retries", () => {
    expect([1, 2, 3].map(retryDelayMinutes)).toEqual([5, 15, 45]);
  });

  it("flags scanner hits but not real engagement", () => {
    const sentAt = "2026-10-12T10:00:00Z";
    expect(isSuspectedBot({ userAgent: "Mozilla/5.0 (iPhone)", sentAt, now: new Date("2026-10-12T10:00:01Z"), type: "open" })).toBe(true);
    expect(isSuspectedBot({ userAgent: "Mozilla/5.0 (iPhone)", sentAt, now: new Date("2026-10-12T10:05:00Z"), type: "open" })).toBe(false);
    expect(isSuspectedBot({ userAgent: "Mimecast URL protect", sentAt, now: new Date("2026-10-12T12:00:00Z"), type: "click" })).toBe(true);
    expect(isSuspectedBot({ userAgent: "Mozilla/5.0", sentAt, now: new Date("2026-10-12T10:00:05Z"), type: "click" })).toBe(true);
    expect(isSuspectedBot({ userAgent: null, sentAt: null, now: new Date(), type: "open" })).toBe(false);
  });
});
