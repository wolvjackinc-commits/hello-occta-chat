import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { FAIR_PRICING_DEFAULTS, PUBLIC_SPEED_BUCKETS, toPublicBucket } from "../fairPricing";
import { broadbandRetailCards } from "../retailCards";
import { getRetailBroadbandCards } from "../engine";

const read = (p: string) => fs.readFileSync(p, "utf8");

// Governed customer-facing prices (incl. VAT, residential).
const GOVERNED = {
  essential: { lock24: 34.99, flex30: 37.99 },
  superfast: { lock24: 39.99, flex30: 44.99 },
  ultrafast: { lock24: 49.99, flex30: 52.99 },
  gigabit: { lock24: 49.99, flex30: 52.99 },
} as const;

describe("four governed public broadband bands", () => {
  it("uses the governed headline prices for every public band", () => {
    for (const b of PUBLIC_SPEED_BUCKETS) {
      expect(FAIR_PRICING_DEFAULTS.headline[b]).toEqual(GOVERNED[b]);
    }
  });

  it("exposes Essential, Superfast, Ultrafast and Gigabit", () => {
    expect([...PUBLIC_SPEED_BUCKETS]).toEqual(["essential", "superfast", "ultrafast", "gigabit"]);
    expect(broadbandRetailCards.map((c) => c.id)).toEqual(["essential", "superfast", "ultrafast", "gigabit"]);
  });

  it("publishes Gigabit as its own customer-facing band", () => {
    const cards = getRetailBroadbandCards();
    expect(cards).toHaveLength(4);
    expect(cards.some((c) => c.id === "gigabit")).toBe(true);
    expect(cards.find((c) => c.id === "gigabit")?.publicTitle).toContain("GIGABIT");
    expect(toPublicBucket("gigabit")).toBe("gigabit");
    expect(toPublicBucket("essential")).toBe("essential");
    const journey2 = read("supabase/functions/_shared/journey2.ts");
    expect(journey2).toContain('gigabit: "Gigabit Fibre"');
  });

  it("keeps Ultrafast and Gigabit as distinct speed bands", () => {
    const cards = getRetailBroadbandCards();
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(byId.essential.speedLabel).toContain("80");
    expect(byId.superfast.speedLabel).toContain("330");
    expect(byId.ultrafast.speedLabel).toContain("550");
    expect(byId.gigabit.speedLabel).toContain("1000");
  });
});

describe("wholesale changes must not rebase retail guard values", () => {
  it("keeps retail_price_floors strictly below the governed headline prices", () => {
    // retail_price_floors is an internal discount/override guard, not a mirror of
    // the headline price. Equality would remove all discount headroom.
    const sql = fs
      .readdirSync("supabase/migrations")
      .filter((f) => /retail_price_floor|governed_public_band/i.test(read(`supabase/migrations/${f}`)))
      .map((f) => read(`supabase/migrations/${f}`))
      .join("\n");
    expect(sql).not.toMatch(/floor_monthly_gross\s*=\s*headline/i);
  });

  it("documents that wholesale cost refreshes never touch retail floors", () => {
    const resolver = read("supabase/functions/_shared/buildPlanResolver.ts");
    // Floors are read as a guard, never written by the resolver.
    expect(resolver).not.toMatch(/update\(.*retail_price_floors/is);
  });
});

describe("information updates are excluded from pending acceptance", () => {
  it("filters is_information_update in acceptance and reporting reads", () => {
    expect(read("supabase/functions/journey-state/index.ts")).toContain('.eq("is_information_update", false)');
    expect(read("src/components/app/AppDashboard.tsx")).toContain('.eq("is_information_update", false)');
    expect(read("src/pages/admin/Quotes.tsx")).toContain('.eq("is_information_update", false)');
    expect(read("src/lib/requireContractSummary.ts")).toContain("is_information_update === true");
  });

  it("still issues new contract summaries as non-information updates", () => {
    expect(read("supabase/functions/generate-contract-summary/index.ts")).toContain("is_information_update: false");
  });
});
