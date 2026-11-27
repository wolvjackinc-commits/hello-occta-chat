import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { seoBusinessSwitchArticles } from "./seoBusinessSwitchArticles";
import { seoGrowthArticles } from "./seoGrowthArticles";
import { seoArticles } from "./seoArticles";
import { learnPages } from "./learnPages";

describe("business switch-off guide cluster", () => {
  it("has unique slugs that don't clash with any other learn page", () => {
    const others = new Set([...seoGrowthArticles, ...seoArticles, ...learnPages].map((p) => p.slug));
    const slugs = seoBusinessSwitchArticles.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(others.has(slug), slug).toBe(false);
  });

  it("is search-ready and substantial", () => {
    for (const a of seoBusinessSwitchArticles) {
      expect(a.title.length, `${a.slug} title`).toBeGreaterThanOrEqual(35);
      expect(a.title.length, `${a.slug} title`).toBeLessThanOrEqual(75);
      expect(a.metaDescription.length, `${a.slug} description`).toBeGreaterThanOrEqual(110);
      expect(a.metaDescription.length, `${a.slug} description`).toBeLessThanOrEqual(180);
      expect(a.sections.length).toBeGreaterThanOrEqual(6);
      expect(a.faqs.length).toBeGreaterThanOrEqual(4);
      expect(a.sources.length).toBeGreaterThanOrEqual(2);
      expect(a.keywords.split(",").length).toBeGreaterThanOrEqual(4);
    }
  });

  it("sends every reader to the free line check", () => {
    for (const a of seoBusinessSwitchArticles) {
      expect(a.primaryCta?.to, a.slug).toBe("/business/line-check");
      expect(a.related[0].to, a.slug).toBe("/business/line-check");
    }
  });

  it("is listed in the learning sitemap and llms.txt", () => {
    const sitemap = readFileSync("public/sitemap-learning.xml", "utf8");
    const llms = readFileSync("public/llms.txt", "utf8");
    for (const a of seoBusinessSwitchArticles) {
      expect(sitemap, a.slug).toContain(`/learn/${a.slug}<`);
      expect(llms, a.slug).toContain(`/learn/${a.slug})`);
    }
  });

  it("avoids payment and commercial claims OCCTA doesn't make", () => {
    const text = JSON.stringify(seoBusinessSwitchArticles).toLowerCase();
    for (const banned of ["pay by card", "card payment to occta", "free installation", "24/7 support", "no contracts", "cancel anytime", "guarantee"]) {
      expect(text, banned).not.toContain(banned);
    }
  });
});
