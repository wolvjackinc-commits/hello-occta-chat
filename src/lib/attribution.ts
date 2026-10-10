// Captures campaign / QR attribution on first page view and persists the
// first touch so quote, order and business-lead submissions can reuse it.
// Click IDs are stored only when analytics consent has been granted.

import { captureCampaignFromLocation, readStoredCampaignTouch } from "@/lib/campaignAttribution";

export type Attribution = {
  gclid?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_medium?: string | null;
  landing_page?: string | null;
  conversion_page?: string | null;
};

/** Run once at app start, and again on client-side navigations. */
export function initAttribution() {
  captureCampaignFromLocation();
}

/** Returns the stored first-touch attribution, plus the current page. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  captureCampaignFromLocation();
  const saved = readStoredCampaignTouch();
  return {
    gclid: saved?.gclid ?? null,
    utm_source: saved?.utm_source ?? null,
    utm_campaign: saved?.utm_campaign ?? null,
    utm_term: saved?.utm_term ?? null,
    utm_medium: saved?.utm_medium ?? null,
    landing_page: saved?.landing_path || window.location.href,
    conversion_page: window.location.href,
  };
}
