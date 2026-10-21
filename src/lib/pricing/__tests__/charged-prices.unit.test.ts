import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { CHARGED_PRICES } from "../chargedPrices";
import { getRetailBroadbandCards, getFromPrices } from "../engine";
import { PUBLIC_SPEED_BUCKETS } from "../fairPricing";

// The website must advertise what the order journey charges. In Oct 2026 the
// homepage showed the resolver's pre-bump starting prices (Superfast £39.99)
// while every order and Contract Summary came out at £43.99.
describe("advertised broadband prices match the charged rate card", () => {
  it("plan cards show the charged Price Lock 24 and Flex 30 prices", () => {
    for (const card of getRetailBroadbandCards()) {
      const charged = CHARGED_PRICES[card.id as keyof typeof CHARGED_PRICES];
      expect(Number(card.fromPrice)).toBe(charged.lock24);
    }
  });

  it("the cheapest 'from' price is the cheapest charged price", () => {
    const cheapest = Math.min(...PUBLIC_SPEED_BUCKETS.map((b) => CHARGED_PRICES[b].lock24));
    expect(Number(getFromPrices().broadband)).toBe(cheapest);
  });

  it("every charged Price Lock 24 price is in the Giacom V4 contract rate card", () => {
    const ratecard = fs.readFileSync("supabase/migrations/20260810144000_contract_summary_v4_ratecard.sql", "utf8");
    for (const b of PUBLIC_SPEED_BUCKETS) {
      expect(ratecard).toContain(CHARGED_PRICES[b].lock24.toFixed(2));
    }
  });

  it("never advertises the superseded pre-V4 starting prices", () => {
    expect(CHARGED_PRICES.superfast.lock24).not.toBe(39.99);
    expect(CHARGED_PRICES.gigabit.lock24).not.toBe(49.99);
  });
});
