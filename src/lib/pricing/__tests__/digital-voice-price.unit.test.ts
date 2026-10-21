import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { FAIR_PRICING_DEFAULTS } from "../fairPricing";
import { voiceProducts } from "../catalogue";
import { getFromPrices, getRetailLandlineCard } from "../engine";
import { SEO_PRICES } from "../constants";

const read = (p: string) => fs.readFileSync(p, "utf8");

// Digital Voice has one customer-facing monthly price: the voice catalogue's
// home-phone-payg retail price. Every copy of it must agree.
const catalogue = voiceProducts.find(v => v.id === "home-phone-payg")!.retailMonthly;

describe("Digital Voice price has one source", () => {
  it("marketing from-prices use the catalogue price", () => {
    expect(getFromPrices().landline).toBe(catalogue.toFixed(2));
    expect(getRetailLandlineCard().fromPriceNum).toBe(catalogue);
    expect(SEO_PRICES.landline).toBe(catalogue.toFixed(2));
  });

  it("Build Plan add-on defaults match the catalogue price", () => {
    expect(FAIR_PRICING_DEFAULTS.addons.digitalVoiceMonthly).toBe(catalogue);
    for (const file of ["supabase/functions/_shared/buildPlanResolver.ts", "src/pages/admin/FairPricing.tsx"]) {
      const m = read(file).match(/digitalVoiceMonthly:\s*([\d.]+)/);
      expect(Number(m?.[1]), file).toBe(catalogue);
    }
  });

  it("marketing pages do not hard-code a Digital Voice price", () => {
    expect(read("src/pages/Broadband.tsx")).not.toMatch(/Digital Voice Add-on[\s\S]{0,200}£\d/);
    expect(read("src/pages/seo/LandlinePlans.tsx")).not.toMatch(/£\d/);
  });
});
