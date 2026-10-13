// Pure helpers for the outreach campaign manager.
//
// No runtime imports on purpose: the Deno edge functions and the Vitest unit
// suite both import this file directly.

export const OUTREACH_CORPORATE_FORMS = ["limited_company", "llp", "plc", "public_body", "company_other"] as const;
export type OutreachLegalForm =
  | (typeof OUTREACH_CORPORATE_FORMS)[number]
  | "sole_trader"
  | "partnership"
  | "charity_unincorporated"
  | "unknown";
export type OutreachEmailType = "role" | "personal" | "unknown";
export type OutreachLawfulBasis = "corporate_subscriber" | "consent" | "none";

export type OutreachEligibilityInput = {
  status: string;
  lawful_basis: OutreachLawfulBasis | string;
  companies_house_verified: boolean;
  companies_house_number: string | null;
  legal_form: OutreachLegalForm | string;
  email_type: OutreachEmailType | string;
  consent_evidence: string | null;
};

/** Mirrors the generated `outreach_contacts.eligible` column (PECR reg. 22). */
export function isOutreachEligible(c: OutreachEligibilityInput): boolean {
  if (c.status !== "active") return false;
  if (c.lawful_basis === "consent") return Boolean(c.consent_evidence && c.consent_evidence.trim());
  return (
    c.lawful_basis === "corporate_subscriber" &&
    c.companies_house_verified === true &&
    Boolean(c.companies_house_number) &&
    (OUTREACH_CORPORATE_FORMS as readonly string[]).includes(c.legal_form) &&
    c.email_type === "role"
  );
}

/** Plain-English reason a contact cannot be emailed, or null when it can. */
export function outreachIneligibleReason(c: OutreachEligibilityInput): string | null {
  if (c.status !== "active") return `Contact is ${c.status.replace(/_/g, " ")}`;
  if (c.lawful_basis === "consent") {
    return c.consent_evidence && c.consent_evidence.trim() ? null : "Consent is recorded without evidence";
  }
  if (c.lawful_basis !== "corporate_subscriber") return "No lawful basis recorded";
  if (!(OUTREACH_CORPORATE_FORMS as readonly string[]).includes(c.legal_form)) {
    return "Not a company (sole traders and partnerships need prior consent)";
  }
  if (!c.companies_house_verified || !c.companies_house_number) return "Not verified at Companies House";
  if (c.email_type !== "role") return "Not a general business inbox (e.g. info@)";
  return null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

const ROLE_LOCAL_PARTS = new Set([
  "info", "hello", "hi", "enquiries", "enquiry", "inquiries", "office", "admin", "sales", "contact",
  "reception", "accounts", "bookings", "booking", "team", "mail", "general", "business", "support",
  "service", "services", "orders", "shop", "studio", "manager", "management", "post", "help",
  "customerservice", "customerservices", "care", "hr", "finance", "operations", "ops", "reservations",
]);

/** Classify the local part of an address as a role inbox (info@) or a named person. */
export function classifyEmailType(email: string): OutreachEmailType {
  const local = email.split("@")[0]?.toLowerCase().replace(/[._+-]/g, "") ?? "";
  if (!local) return "unknown";
  return ROLE_LOCAL_PARTS.has(local) ? "role" : "personal";
}

/** Map the lead-list `legal_form_hint` text to a legal form. Unverified hints stay unknown. */
export function legalFormFromHint(hint: string | null | undefined): OutreachLegalForm {
  const h = (hint ?? "").trim().toLowerCase();
  if (!h || h.includes("?")) return "unknown";
  if (h.startsWith("limited company")) return h.includes("charity") || h.includes("cic") ? "company_other" : "limited_company";
  if (h.startsWith("llp")) return "llp";
  if (h.startsWith("plc")) return "plc";
  if (h.startsWith("sole trader")) return "sole_trader";
  if (h.startsWith("partnership")) return "partnership";
  if (h.startsWith("charity")) return "charity_unincorporated";
  return "unknown";
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "campaign";
}

/** URL-safe random token for tracking and unsubscribe links (128 bits). */
export function generateOutreachToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Time window (Europe/London)
// ---------------------------------------------------------------------------

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, timeZone = "Europe/London"): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}

