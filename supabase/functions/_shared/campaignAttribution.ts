// First-touch flyer / QR attribution shared by the browser and edge functions.
// `ref` is intentionally not read here — that parameter belongs to the
// customer referral scheme (src/lib/referral.ts).

export const CAMPAIGN_TOUCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CAMPAIGN_TOUCH_STORAGE_KEY = "occta_campaign_touch_v1";
export const CC_PATTERN = /^[A-Za-z0-9-]{3,24}$/;

export const CAMPAIGN_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "qr_id",
  "cc",
  "offer",
  "referrer_host",
  "referrer_path",
  "landing_path",
  "source_type",
  "captured_at",
  "expires_at",
  "gclid",
  "fbclid",
  "msclkid",
  "ttclid",
] as const;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const CLICK_KEYS = ["gclid", "fbclid", "msclkid", "ttclid"] as const;
const SIGNAL_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "qr_id", "cc", "offer"] as const;
const SAFE_QUERY_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "offer", "qr", "qr_id", "flyer", "cc", "rc"] as const;

const LIMITS: Record<string, number> = {
  qr_id: 120,
  cc: 24,
  offer: 40,
  referrer_host: 200,
  referrer_path: 300,
  landing_path: 300,
  source_type: 40,
  captured_at: 40,
  expires_at: 40,
  gclid: 200,
  fbclid: 200,
  msclkid: 200,
  ttclid: 200,
};

export type CampaignTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  qr_id?: string;
  cc?: string;
  offer?: string;
  referrer_host?: string;
  referrer_path?: string;
  landing_path?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  ttclid?: string;
  source_type: string;
  captured_at: string;
  expires_at: string;
};

export type CaptureContext = {
  search: string;
  pathname: string;
  hostname: string;
  referrer?: string;
  consentGranted: boolean;
  now: number;
};

export function normaliseReferenceCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CC_PATTERN.test(code) ? code : null;
}

export function normaliseOfferCode(raw: unknown): { ok: true; code: string | null } | { ok: false } {
  if (raw == null) return { ok: true, code: null };
  if (typeof raw !== "string") return { ok: false };
  if (!raw.trim()) return { ok: true, code: null };
  const code = normaliseReferenceCode(raw);
  return code ? { ok: true, code } : { ok: false };
}

export function hasCampaignSignal(touch: object | null | undefined): boolean {
  if (!touch) return false;
  const record = touch as Record<string, unknown>;
  return SIGNAL_KEYS.some((key) => typeof record[key] === "string" && record[key].trim() !== "");
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function sanitizeCampaignUtm(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;
  const out: Record<string, string> = {};
  const qr = firstString(src.qr_id, src.qr, src.flyer);
  if (qr) out.qr_id = qr.slice(0, 120);
  const cc = normaliseReferenceCode(firstString(src.cc)) || normaliseReferenceCode(firstString(src.rc));
  if (cc) out.cc = cc;
  for (const key of CAMPAIGN_UTM_KEYS) {
    if (key === "qr_id" || key === "cc") continue;
    const value = src[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[key] = trimmed.slice(0, LIMITS[key] ?? 200);
  }
  return Object.keys(out).length ? out : null;
}

function classify(touch: Partial<CampaignTouch>): string {
  const medium = (touch.utm_medium ?? "").toLowerCase();
  const source = (touch.utm_source ?? "").toLowerCase();
  if (touch.qr_id || medium === "qr" || medium === "qrcode" || source === "flyer" || source === "leaflet" || source === "qr") {
    return "qr_flyer";
  }
  if (touch.gclid) return "google_ads";
  if (touch.fbclid) return "meta_ads";
  if (touch.msclkid) return "microsoft_ads";
  if (touch.ttclid) return "tiktok_ads";
  if (touch.utm_source || touch.utm_medium || touch.utm_campaign || touch.cc || touch.offer) return "campaign";
  if (touch.referrer_host) return "referral";
  return "direct";
}

export function parseCampaignTouch(ctx: CaptureContext): CampaignTouch {
  const params = new URLSearchParams(ctx.search.startsWith("?") ? ctx.search.slice(1) : ctx.search);
  const captured_at = new Date(ctx.now).toISOString();
  const touch: CampaignTouch = {
    source_type: "direct",
    captured_at,
    expires_at: new Date(ctx.now + CAMPAIGN_TOUCH_TTL_MS).toISOString(),
  };

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value?.trim()) touch[key] = value.trim().slice(0, 200);
  }
  const offer = params.get("offer");
  if (offer?.trim()) touch.offer = offer.trim().slice(0, 40);
  if (ctx.consentGranted) {
    for (const key of CLICK_KEYS) {
      const value = params.get(key);
      if (value?.trim()) touch[key] = value.trim().slice(0, 200);
    }
  }
  const qr = firstString(params.get("qr"), params.get("qr_id"), params.get("flyer"));
  if (qr) touch.qr_id = qr.slice(0, 120);
  const cc = normaliseReferenceCode(params.get("cc") ?? "") || normaliseReferenceCode(params.get("rc") ?? "");
  if (cc) touch.cc = cc;

  const safe = new URLSearchParams();
  for (const key of SAFE_QUERY_KEYS) {
    const value = params.get(key);
    if (value?.trim()) safe.set(key, value.trim().slice(0, 160));
  }
  const path = (ctx.pathname || "/").slice(0, 300);
  const query = safe.toString();
  touch.landing_path = `${path}${query ? `?${query}` : ""}`.slice(0, 300);

  if (ctx.referrer) {
    try {
      const ref = new URL(ctx.referrer);
      const host = ref.hostname.toLowerCase();
      if (host && host !== (ctx.hostname || "").toLowerCase()) {
        touch.referrer_host = host.slice(0, 200);
        touch.referrer_path = ref.pathname.slice(0, 300);
      }
    } catch { /* malformed referrer */ }
  }

  touch.source_type = classify(touch);
  return touch;
}

