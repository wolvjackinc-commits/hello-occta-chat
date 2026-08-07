import { describe, expect, it } from "vitest";
import {
  expandedAccountIntent,
  expandedPublicIntent,
  guideLinksMarkdown,
  matchOcctaGuides,
  normaliseOcctaText,
} from "../../../supabase/functions/_shared/occtaResolution.ts";

describe("Ollie V4 production transcript resolution", () => {
  it("recognises the exact owe-money wording and typo from the production transcript", () => {
    expect(expandedAccountIntent("DO I OWN YOU ANY MONEY")).toBe("invoices");
    expect(expandedAccountIntent("do i owe you any money?")).toBe("invoices");
  });

  it("recognises Huddersfield availability as an availability question", () => {
    expect(expandedPublicIntent("is occta available at huddersfield")).toBe("availability");
  });

  it("normalises the OCCRTA typo and recognises a BT speed comparison", () => {
    expect(normaliseOcctaText("IS OCCRTA FAST FROM bt?")).toContain("occta");
    expect(expandedPublicIntent("IS OCCRTA FAST FROM bt?")).toBe("provider_comparison");
  });

  it("maps how-to requests to real OCCTA help pages", () => {
    const guides = matchOcctaGuides("how do i fix my internet when the router light is red", "no_internet", 3);
    expect(guides.map((guide) => guide.slug)).toContain("no-internet-troubleshooting");
    expect(guides.map((guide) => guide.slug)).toContain("router-setup");
  });

  it("only generates OCCTA help-centre destinations for guide links", () => {
    const markdown = guideLinksMarkdown("slow wifi", "slow_wifi", 3);
    expect(markdown).toContain("https://www.occta.co.uk/help/");
    expect(markdown).not.toMatch(/https:\/\/(?!www\.occta\.co\.uk)/i);
  });

  it("finds billing guidance without confusing it with broadband troubleshooting", () => {
    const guides = matchOcctaGuides("explain my first bill", "first_invoice", 2);
    expect(guides[0]?.slug).toBe("first-invoice-explained-help");
    expect(guides.some((guide) => guide.slug === "no-internet-troubleshooting")).toBe(false);
  });
});
