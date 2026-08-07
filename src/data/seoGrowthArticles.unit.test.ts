import { describe, expect, it } from "vitest";
import { seoGrowthArticles } from "./seoGrowthArticles";

const expectedSlugs = [
  "landline-switch-off-2027-uk",
  "what-happens-to-my-landline-in-2027",
  "digital-landline-power-cut",
  "telecare-personal-alarm-digital-landline",
  "keep-landline-number-digital-switch",
  "help-parents-landline-switch",
  "broadband-for-pensioners-uk",
  "broadband-social-tariffs-pension-credit",
  "one-touch-switch-broadband-guide",
  "broadband-deals-uk-how-to-compare",
  "fibre-broadband-deals-uk",
  "broadband-comparison-checklist-uk",
  "broadband-speed-test-uk",
];

describe("SEO growth article cluster", () => {
  it("contains the complete 13-page acquisition cluster with unique slugs", () => {
    expect(seoGrowthArticles).toHaveLength(expectedSlugs.length);
    expect(new Set(seoGrowthArticles.map((article) => article.slug)).size).toBe(expectedSlugs.length);
    expect(seoGrowthArticles.map((article) => article.slug).sort()).toEqual([...expectedSlugs].sort());
  });

  it("keeps titles, descriptions and keyword fields search-ready", () => {
    for (const article of seoGrowthArticles) {
      expect(article.title.length, `${article.slug} title`).toBeGreaterThanOrEqual(35);
      expect(article.title.length, `${article.slug} title`).toBeLessThanOrEqual(75);
      expect(article.metaDescription.length, `${article.slug} description`).toBeGreaterThanOrEqual(110);
      expect(article.metaDescription.length, `${article.slug} description`).toBeLessThanOrEqual(180);
      expect(article.h1.length, `${article.slug} h1`).toBeGreaterThan(20);
      expect(article.keywords.split(",").length, `${article.slug} keywords`).toBeGreaterThanOrEqual(4);
      expect(article.shortAnswer.length, `${article.slug} short answer`).toBeGreaterThan(100);
    }
  });

  it("has substantial useful content, FAQs, conversion links and authoritative sources", () => {
    for (const article of seoGrowthArticles) {
      expect(article.sections.length, `${article.slug} sections`).toBeGreaterThanOrEqual(6);
      expect(article.faqs.length, `${article.slug} faqs`).toBeGreaterThanOrEqual(4);
      expect(article.related.length, `${article.slug} related links`).toBeGreaterThanOrEqual(4);
      expect(article.sources.length, `${article.slug} sources`).toBeGreaterThanOrEqual(2);

      for (const related of article.related) {
        expect(related.to, `${article.slug} related ${related.label}`).toMatch(/^\//);
      }
      for (const source of article.sources) {
        expect(source.url, `${article.slug} source ${source.label}`).toMatch(/^https:\/\//);
      }
    }
  });

  it("does not introduce the legacy blanket commercial claims we are avoiding", () => {
    const text = JSON.stringify(seoGrowthArticles).toLowerCase();
    expect(text).not.toContain("£22.99");
    expect(text).not.toContain("cancel anytime");
    expect(text).not.toContain("all occta plans are rolling monthly");
    expect(text).not.toContain("no contracts");
    expect(text).not.toContain("free installation");
    expect(text).not.toContain("24/7 support");
  });

  it("uses current 2027 switch-off and safety wording on the critical pages", () => {
    const switchPage = seoGrowthArticles.find((article) => article.slug === "landline-switch-off-2027-uk");
    const powerPage = seoGrowthArticles.find((article) => article.slug === "digital-landline-power-cut");
    const telecarePage = seoGrowthArticles.find((article) => article.slug === "telecare-personal-alarm-digital-landline");

    expect(JSON.stringify(switchPage)).toContain("31 January 2027");
    expect(JSON.stringify(powerPage).toLowerCase()).toContain("one hour");
    expect(JSON.stringify(telecarePage).toLowerCase()).toContain("compatible");
    expect(JSON.stringify(telecarePage).toLowerCase()).toContain("functioning");
  });
});
