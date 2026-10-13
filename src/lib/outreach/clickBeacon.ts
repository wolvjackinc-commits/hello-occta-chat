import { ONSITE_CLICK_PARAMS, readOnSiteClick } from "../../../supabase/functions/_shared/outreach.ts";

/**
 * Outreach emails link straight to occta.co.uk (keeping every link on the
 * sender's domain helps inbox placement). When a visitor lands from one, report
 * the click once, then remove the click parameters so a refresh or a shared
 * link doesn't count again. Campaign utm_* parameters are left for attribution.
 */
export function reportOutreachClick(): void {
  if (typeof window === "undefined") return;
  const click = readOnSiteClick(window.location.search);
  if (!click) return;

  const dedupeKey = `occta_outreach_click:${click.token}:${click.link}`;
  let alreadySent = false;
  try {
    alreadySent = window.sessionStorage.getItem(dedupeKey) === "1";
    window.sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // Storage blocked: still report once for this page load.
  }

  if (!alreadySent) {
    const endpoint = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "")}/functions/v1/outreach-track`;
    const payload = JSON.stringify({ t: click.token, l: click.link });
    try {
      const queued = typeof navigator.sendBeacon === "function"
        && navigator.sendBeacon(endpoint, new Blob([payload], { type: "text/plain" }));
      if (!queued) {
        void fetch(endpoint, { method: "POST", body: payload, keepalive: true, mode: "no-cors" }).catch(() => undefined);
      }
    } catch {
      // Tracking must never affect the visitor.
    }
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(ONSITE_CLICK_PARAMS.token);
    url.searchParams.delete(ONSITE_CLICK_PARAMS.link);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // Leaving the parameters in place is harmless.
  }
}
