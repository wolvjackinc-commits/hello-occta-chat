import type { SpeedBucket } from "./fairPricing";

/**
 * The broadband prices customers are actually charged (residential, incl. VAT),
 * as served by the live order catalogue (journey2-catalogue, pricing version
 * giacom_v4_2026_08_10) and written into the Contract Summary they sign.
 *
 * Every price the website advertises for a speed band must come from here (or
 * from the live catalogue, see useChargedBandPrices). The FAIR_PRICING_DEFAULTS
 * headline in fairPricing.ts are the resolver's starting prices, which the
 * margin check auto-bumps against Giacom V4 supplier costs — advertising those
 * showed £39.99 on the homepage for an order that then cost £43.99.
 *
 * If the catalogue changes, update these to match; the plan cards also prefer
 * the live catalogue whenever it has loaded.
 */
export const CHARGED_PRICES_VERSION = "giacom_v4_2026_08_10";

export const CHARGED_PRICES: Record<SpeedBucket, { lock24: number; flex30: number }> = {
  essential: { lock24: 34.99, flex30: 37.99 },
  superfast: { lock24: 43.99, flex30: 45.99 },
  ultrafast: { lock24: 51.99, flex30: 52.99 },
  gigabit: { lock24: 57.99, flex30: 57.99 },
};