export type SendWindow = { window_start_hour: number; window_end_hour: number; weekdays_only: boolean };

export function isWithinSendWindow(now: Date, w: SendWindow, timeZone = "Europe/London"): boolean {
  const p = zonedParts(now, timeZone);
  if (w.weekdays_only && (p.weekday === 0 || p.weekday === 6)) return false;
  return p.hour >= w.window_start_hour && p.hour < w.window_end_hour;
}

/** UTC instant of local midnight for the day containing `now` in `timeZone`. */
export function startOfZonedDay(now: Date, timeZone = "Europe/London"): Date {
  const p = zonedParts(now, timeZone);
  // Guess midnight as if the zone were UTC, then correct by the zone offset at that instant.
  let guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const g = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute);
    const offset = asUtc - guess;
    guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0) - offset;
  }
  return new Date(guess);
}

/** How many sends this tick may make, given today's / this hour's sent counts. */
export function sendAllowance(opts: {
  dailyCap: number;
  hourlyCap: number;
  sentToday: number;
  sentLastHour: number;
  maxBatch?: number;
}): number {
  const remaining = Math.min(opts.dailyCap - opts.sentToday, opts.hourlyCap - opts.sentLastHour, opts.maxBatch ?? 25);
  return Math.max(0, Math.floor(remaining));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type OutreachVars = Record<string, string | null | undefined>;

/** Replace {{name}} placeholders. HTML mode escapes values; unknown names render empty. */
export function renderPlaceholders(template: string, vars: OutreachVars, mode: "html" | "text"): string {
  return template.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_m, name: string) => {
    const value = vars[name.toLowerCase()] ?? "";
    return mode === "html" ? escapeHtml(value) : String(value);
  });
}

/** Placeholders a template uses that the sender does not supply. */
export function unknownPlaceholders(template: string, known: readonly string[]): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi)) {
    const name = m[1].toLowerCase();
    if (!known.includes(name)) found.add(name);
  }
  return [...found];
}

export const OUTREACH_PLACEHOLDERS = [
  "business_name", "area", "district", "category", "flyer_ref", "cta_url", "unsubscribe_url", "sender_name",
] as const;

export type CampaignLinkParams = {
  utmCampaign: string;
  utmContent: string;
  flyerRef: string | null;
};

const TRACKED_HOSTS = new Set(["occta.co.uk", "www.occta.co.uk"]);

/** Add campaign attribution to links on our own site; other sites are left untouched. */
export function withCampaignParams(rawUrl: string, p: CampaignLinkParams): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (!TRACKED_HOSTS.has(url.hostname.toLowerCase())) return rawUrl;
  url.searchParams.set("utm_source", "occta_outreach");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", p.utmCampaign);
  url.searchParams.set("utm_content", p.utmContent);
  if (p.flyerRef) url.searchParams.set("cc", p.flyerRef);
  return url.toString();
}

