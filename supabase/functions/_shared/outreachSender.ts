// Sending engine shared by outreach-worker (cron) and outreach-admin
// ("send next batch now" and test sends).
import {
  classifySendStatus,
  collectLinks,
  complianceFooterHtml,
  complianceFooterText,
  isOutreachEligible,
  isOwnSiteUrl,
  isWithinSendWindow,
  listUnsubscribeHeaders,
  OUTREACH_MAX_ATTEMPTS,
  renderPlaceholders,
  retryDelayMinutes,
  rewriteLinksForTracking,
  sendAllowance,
  startOfZonedDay,
  withCampaignParams,
  withOnSiteClickTracking,
  wrapEmailHtml,
  type OutreachVars,
} from "./outreach.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

// Read through globalThis so the unit tests (Node) can import this module too.
function envGet(key: string): string | undefined {
  return (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(key);
}

export const SITE_URL = (envGet("SITE_URL") || "https://www.occta.co.uk").replace(/\/$/, "");
export const PRIVACY_URL = `${SITE_URL}/privacy`;

export function functionsBase(): string {
  return `${(envGet("SUPABASE_URL") ?? "").replace(/\/$/, "")}/functions/v1`;
}

export type OutreachSettings = {
  sending_enabled: boolean;
  from_name: string;
  from_email: string | null;
  reply_to: string;
  daily_cap: number;
  hourly_cap: number;
  window_start_hour: number;
  window_end_hour: number;
  weekdays_only: boolean;
  recontact_cooldown_days: number;
  postal_address: string;
};

export type CampaignLink = { original: string | null; target: string };

export type OutreachCampaign = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subject: string;
  preheader: string | null;
  body_html: string;
  body_text: string;
  cta_label: string;
  cta_path: string;
  hero_image_url: string | null;
  flyer_ref: string | null;
  template_key: string | null;
  links: CampaignLink[];
};

export type OutreachContact = {
  id: string;
  business_name: string;
  email: string;
  area: string | null;
  district: string | null;
  category: string | null;
  status: string;
  lawful_basis: string;
  companies_house_verified: boolean;
  companies_house_number: string | null;
  legal_form: string;
  email_type: string;
  consent_evidence: string | null;
};

export type OutreachMessageRow = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  business_name: string | null;
  token: string;
  attempt_count: number;
};

