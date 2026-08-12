import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Guards the SEO correction pass: public-facing marketing copy and the
 * build-time prerender metadata must not reintroduce stale prices or
 * universal contract-free claims (OCCTA sells both Flex 30 and Price Lock 24).
 */
const FILES = [
  "index.html",
  "vite-plugin-prerender.ts",
  "vite-plugin-seo-articles.ts",
  "src/data/keywordPages.ts",
  "src/data/comparisons.ts",
  "src/data/guides.ts",
  "src/data/learnPages.ts",
  "src/data/helpArticles.ts",
  "src/pages/NoContractBroadband.tsx",
  "src/pages/NoContractBroadbandComparison.tsx",
  "src/pages/seo/BroadbandPlans.tsx",
];

const read = (f: string) => fs.readFileSync(path.resolve(process.cwd(), f), "utf-8");

const FORBIDDEN: RegExp[] = [
  /£22\.99/,
  /\\u00A322\.99/,
  /no contracts/i,
  /cancel anytime/i,
  /all (?:occta )?plans are rolling/i,
];

describe("SEO content truth", () => {
  for (const file of FILES) {
    it(`${file} has no stale price or universal contract-free claim`, () => {
      const content = read(file);
      for (const pattern of FORBIDDEN) {
        expect(content, `${file} matched ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it("prerender metadata does not advertise a stale year", () => {
    expect(read("vite-plugin-prerender.ts")).not.toMatch(/2025/);
    expect(read("index.html")).not.toMatch(/2025/);
  });

  it("sitemaps only use the canonical www domain and contain no duplicates", () => {
    for (const f of ["public/sitemap.xml", "public/sitemap-learning.xml"]) {
      const locs = [...read(f).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      expect(locs.length).toBeGreaterThan(0);
      for (const loc of locs) expect(loc.startsWith("https://www.occta.co.uk")).toBe(true);
      expect(new Set(locs).size).toBe(locs.length);
    }
  });

  it("sitemaps exclude private/transactional routes", () => {
    const locs = [...read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const blocked = /^\/(admin|dashboard|auth|checkout|pre-checkout|thank-you|payment-result|pay-invoice|receipt|billing-settings|quote\/)/;
    expect(locs.filter((l) => blocked.test(new URL(l).pathname))).toEqual([]);
  });
});
