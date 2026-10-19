import { ONSITE_CLICK_PARAMS, readOnSiteClick } from "../../../supabase/functions/_shared/outreach.ts";

/**
 * Outreach emails link straight to occta.co.uk (keeping every link on the
 * sender's domain helps inbox placement). When a visitor lands from one, report
 * the click once, then remove the click parameters so a refresh or a shared
 * link doesn't count again. Campaign utm_* parameters are left for attribution.
 */
const VISIT_TOKEN_KEY = "occta_outreach_visit_v1";
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The outreach email this visit came from, if any. Kept for the browser session
 * only, so an enquiry made on this visit is credited to the email even when an
 * older campaign holds the first-touch attribution.
 */
export function readOutreachVisitToken(): string | null {
  try {
    const token = window.sessionStorage.getItem(VISIT_TOKEN_KEY);
    return token && TOKEN_RE.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function reportOutreachClick(): void {
  if (typeof window === "undefined") return;
  const click = readOnSiteClick(window.location.search);
  if (!click) return;

  try {
    window.sessionStorage.setItem(VISIT_TOKEN_KEY, click.token);
  } catch {
    // Storage blocked: the enquiry can still be matched by email address.
  }

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
