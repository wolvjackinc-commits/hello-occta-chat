import { getConsent } from "@/lib/consent";
import {
  CAMPAIGN_TOUCH_STORAGE_KEY,
  type CampaignTouch,
  type CaptureContext,
  isCampaignTouchExpired,
  parseCampaignTouch,
  resolveFirstTouch,
  sanitizeCampaignUtm,
  touchToRecord,
} from "../../supabase/functions/_shared/campaignAttribution.ts";

export {
  CAMPAIGN_TOUCH_STORAGE_KEY,
  CAMPAIGN_TOUCH_TTL_MS,
  CC_PATTERN,
  type CampaignFilter,
  type CampaignTouch,
  type CaptureContext,
  campaignAlertHtml,
  campaignFilterMatch,
  campaignSearchText,
  campaignTouchOf,
  formatCampaignQrLabel,
  hasCampaignSignal,
  mergeUtmSnapshot,
  normaliseOfferCode,
  normaliseReferenceCode,
  parseCampaignTouch,
  resolveFirstTouch,
  sanitizeCampaignUtm,
  touchToRecord,
} from "../../supabase/functions/_shared/campaignAttribution.ts";

function safeStore(kind: "session" | "local"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readStore(kind: "session" | "local", now: number): CampaignTouch | null {
  const store = safeStore(kind);
  if (!store) return null;
  try {
    const raw = store.getItem(CAMPAIGN_TOUCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { touch?: unknown };
    const source = parsed?.touch && typeof parsed.touch === "object" ? parsed.touch : parsed;
    const clean = sanitizeCampaignUtm(source);
    if (!clean?.captured_at || !clean.expires_at) return null;
    const touch = { ...clean, source_type: clean.source_type || "direct" } as CampaignTouch;
    if (isCampaignTouchExpired(touch, now)) return null;
    return touch;
  } catch {
    return null;
  }
}

function preferTouch(a: CampaignTouch, b: CampaignTouch): CampaignTouch {
  const aSignal = Boolean(a.utm_source || a.utm_medium || a.utm_campaign || a.utm_term || a.utm_content || a.qr_id || a.cc || a.offer);
  const bSignal = Boolean(b.utm_source || b.utm_medium || b.utm_campaign || b.utm_term || b.utm_content || b.qr_id || b.cc || b.offer);
  if (aSignal !== bSignal) return aSignal ? a : b;
  return a.captured_at <= b.captured_at ? a : b;
}

function persistTouch(touch: CampaignTouch) {
  const json = JSON.stringify({ touch, expires_at: touch.expires_at });
  try { safeStore("session")?.setItem(CAMPAIGN_TOUCH_STORAGE_KEY, json); } catch { /* best-effort */ }
  try { safeStore("local")?.setItem(CAMPAIGN_TOUCH_STORAGE_KEY, json); } catch { /* best-effort */ }
}

export function readStoredCampaignTouch(now = Date.now()): CampaignTouch | null {
  const session = readStore("session", now);
  const local = readStore("local", now);
  const chosen = session && local ? preferTouch(session, local) : session || local;
  if (!chosen) return null;
  const expected = JSON.stringify({ touch: chosen, expires_at: chosen.expires_at });
  const sessionRaw = safeStore("session")?.getItem(CAMPAIGN_TOUCH_STORAGE_KEY);
  const localRaw = safeStore("local")?.getItem(CAMPAIGN_TOUCH_STORAGE_KEY);
  if (sessionRaw !== expected || localRaw !== expected) persistTouch(chosen);
  return chosen;
}

/** Capture the current URL and return the first-touch record that should be stored. */
export function rememberCampaignTouch(ctx: CaptureContext): CampaignTouch {
  const incoming = parseCampaignTouch(ctx);
  const existing = readStoredCampaignTouch(ctx.now);
  const next = resolveFirstTouch(existing, incoming, ctx.now, ctx.consentGranted);
  persistTouch(next);
  return next;
}

export function attributionRecordForJourney(ctx: CaptureContext): Record<string, string> {
  return touchToRecord(rememberCampaignTouch(ctx));
}

let consentHooked = false;

export function captureCampaignFromLocation(): void {
  if (typeof window === "undefined") return;
  rememberCampaignTouch({
    search: window.location.search,
    pathname: window.location.pathname,
    hostname: window.location.hostname,
    referrer: document.referrer,
    consentGranted: getConsent() === "granted",
    now: Date.now(),
  });
  if (!consentHooked) {
    consentHooked = true;
    window.addEventListener("occta:consent-change", () => captureCampaignFromLocation());
  }
}

export function getStoredCampaignCode(now = Date.now()): string | null {
  return readStoredCampaignTouch(now)?.cc ?? null;
}

export function getCampaignUtmForSubmit(now = Date.now()): Record<string, string> | null {
  const touch = readStoredCampaignTouch(now);
  return touch ? touchToRecord(touch) : null;
}