export async function loadSettings(db: Db): Promise<OutreachSettings> {
  const { data, error } = await db.from("outreach_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`outreach settings unavailable: ${error?.message ?? "missing row"}`);
  return data as OutreachSettings;
}

/** Links for a campaign: index 0 is always the call to action. */
export function buildCampaignLinks(c: {
  slug: string;
  template_key: string | null;
  flyer_ref: string | null;
  cta_path: string;
  body_html: string;
}): CampaignLink[] {
  const params = { utmCampaign: c.slug, utmContent: c.template_key ?? "custom", flyerRef: c.flyer_ref };
  const links: CampaignLink[] = [{ original: null, target: withCampaignParams(`${SITE_URL}${c.cta_path}`, params) }];
  for (const original of collectLinks(c.body_html)) {
    links.push({ original, target: withCampaignParams(original, params) });
  }
  return links;
}

export function trackingUrls(token: string) {
  const base = functionsBase();
  const t = encodeURIComponent(token);
  return {
    click: (index: number) => `${base}/outreach-track?t=${t}&l=${index}`,
    pixel: `${base}/outreach-track?t=${t}&o=1`,
    // Shown to people: the website page. Used by mail clients: the function (RFC 8058 POST).
    unsubscribePage: `${SITE_URL}/unsubscribe?t=${t}`,
    unsubscribeOneClick: `${base}/outreach-unsubscribe?t=${t}`,
  };
}

export type RenderedEmail = {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

/**
 * Render one recipient's email. With `tracking: false` (test sends and
 * previews) links go straight to the site and no pixel is added.
 */
export function renderOutreachEmail(opts: {
  campaign: OutreachCampaign;
  settings: OutreachSettings;
  recipient: { email: string; business_name: string; area?: string | null; district?: string | null; category?: string | null };
  token: string;
  tracking: boolean;
}): RenderedEmail {
  const { campaign: c, settings: s, recipient: r, token, tracking } = opts;
  const urls = trackingUrls(token);
  const links = c.links.length ? c.links : buildCampaignLinks(c);
  // Our own pages report clicks themselves; only other sites go via the redirect tracker.
  const linkFor = (i: number) => {
    if (!tracking) return links[i].target;
    return isOwnSiteUrl(links[i].target) ? withOnSiteClickTracking(links[i].target, token, i) : urls.click(i);
  };
  const ctaUrl = linkFor(0);

  const vars: OutreachVars = {
    business_name: r.business_name,
    area: r.area ?? "",
    district: r.district ?? "",
    category: r.category ?? "",
    flyer_ref: c.flyer_ref ?? "",
    cta_url: ctaUrl,
    unsubscribe_url: urls.unsubscribePage,
    sender_name: s.from_name,
  };

  const originals = links.map((l) => l.original ?? "");
  const bodyHtml = rewriteLinksForTracking(
    renderPlaceholders(c.body_html, vars, "html"),
    originals,
    linkFor,
  );

  const footer = {
    businessName: r.business_name,
    postalAddress: s.postal_address,
    unsubscribeUrl: urls.unsubscribePage,
    privacyUrl: PRIVACY_URL,
  };

  const subject = renderPlaceholders(c.subject, vars, "text").replace(/\s+/g, " ").trim();
  const html = wrapEmailHtml({
    subject,
    preheader: c.preheader ? renderPlaceholders(c.preheader, vars, "text") : null,
    bodyHtml,
    ctaLabel: c.cta_label,
    ctaUrl,
    heroImageUrl: c.hero_image_url,
    footerHtml: complianceFooterHtml(footer),
    pixelUrl: tracking ? urls.pixel : null,
  });
  const text = `${renderPlaceholders(c.body_text, vars, "text").trim()}\n\n${complianceFooterText(footer)}\n`;

  return {
    from: `${s.from_name} <${s.from_email}>`,
    to: r.email,
    replyTo: s.reply_to,
    subject,
    html,
    text,
    headers: tracking ? listUnsubscribeHeaders(urls.unsubscribeOneClick, null) : {},
  };
}

export type ResendResult = { status: number; id: string | null; error: string | null };

export async function sendViaResend(email: RenderedEmail, opts: { idempotencyKey?: string; tags?: Record<string, string> } = {}): Promise<ResendResult> {
  const apiKey = envGet("RESEND_API_KEY");
  if (!apiKey) return { status: 401, id: null, error: "RESEND_API_KEY missing" };
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
        tags: Object.entries(opts.tags ?? {}).map(([name, value]) => ({ name, value })),
      }),
    });
    const raw = await res.text();
    let id: string | null = null;
    try {
      id = (JSON.parse(raw) as { id?: string }).id ?? null;
    } catch { /* non-JSON error body */ }
    return { status: res.status, id, error: res.ok ? null : raw.slice(0, 500) };
  } catch (e) {
    // Network failure: treat like a provider outage and retry later.
    return { status: 503, id: null, error: `network: ${(e as Error).message ?? String(e)}`.slice(0, 500) };
  }
}

export type TickResult = {
  ok: boolean;
  skipped?: string;
  claimed: number;
  sent: number;
  failed: number;
  suppressed: number;
  retried: number;
  paused_campaigns: string[];
  completed_campaigns: string[];
  promoted_campaigns: string[];
  allowance?: number;
};

async function release(db: Db, ids: string[], delaySeconds: number) {
  if (!ids.length) return;
  for (const id of ids) {
    const { data } = await db.from("outreach_messages").select("attempt_count").eq("id", id).single();
    await db.from("outreach_messages").update({
      status: "queued",
      locked_at: null,
      attempt_count: Math.max(0, (data?.attempt_count ?? 1) - 1),
      next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    }).eq("id", id).eq("status", "sending");
  }
}