export function isCampaignTouchExpired(touch: CampaignTouch, now: number): boolean {
  const expires = Date.parse(touch.expires_at);
  return !Number.isFinite(expires) || expires <= now;
}

function stripClickIds(touch: CampaignTouch): CampaignTouch {
  const next: CampaignTouch = { ...touch };
  for (const key of CLICK_KEYS) delete next[key];
  next.source_type = classify(next);
  return next;
}

function withConsentClickIds(base: CampaignTouch, incoming: CampaignTouch, consentGranted: boolean): CampaignTouch {
  if (!consentGranted) return stripClickIds(base);
  if (base.landing_path !== incoming.landing_path) return base;
  const next: CampaignTouch = { ...base };
  let added = false;
  for (const key of CLICK_KEYS) {
    if (!next[key] && incoming[key]) {
      next[key] = incoming[key];
      added = true;
    }
  }
  if (added) next.source_type = classify(next);
  return next;
}

/** Keep the earliest campaign touch. A later direct visit must not replace it. */
export function resolveFirstTouch(
  existing: CampaignTouch | null,
  incoming: CampaignTouch,
  now: number,
  consentGranted: boolean,
): CampaignTouch {
  if (!existing || isCampaignTouchExpired(existing, now)) return incoming;
  if (hasCampaignSignal(existing)) return withConsentClickIds(existing, incoming, consentGranted);
  if (hasCampaignSignal(incoming)) return incoming;
  return withConsentClickIds(existing, incoming, consentGranted);
}

export function touchToRecord(touch: CampaignTouch): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(touch)) {
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Merge a newly supplied touch into a journey utm_snapshot.
 * Top-level keys stay on the first campaign touch so existing admin SQL
 * (`utm_snapshot->>'utm_source'`) keeps working. A later direct touch is
 * recorded only as latest_touch.
 */
export function mergeUtmSnapshot(existing: unknown, incoming: unknown): Record<string, unknown> {
  const prev = asRecord(existing);
  const prevTop = prev ? sanitizeCampaignUtm(prev) : null;
  const storedFirst = prev ? sanitizeCampaignUtm(prev.first_touch) : null;
  const prevLatest = prev ? sanitizeCampaignUtm(prev.latest_touch) : null;
  const inc = sanitizeCampaignUtm(incoming);

  const campaignFirst =
    (storedFirst && hasCampaignSignal(storedFirst) ? storedFirst : null)
    || (prevTop && hasCampaignSignal(prevTop) ? prevTop : null)
    || (inc && hasCampaignSignal(inc) ? inc : null)
    || null;

  const top = campaignFirst || prevTop || inc || {
    source_type: "direct",
    captured_at: new Date().toISOString(),
  };
  return {
    ...top,
    first_touch: campaignFirst || top,
    latest_touch: inc || prevLatest || top,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Internal alert fragment. Click IDs are omitted. */
export function campaignAlertHtml(utm: unknown): string {
  const touch = sanitizeCampaignUtm(utm);
  if (!touch) return "";
  const referrer = touch.referrer_host ? `${touch.referrer_host}${touch.referrer_path ?? ""}` : "";
  const rows: Array<[string, string | undefined]> = [
    ["UTM source", touch.utm_source],
    ["UTM medium", touch.utm_medium],
    ["UTM campaign", touch.utm_campaign],
    ["UTM content", touch.utm_content],
    ["UTM term", touch.utm_term],
    ["QR / flyer", touch.qr_id],
    ["Reference code", touch.cc],
    ["Referrer", referrer],
    ["Landing path", touch.landing_path],
  ];
  const present = rows.filter((row): row is [string, string] => Boolean(row[1]));
  if (!present.length) return "";
  return `<p><strong>Campaign / QR</strong></p><ul>${present.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("")}</ul>`;
}

export function campaignTouchOf(utm: unknown): Record<string, string> {
  const record = asRecord(utm);
  if (!record) return {};
  const first = sanitizeCampaignUtm(record.first_touch);
  if (first && hasCampaignSignal(first)) return first;
  return sanitizeCampaignUtm(record) ?? {};
}

export function formatCampaignQrLabel(utm: unknown, offerCode?: string | null): string {
  const touch = campaignTouchOf(utm);
  const stored = touch.cc || "";
  const typed = normaliseReferenceCode(offerCode ?? "") || "";
  const codes = [stored, typed].filter((code, index, all) => code && all.indexOf(code) === index);
  const parts = [touch.utm_campaign, touch.qr_id ? `QR ${touch.qr_id}` : "", codes.join("/")].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export type CampaignFilter = "all" | "tagged" | "qr" | "code";

export function campaignFilterMatch(utm: unknown, offerCode: string | null | undefined, filter: CampaignFilter): boolean {
  if (filter === "all") return true;
  const touch = campaignTouchOf(utm);
  const code = normaliseReferenceCode(offerCode ?? "") || touch.cc || "";
  if (filter === "code") return Boolean(code);
  if (filter === "qr") return Boolean(touch.qr_id) || touch.source_type === "qr_flyer";
  return hasCampaignSignal(touch) || Boolean(code);
}

export function campaignSearchText(utm: unknown, offerCode?: string | null): string {
  const touch = campaignTouchOf(utm);
  return [formatCampaignQrLabel(utm, offerCode), touch.utm_source, touch.utm_medium, touch.utm_content, touch.utm_term, touch.landing_path, offerCode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
