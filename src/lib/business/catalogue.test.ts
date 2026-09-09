import { describe, expect, it } from "vitest";
import { businessBroadband, businessBundles, businessFAQs } from "@/lib/business/catalogue";

describe("business broadband commercial guardrails", () => {
  it("keeps public broadband anchors at or above the approved v4 marketing floors", () => {
    const floors: Record<string, number> = {
      "biz-sogea-80": 34.99,
      "biz-fttp-160": 39.99,
      "biz-fttp-330": 42.99,
      "biz-fttp-550": 49.99,
      "biz-fttp-1000": 59.99,
    };
    for (const [id, floor] of Object.entries(floors)) {
      const product = businessBroadband.find((p) => p.id === id);
      expect(product, id).toBeTruthy();
      expect(product?.priceExVat, id).toBeGreaterThanOrEqual(floor);
      expect(product?.pricingMode, id).toBe("from");
    }
  });

  it("keeps dedicated connectivity quote-only", () => {
    const dedicated = businessBroadband.find((p) => p.id === "biz-leased-line");
    expect(dedicated?.pricingMode).toBe("quote");
    expect(dedicated?.priceExVat).toBeUndefined();
  });

  it("does not publish unsupported blanket SLA or included-static-IP claims", () => {
    const publicCopy = [
      ...businessBroadband.flatMap((p) => [p.summary, ...p.features]),
      ...businessFAQs.flatMap((f) => [f.q, f.a]),
    ].join(" ").toLowerCase();
    expect(publicCopy).not.toMatch(/4-hour fix|four-hour fix|static ip included|99\.9% uptime sla|zero downtime/);
  });

  it("keeps mixed-service bundles quote-led until every underlying cost is qualified", () => {
    expect(businessBundles.length).toBeGreaterThan(0);
    for (const bundle of businessBundles) {
      expect(bundle.pricingMode, bundle.id).toBe("quote");
      expect(bundle.priceExVat, bundle.id).toBeUndefined();
    }
  });
});