/** Per-recipient token on our own links so an enquiry can be traced to one email. */
export function withRecipientTerm(rawUrl: string, token: string): string {
  try {
    const url = new URL(rawUrl);
    if (!TRACKED_HOSTS.has(url.hostname.toLowerCase())) return rawUrl;
    url.searchParams.set("utm_term", `ob-${token}`);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function isOwnSiteUrl(rawUrl: string): boolean {
  try {
    return TRACKED_HOSTS.has(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Query parameters the website reads to record an email click (see src/lib/outreach/clickBeacon.ts). */
export const ONSITE_CLICK_PARAMS = { token: "ot", link: "ol" } as const;

/**
 * Link straight to our own site and let the page report the click, instead of
 * bouncing through a tracking domain. Links whose domain differs from the
 * sender's are a strong spam signal, so this keeps every link on occta.co.uk.
 */
export function withOnSiteClickTracking(rawUrl: string, token: string, index: number): string {
  try {
    const url = new URL(rawUrl);
    if (!TRACKED_HOSTS.has(url.hostname.toLowerCase())) return rawUrl;
    url.searchParams.set("utm_term", `ob-${token}`);
    url.searchParams.set(ONSITE_CLICK_PARAMS.token, token);
    url.searchParams.set(ONSITE_CLICK_PARAMS.link, String(index));
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/** Read an on-site email click from a page's query string, or null. */
export function readOnSiteClick(search: string): { token: string; link: number } | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const token = params.get(ONSITE_CLICK_PARAMS.token) ?? "";
  const link = Number(params.get(ONSITE_CLICK_PARAMS.link));
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token) || !Number.isInteger(link) || link < 0 || link > 99) return null;
  return { token, link };
}

const HREF_RE = /href\s*=\s*"(https?:\/\/[^"]+)"/gi;

/** Collect the distinct absolute links in a body, in order of first appearance. */
export function collectLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(HREF_RE)) {
    const decoded = m[1].replace(/&amp;/g, "&");
    if (!out.includes(decoded)) out.push(decoded);
  }
  return out;
}

/** Point every known link at the click tracker. Unknown links are left as they are. */
export function rewriteLinksForTracking(html: string, links: readonly string[], clickUrl: (index: number) => string): string {
  return html.replace(HREF_RE, (whole, raw: string) => {
    const index = links.indexOf(raw.replace(/&amp;/g, "&"));
    if (index < 0) return whole;
    return `href="${escapeHtml(clickUrl(index))}"`;
  });
}

/**
 * Contacts in this category are OCCTA customers who opted in to marketing
 * emails from their account (lawful basis: consent). They are kept out of
 * business campaigns and get a consumer footer.
 */
export const CONSUMER_CATEGORY = "consumer";

export function isConsumerCategory(category: string | null | undefined): boolean {
  return (category ?? "").trim().toLowerCase() === CONSUMER_CATEGORY;
}

export type ComplianceFooterInput = {
  businessName: string;
  postalAddress: string;
  unsubscribeUrl: string;
  privacyUrl: string;
  audience?: "business" | "consumer";
};

function whyThisEmail(f: ComplianceFooterInput): string {
  return f.audience === "consumer"
    ? "You're getting this because you said yes to offers and news from OCCTA by email in your account. You can change this any time in My OCCTA › Account."
    : `We emailed ${f.businessName} at this address because it is published as a general contact for the business. We only use it to tell you about OCCTA business services.`;
}

export function complianceFooterHtml(f: ComplianceFooterInput): string {
  return `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:12px;line-height:1.6;color:#666">
<p style="margin:0 0 8px">${escapeHtml(whyThisEmail(f))}</p>
<p style="margin:0 0 8px">Don't want these emails? <a href="${escapeHtml(f.unsubscribeUrl)}" style="color:#666;text-decoration:underline">Unsubscribe with one click</a> and we won't email this address again. See our <a href="${escapeHtml(f.privacyUrl)}" style="color:#666;text-decoration:underline">privacy notice</a> for how we got your details and your rights.</p>
<p style="margin:0">${escapeHtml(f.postalAddress)} · Company No. 13828933 · VAT No. 520 6072 30</p>
</div>`;
}

export function complianceFooterText(f: ComplianceFooterInput): string {
  return [
    "--",
    whyThisEmail(f),
    `Unsubscribe with one click: ${f.unsubscribeUrl}`,
    `Privacy notice (how we got your details and your rights): ${f.privacyUrl}`,
    `${f.postalAddress} · Company No. 13828933 · VAT No. 520 6072 30`,
  ].join("\n");
}

export type EmailShellInput = {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  heroImageUrl: string | null;
  footerHtml: string;
  pixelUrl: string | null;
  /** Words beside the logo in the plain header bar. */
  tagline?: string;
};

