import { describe, expect, it } from "vitest";
import { addonCatalogue, portingOptions, voiceProducts } from "../catalogue";
import { OLLIE_CALL_PRICING } from "../../../../supabase/functions/_shared/callPricing";

// Ollie quotes phone and call prices from callPricing.ts. They must match the catalogue.
describe("Ollie call pricing matches the catalogue", () => {
  const voice = (id: string) => voiceProducts.find((v) => v.id === id)!;
  const addon = (id: string) => addonCatalogue.find((a) => a.id === id)!;

  it("home phone plans", () => {
    for (const plan of OLLIE_CALL_PRICING.home_phone.plans) {
      expect(plan.monthly_inc_vat, plan.id).toBe(voice(plan.id).retailMonthly);
      expect(plan.minutes_included, plan.id).toBe(voice(plan.id).minutesIncluded);
    }
  });

  it("home phone add-ons", () => {
    for (const item of OLLIE_CALL_PRICING.home_phone.add_ons) {
      const source = addon(item.id);
      if ("monthly_inc_vat" in item) expect(item.monthly_inc_vat, item.id).toBe(source.retailMonthly);
      if ("one_off_inc_vat" in item) expect(item.one_off_inc_vat, item.id).toBe(source.retailOneOff);
    }
  });

  it("business voice and porting", () => {
    for (const plan of OLLIE_CALL_PRICING.business_voice.plans) {
      expect(plan.monthly_ex_vat, plan.id).toBe(voice(plan.id).retailMonthly);
    }
    for (const port of OLLIE_CALL_PRICING.number_porting_business) {
      expect(port.one_off_ex_vat, port.id).toBe(portingOptions.find((p) => p.id === port.id)!.retailCharge);
    }
  });
});
