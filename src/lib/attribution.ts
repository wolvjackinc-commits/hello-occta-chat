// Captures Google Ads / UTM attribution on first page view and persists it
// for the duration of the session so we can attach it to quote submissions.

const KEY = "occta_attribution_v1";
const LANDING_KEY = "occta_landing_page_v1";

export type Attribution = {
  gclid?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_medium?: string | null;
  landing_page?: string | null;
  conversion_page?: string | null;
};

function safeStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

/** Run once at app start. Reads URL params, persists first-touch values. */
export function initAttribution() {
  if (typeof window === "undefined") return;
  const store = safeStorage();
  if (!store) return;

  // Landing page = first URL ever seen in this session
  if (!store.getItem(LANDING_KEY)) {
    store.setItem(LANDING_KEY, window.location.href);
  }

  const params = new URLSearchParams(window.location.search);
  const fields: (keyof Attribution)[] = [
    "gclid", "utm_source", "utm_campaign", "utm_term", "utm_medium",
  ];
  const existing: Attribution = (() => {
    try { return JSON.parse(store.getItem(KEY) || "{}"); } catch { return {}; }
  })();

  let changed = false;
  for (const f of fields) {
    const v = params.get(f);
    if (v && !existing[f]) {
      (existing as any)[f] = v.slice(0, 200);
      changed = true;
    }
  }
  if (changed) store.setItem(KEY, JSON.stringify(existing));
}

/** Returns attribution including current page as conversion_page. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const store = safeStorage();
  let saved: Attribution = {};
  try { saved = JSON.parse(store?.getItem(KEY) || "{}"); } catch { /* noop */ }
  const landing_page = store?.getItem(LANDING_KEY) || window.location.href;
  return {
    gclid: saved.gclid ?? null,
    utm_source: saved.utm_source ?? null,
    utm_campaign: saved.utm_campaign ?? null,
    utm_term: saved.utm_term ?? null,
    utm_medium: saved.utm_medium ?? null,
    landing_page,
    conversion_page: window.location.href,
  };
}