/** Simple, table-based layout that renders consistently in Outlook, Gmail and Apple Mail. */
export function wrapEmailHtml(e: EmailShellInput): string {
  const pre = e.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(e.preheader)}</div>`
    : "";
  // The flyer artwork already carries the OCCTA logo, so the plain header bar
  // is only used when there is no image.
  const header = e.heroImageUrl
    ? `<tr><td style="padding:0"><a href="${escapeHtml(e.ctaUrl)}"><img src="${escapeHtml(e.heroImageUrl)}" width="600" alt="${escapeHtml(e.subject)}" style="display:block;width:100%;max-width:600px;height:auto;border:0" /></a></td></tr>`
    : `<tr><td style="background:#0d0d0d;padding:20px 28px"><span style="display:inline-block;background:#ffe500;color:#0d0d0d;font:900 20px Arial,Helvetica,sans-serif;letter-spacing:1px;padding:4px 10px">OCCTA</span><span style="color:#ffffff;font:600 11px Arial,Helvetica,sans-serif;letter-spacing:2px;margin-left:12px">${escapeHtml(e.tagline ?? "FOR UK BUSINESS")}</span></td></tr>`;
  const pixel = e.pixelUrl
    ? `<img src="${escapeHtml(e.pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(e.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f4ef">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ef"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:3px solid #0d0d0d">
${header}
<tr><td style="padding:28px;font:15px/1.6 Arial,Helvetica,sans-serif;color:#1a1a1a">
${e.bodyHtml}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#0d0d0d;border-radius:4px"><a href="${escapeHtml(e.ctaUrl)}" style="display:inline-block;padding:14px 26px;color:#ffe500;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none">${escapeHtml(e.ctaLabel)}</a></td></tr></table>
${e.footerHtml}
</td></tr></table>
</td></tr></table>${pixel}
</body></html>`;
}

/** RFC 8058 one-click unsubscribe headers (required by Gmail/Yahoo for bulk senders). */
export function listUnsubscribeHeaders(unsubscribeUrl: string, mailto: string | null): Record<string, string> {
  const targets = [`<${unsubscribeUrl}>`];
  if (mailto) targets.push(`<mailto:${mailto}?subject=unsubscribe>`);
  return {
    "List-Unsubscribe": targets.join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ---------------------------------------------------------------------------
// Provider responses and engagement quality
// ---------------------------------------------------------------------------

export type SendOutcome = "sent" | "retry" | "rate_limited" | "failed" | "pause_campaign";

/** What to do with a message after a Resend HTTP status. */
export function classifySendStatus(status: number): SendOutcome {
  if (status >= 200 && status < 300) return "sent";
  if (status === 429) return "rate_limited";
  // 401/403: bad key or unverified sending domain — every message would fail, so stop.
  if (status === 401 || status === 403) return "pause_campaign";
  if (status === 400 || status === 422) return "failed";
  return "retry";
}

/** Backoff for retryable failures: 5, 15, 45 minutes. */
export function retryDelayMinutes(attempt: number): number {
  return 5 * Math.pow(3, Math.max(0, attempt - 1));
}

export const OUTREACH_MAX_ATTEMPTS = 4;

const BOT_UA = /(bot|crawler|spider|scanner|barracuda|mimecast|proofpoint|safelinks|symantec|forcepoint|trendmicro|urlscan|headless|python-requests|curl\/|wget)/i;

/**
 * Corporate mail filters open messages and follow links within seconds of
 * delivery. Treat those hits as suspected bots so they don't inflate results.
 */
export function isSuspectedBot(opts: { userAgent: string | null; sentAt: string | null; now: Date; type: "open" | "click" }): boolean {
  if (opts.userAgent && BOT_UA.test(opts.userAgent)) return true;
  if (!opts.sentAt) return false;
  const ageMs = opts.now.getTime() - new Date(opts.sentAt).getTime();
  const threshold = opts.type === "click" ? 10_000 : 2_000;
  return ageMs >= 0 && ageMs < threshold;
}
