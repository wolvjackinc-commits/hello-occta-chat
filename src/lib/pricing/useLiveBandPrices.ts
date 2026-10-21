import { useEffect, useState } from "react";
import { loadJourneyCatalogue } from "@/lib/journey2/route";
import type { SpeedBucket } from "./fairPricing";

export type BandPrices = Partial<Record<SpeedBucket, { lock24: number; flex30: number }>>;

/**
 * Live band prices from the order catalogue — the same source the order
 * journey charges from — so plan cards can never advertise a different price.
 * Reuses the catalogue primed after an address is picked (no extra request in
 * the normal flow). Returns null until loaded; callers fall back to CHARGED_PRICES.
 */
export function useLiveBandPrices(enabled: boolean): BandPrices | null {
  const [prices, setPrices] = useState<BandPrices | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadJourneyCatalogue()
      .then((res) => {
        if (cancelled || !res?.ok || !res.catalogue) return;
        const next: BandPrices = {};
        for (const plan of res.catalogue.plans) {
          const lock = plan.terms.price_lock_24?.monthly_incl_vat;
          const flex = plan.terms.flex_30?.monthly_incl_vat;
          if (lock != null || flex != null) {
            next[plan.speed_bucket] = { lock24: lock ?? flex!, flex30: flex ?? lock! };
          }
        }
        setPrices(next);
      })
      .catch(() => {
        // Keep the CHARGED_PRICES fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return prices;
}
