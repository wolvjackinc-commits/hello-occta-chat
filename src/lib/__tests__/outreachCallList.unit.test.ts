import { describe, expect, it } from "vitest";
import { engagementLabel, isCallable, rankCallList, telHref, type CallListRow } from "../outreach/callList";

const base = (over: Partial<CallListRow> = {}): CallListRow => ({
  id: "m1",
  campaign_id: "c1",
  email: "info@example.co.uk",
  business_name: "Example Ltd",
  sent_at: "2026-10-20T09:00:00Z",
  first_opened_at: "2026-10-20T10:00:00Z",
  open_count: 1,
  first_clicked_at: null,
  click_count: 0,
  replied_at: null,
  converted_at: null,
  unsubscribed_at: null,
  bounced_at: null,
  complained_at: null,
  contact: { phone: "01484 123456", category: "Retail", area: "LEEDS", district: null, website: null },
  ...over,
});

describe("isCallable", () => {
  it("needs an open or click and a phone number", () => {
    expect(isCallable(base())).toBe(true);
    expect(isCallable(base({ first_opened_at: null }))).toBe(false);
    expect(isCallable(base({ contact: { phone: null, category: null, area: null, district: null, website: null } }))).toBe(false);
  });
  it("leaves out people who unsubscribed, bounced or complained", () => {
    expect(isCallable(base({ unsubscribed_at: "2026-10-21T00:00:00Z" }))).toBe(false);
    expect(isCallable(base({ bounced_at: "2026-10-21T00:00:00Z" }))).toBe(false);
    expect(isCallable(base({ complained_at: "2026-10-21T00:00:00Z" }))).toBe(false);
  });
});

describe("rankCallList", () => {
  it("puts clickers first, then repeat openers, and done contacts last", () => {
    const rows = [
      base({ id: "single", open_count: 1 }),
      base({ id: "done", first_clicked_at: "2026-10-20T11:00:00Z", click_count: 1, replied_at: "2026-10-22T00:00:00Z" }),
      base({ id: "repeat", open_count: 4 }),
      base({ id: "clicker", first_clicked_at: "2026-10-20T11:00:00Z", click_count: 1 }),
    ];
    expect(rankCallList(rows).map((r) => r.id)).toEqual(["clicker", "repeat", "single", "done"]);
  });
});

describe("labels and links", () => {
  it("describes engagement", () => {
    expect(engagementLabel(base({ open_count: 3 }))).toBe("Opened 3×");
    expect(engagementLabel(base({ first_clicked_at: "x", click_count: 1 }))).toBe("Clicked");
    expect(engagementLabel(base({ converted_at: "x" }))).toBe("Enquired");
  });
  it("builds a dialable tel: link", () => {
    expect(telHref("01484 123 456")).toBe("tel:01484123456");
    expect(telHref("+44 (0)1484 123456")).toBe("tel:+441484123456");
  });
});
