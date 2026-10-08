import { describe, expect, it } from "vitest";
import { normalizePublicPath } from "./normalizePath";
import { buildDocumentTitle } from "./documentTitle";
import { citySeoTitle, locationLocal } from "@/data/locationLocal";
import { locations } from "@/data/locations";

describe("public path canonicalisation", () => {
  it("lowercases static routes and strips a trailing slash", () => {
    expect(normalizePublicPath("/Broadband-Leeds/")).toBe("/broadband-leeds");
    expect(normalizePublicPath("/FAQ")).toBe("/faq");
  });

  it("keeps quote and order tokens intact", () => {
    expect(normalizePublicPath("/quote/AbC123")).toBe("/quote/AbC123");
    expect(normalizePublicPath("/QUOTE/start")).toBe("/quote/start");
    expect(normalizePublicPath("/order/TokEn/complete")).toBe("/order/TokEn/complete");
  });
});

describe("document titles", () => {
  it("does not append a second OCCTA suffix", () => {
    expect(buildDocumentTitle("Help Centre — OCCTA")).toBe("Help Centre — OCCTA");
  });

  it("adds one suffix when the brand is absent", () => {
    expect(buildDocumentTitle("Privacy details")).toBe("Privacy details | OCCTA");
  });
});

describe("city page local content", () => {
  it("covers every city with a unique description and an in-range title", () => {
    expect(Object.keys(locationLocal).sort()).toEqual(locations.map((location) => location.slug).sort());
    const descriptions = new Set<string>();
    for (const location of locations) {
      const local = locationLocal[location.slug];
      expect(local.intro[0]).toBe(local.intro[0].toUpperCase());
      expect(local.metaDescription.length).toBeGreaterThanOrEqual(70);
      expect(local.metaDescription.length).toBeLessThanOrEqual(160);
      expect(descriptions.has(local.metaDescription)).toBe(false);
      descriptions.add(local.metaDescription);
      const title = `${citySeoTitle(location.city)} | OCCTA`;
      expect(title.length).toBeGreaterThanOrEqual(30);
      expect(title.length).toBeLessThanOrEqual(65);
      expect(local.faqs.length).toBeGreaterThanOrEqual(3);
      expect(local.postcodes.length).toBeGreaterThanOrEqual(2);
    }
  });
});