/** One pass of the sender. Safe to run concurrently: claims use SKIP LOCKED. */
export async function runOutreachTick(db: Db, now = new Date()): Promise<TickResult> {
  const result: TickResult = {
    ok: true, claimed: 0, sent: 0, failed: 0, suppressed: 0, retried: 0,
    paused_campaigns: [], completed_campaigns: [], promoted_campaigns: [],
  };
  const settings = await loadSettings(db);

  // Scheduled campaigns whose time has come start sending.
  const { data: due } = await db.from("outreach_campaigns")
    .update({ status: "sending", started_at: now.toISOString() })
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .select("id");
  result.promoted_campaigns = (due ?? []).map((r: { id: string }) => r.id);

  const finish = async (skipped?: string) => {
    if (skipped) result.skipped = skipped;
    await completeFinishedCampaigns(db, result);
    await db.from("outreach_settings").update({
      last_worker_run_at: new Date().toISOString(),
      last_worker_result: result,
    }).eq("id", 1);
    return result;
  };

  if (!settings.sending_enabled) return finish("sending_disabled");
  if (!settings.from_email) return finish("from_email_not_set");
  if (!envGet("RESEND_API_KEY")) return finish("resend_key_missing");
  if (!isWithinSendWindow(now, settings)) return finish("outside_send_window");

  const dayStart = startOfZonedDay(now).toISOString();
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  const [{ count: sentToday }, { count: sentLastHour }] = await Promise.all([
    db.from("outreach_messages").select("id", { count: "exact", head: true }).gte("sent_at", dayStart),
    db.from("outreach_messages").select("id", { count: "exact", head: true }).gte("sent_at", hourAgo),
  ]);
  const allowance = sendAllowance({
    dailyCap: settings.daily_cap,
    hourlyCap: settings.hourly_cap,
    sentToday: sentToday ?? 0,
    sentLastHour: sentLastHour ?? 0,
  });
  result.allowance = allowance;
  if (allowance <= 0) return finish("cap_reached");

  const { data: claimed, error: claimError } = await db.rpc("outreach_claim_batch", { p_limit: allowance });
  if (claimError) throw new Error(`claim failed: ${claimError.message}`);
  const messages = (claimed ?? []) as OutreachMessageRow[];
  result.claimed = messages.length;
  if (!messages.length) return finish("nothing_due");

  const campaignIds = [...new Set(messages.map((m) => m.campaign_id))];
  const contactIds = [...new Set(messages.map((m) => m.contact_id).filter(Boolean))] as string[];
  const emails = [...new Set(messages.map((m) => m.email))];
  const [{ data: campaigns }, { data: contacts }, { data: suppressed }] = await Promise.all([
    db.from("outreach_campaigns").select("*").in("id", campaignIds),
    contactIds.length ? db.from("outreach_contacts").select("*").in("id", contactIds) : Promise.resolve({ data: [] }),
    db.from("outreach_suppressions").select("email").in("email", emails),
  ]);
  const campaignById = new Map<string, OutreachCampaign>((campaigns ?? []).map((c: OutreachCampaign) => [c.id, c]));
  const contactById = new Map<string, OutreachContact>((contacts ?? []).map((c: OutreachContact) => [c.id, c]));
  const suppressedSet = new Set<string>((suppressed ?? []).map((s: { email: string }) => s.email));
  const pausedCampaigns = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const campaign = campaignById.get(m.campaign_id);

    // Honour a Pause/Cancel pressed while this batch is running.
    const { data: live } = await db.from("outreach_campaigns").select("status").eq("id", m.campaign_id).maybeSingle();
    if (!campaign || !live || live.status !== "sending" || pausedCampaigns.has(m.campaign_id)) {
      pausedCampaigns.add(m.campaign_id);
      if (!live || live.status === "cancelled") {
        await db.from("outreach_messages").update({ status: "cancelled", locked_at: null }).eq("id", m.id).eq("status", "sending");
      } else {
        await release(db, [m.id], 0);
      }
      continue;
    }

    const contact = m.contact_id ? contactById.get(m.contact_id) : undefined;
    const blockReason = suppressedSet.has(m.email)
      ? "address is on the suppression list"
      : !contact
        ? "contact was deleted"
        : !isOutreachEligible(contact)
          ? "contact is no longer eligible"
          : null;
    if (blockReason) {
      await db.from("outreach_messages").update({ status: "suppressed", locked_at: null, last_error: blockReason }).eq("id", m.id);
      await db.from("outreach_events").insert({ message_id: m.id, campaign_id: m.campaign_id, event_type: "suppressed", meta: { reason: blockReason } });
      result.suppressed++;
      continue;
    }

    const email = renderOutreachEmail({
      campaign,
      settings,
      recipient: { email: m.email, business_name: contact!.business_name, area: contact!.area, district: contact!.district, category: contact!.category },
      token: m.token,
      tracking: true,
    });
    const res = await sendViaResend(email, { idempotencyKey: `outreach-${m.id}`, tags: { campaign: campaign.slug } });
    const outcome = classifySendStatus(res.status);

    if (outcome === "sent") {
      const sentAt = new Date().toISOString();
      await db.from("outreach_messages").update({
        status: "sent", sent_at: sentAt, provider_message_id: res.id, locked_at: null, last_error: null,
      }).eq("id", m.id);
      await db.from("outreach_events").insert({ message_id: m.id, campaign_id: m.campaign_id, event_type: "sent", meta: { provider_message_id: res.id } });
      if (contact) await db.from("outreach_contacts").update({ last_contacted_at: sentAt }).eq("id", contact.id);
      result.sent++;
    } else if (outcome === "rate_limited") {
      await release(db, messages.slice(i).map((x) => x.id), 60);
      result.retried += messages.length - i;
      break;
    } else if (outcome === "pause_campaign") {
      const reason = `Email provider refused the send (HTTP ${res.status}). Check the sending domain is verified in Resend. ${res.error ?? ""}`.trim().slice(0, 500);
      await db.from("outreach_campaigns").update({ status: "paused", paused_reason: reason }).eq("id", m.campaign_id).eq("status", "sending");
      pausedCampaigns.add(m.campaign_id);
      result.paused_campaigns.push(m.campaign_id);
      await release(db, [m.id], 0);
    } else if (outcome === "failed" || m.attempt_count >= OUTREACH_MAX_ATTEMPTS) {
      await db.from("outreach_messages").update({ status: "failed", locked_at: null, last_error: res.error }).eq("id", m.id);
      await db.from("outreach_events").insert({ message_id: m.id, campaign_id: m.campaign_id, event_type: "failed", meta: { status: res.status, error: res.error } });
      result.failed++;
    } else {
      await db.from("outreach_messages").update({
        status: "queued",
        locked_at: null,
        last_error: res.error,
        next_attempt_at: new Date(Date.now() + retryDelayMinutes(m.attempt_count) * 60_000).toISOString(),
      }).eq("id", m.id);
      result.retried++;
    }

    // Resend's default limit is 2 requests/second.
    if (i < messages.length - 1) await new Promise((r) => setTimeout(r, 600));
  }

  return finish();
}

async function completeFinishedCampaigns(db: Db, result: TickResult) {
  const { data: sending } = await db.from("outreach_campaigns").select("id").eq("status", "sending");
  for (const c of sending ?? []) {
    const { count } = await db.from("outreach_messages")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id)
      .in("status", ["queued", "sending"]);
    if ((count ?? 0) === 0) {
      await db.from("outreach_campaigns").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", c.id).eq("status", "sending");
      result.completed_campaigns.push(c.id);
    }
  }
}
