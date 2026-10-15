// Admin actions for the outreach campaign manager. Staff only
// (admin, super_admin — the same roles that can open /admin).
//
// Actions:
//   audience_preview { audience }                     -> who would receive a campaign
//   preview          { campaign_id, contact_id? }     -> rendered HTML/text, nothing sent
//   test_send        { campaign_id, to }              -> one [TEST] email to staff, untracked
//   launch           { campaign_id, expected_count, scheduled_at? }
//   pause | resume | cancel { campaign_id }
//   run_worker       {}                               -> send the next batch now (caps/window still apply)
//   import_contacts  { rows, import_batch }           -> validated upsert
//   suppress         { email, note }                  -> manual do-not-contact
//   mark_replied     { message_id }
import { corsHeaders, getServiceClient, jsonResponse, requireStaff } from "../_shared/quoteHelpers.ts";
import {
  classifyEmailType,
  CONSUMER_CATEGORY,
  generateOutreachToken,
  isConsumerCategory,
  normaliseEmail,
  OUTREACH_PLACEHOLDERS,
  unknownPlaceholders,
} from "../_shared/outreach.ts";
import {
  buildCampaignLinks,
  loadSettings,
  renderOutreachEmail,
  runOutreachTick,
  sendViaResend,
  type OutreachCampaign,
} from "../_shared/outreachSender.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

const STAFF_ROLES = ["admin", "super_admin"];
const MAX_CAMPAIGN_RECIPIENTS = 2000;
const MAX_IMPORT_ROWS = 5000;

type Audience = {
  categories?: string[];
  priorities?: string[];
  districts?: string[];
  tags?: string[];
  contact_ids?: string[];
};

function asStringArray(v: unknown, max = 200): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()).slice(0, max) : [];
}

function parseAudience(raw: unknown): Audience {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    categories: asStringArray(a.categories),
    priorities: asStringArray(a.priorities).filter((p) => ["A", "B", "C"].includes(p)),
    districts: asStringArray(a.districts),
    tags: asStringArray(a.tags),
    contact_ids: asStringArray(a.contact_ids, MAX_CAMPAIGN_RECIPIENTS),
  };
}

function isConsumerAudience(audience: Audience): boolean {
  return (audience.categories ?? []).some((c) => isConsumerCategory(c));
}

type AudienceRow = { id: string; email: string; business_name: string; category: string | null; district: string | null; priority: string | null };

/** Eligible, not suppressed, not contacted within the cooldown. */
async function resolveAudience(db: Db, audience: Audience, cooldownDays: number) {
  let q = db.from("outreach_contacts")
    .select("id, email, business_name, category, district, priority, last_contacted_at")
    .eq("eligible", true)
    .order("priority", { ascending: true, nullsFirst: false })
    .order("business_name")
    .limit(MAX_CAMPAIGN_RECIPIENTS + 1);
  // Opted-in customers only ever receive campaigns aimed at them, and those
  // campaigns go to nobody else.
  if (isConsumerAudience(audience)) q = q.eq("category", CONSUMER_CATEGORY);
  else {
    q = q.or(`category.is.null,category.neq.${CONSUMER_CATEGORY}`);
    if (audience.categories?.length) q = q.in("category", audience.categories);
  }
  if (audience.priorities?.length) q = q.in("priority", audience.priorities);
  if (audience.districts?.length) q = q.in("district", audience.districts);
  if (audience.tags?.length) q = q.overlaps("tags", audience.tags);
  if (audience.contact_ids?.length) q = q.in("id", audience.contact_ids);
  const { data, error } = await q;
  if (error) throw new Error(`audience query failed: ${error.message}`);
  const rows = (data ?? []) as (AudienceRow & { last_contacted_at: string | null })[];

  const emails = rows.map((r) => r.email);
  const suppressed = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const { data: s } = await db.from("outreach_suppressions").select("email").in("email", emails.slice(i, i + 500));
    for (const row of s ?? []) suppressed.add(row.email);
  }
  const cutoff = Date.now() - cooldownDays * 86_400_000;
  const recipients: AudienceRow[] = [];
  let excludedSuppressed = 0;
  let excludedRecent = 0;
  for (const r of rows) {
    if (suppressed.has(r.email)) { excludedSuppressed++; continue; }
    if (cooldownDays > 0 && r.last_contacted_at && Date.parse(r.last_contacted_at) > cutoff) { excludedRecent++; continue; }
    recipients.push({ id: r.id, email: r.email, business_name: r.business_name, category: r.category, district: r.district, priority: r.priority });
  }
  return { recipients, excludedSuppressed, excludedRecent, truncated: rows.length > MAX_CAMPAIGN_RECIPIENTS };
}

async function loadCampaign(db: Db, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("outreach_campaigns").select("*").eq("id", id).maybeSingle();
  return data as (OutreachCampaign & { audience: unknown; status: string; scheduled_at: string | null }) | null;
}

function contentProblems(c: Partial<OutreachCampaign>): string[] {
  const problems: string[] = [];
  if (!c.subject?.trim()) problems.push("Subject is empty");
  if (!c.body_html?.trim()) problems.push("HTML body is empty");
  if (!c.body_text?.trim()) problems.push("Plain-text body is empty");
  if (!c.cta_label?.trim()) problems.push("Button label is empty");
  if (!c.cta_path || !/^\/[A-Za-z0-9/_-]*$/.test(c.cta_path)) problems.push("Button link must be a page on occta.co.uk, e.g. /business/contact-sales");
  const unknown = unknownPlaceholders(`${c.subject ?? ""} ${c.preheader ?? ""} ${c.body_html ?? ""} ${c.body_text ?? ""}`, OUTREACH_PLACEHOLDERS);
  if (unknown.length) problems.push(`Unknown placeholders: ${unknown.map((u) => `{{${u}}}`).join(", ")}`);
  if (/<script|javascript:/i.test(c.body_html ?? "")) problems.push("Scripts are not allowed in email content");
  return problems;
}

const SAMPLE_RECIPIENT = { email: "info@example.co.uk", business_name: "Example Bakery Ltd", area: "Town centre / HD1", district: "HD1", category: "Food & Drink" };
// Consumer contacts store the customer's first name in business_name.
const SAMPLE_CONSUMER = { email: "sam@example.co.uk", business_name: "Sam", area: "", district: "", category: CONSUMER_CATEGORY };

function sampleRecipientFor(campaign: { audience: unknown }) {
  return isConsumerAudience(parseAudience(campaign.audience)) ? SAMPLE_CONSUMER : SAMPLE_RECIPIENT;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, STAFF_ROLES);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const db = getServiceClient();

  try {
    switch (action) {
      case "audience_preview": {
        const settings = await loadSettings(db);
        const r = await resolveAudience(db, parseAudience(body.audience), settings.recontact_cooldown_days);
        return jsonResponse({
          ok: true,
          count: r.recipients.length,
          excluded_suppressed: r.excludedSuppressed,
          excluded_recent: r.excludedRecent,
          truncated: r.truncated,
          sample: r.recipients.slice(0, 25),
        });
      }

      case "preview": {
        const campaign = await loadCampaign(db, body.campaign_id);
        if (!campaign) return jsonResponse({ error: "campaign_not_found" }, 404);
        const settings = await loadSettings(db);
        let recipient = sampleRecipientFor(campaign);
        if (typeof body.contact_id === "string") {
          const { data: c } = await db.from("outreach_contacts").select("email, business_name, area, district, category").eq("id", body.contact_id).maybeSingle();
          if (c) recipient = c;
        }
        const email = renderOutreachEmail({
          campaign: { ...campaign, links: buildCampaignLinks(campaign) },
          settings: { ...settings, from_email: settings.from_email ?? "not-set@example.invalid" },
          recipient,
          token: "preview-token-0000000",
          tracking: false,
        });
        return jsonResponse({ ok: true, subject: email.subject, html: email.html, text: email.text, from: email.from, reply_to: email.replyTo, problems: contentProblems(campaign) });
      }

      case "test_send": {
        const campaign = await loadCampaign(db, body.campaign_id);
        if (!campaign) return jsonResponse({ error: "campaign_not_found" }, 404);
        const to = normaliseEmail(body.to);
        const { data: me } = await db.auth.admin.getUserById(auth.userId);
        const myEmail = normaliseEmail(me?.user?.email);
        // Test sends only go to the signed-in staff member or an occta.co.uk inbox.
        if (!to || !(to === myEmail || to.endsWith("@occta.co.uk"))) {
          return jsonResponse({ error: "test_recipient_not_allowed", message: "Send tests to your own login email or an @occta.co.uk address." }, 400);
        }
        const settings = await loadSettings(db);
        if (!settings.from_email) return jsonResponse({ error: "from_email_not_set", message: "Set the sending address in Settings first." }, 400);
        const problems = contentProblems(campaign);
        if (problems.length) return jsonResponse({ error: "content_invalid", problems }, 400);
        const email = renderOutreachEmail({
          campaign: { ...campaign, links: buildCampaignLinks(campaign) },
          settings,
          recipient: { ...sampleRecipientFor(campaign), email: to },
          token: "test-token-00000000000",
          tracking: false,
        });
        const res = await sendViaResend({ ...email, subject: `[TEST] ${email.subject}` }, { tags: { campaign: "outreach-test" } });
        await db.from("outreach_events").insert({
          campaign_id: campaign.id, event_type: "test_sent",
          meta: { to, status: res.status, error: res.error, by: auth.userId },
        });
        if (res.status < 200 || res.status >= 300) return jsonResponse({ error: "send_failed", status: res.status, detail: res.error }, 502);
        return jsonResponse({ ok: true, provider_message_id: res.id });
      }

      case "launch": {
        const campaign = await loadCampaign(db, body.campaign_id);
        if (!campaign) return jsonResponse({ error: "campaign_not_found" }, 404);
        if (campaign.status !== "draft") return jsonResponse({ error: "not_draft", message: `Campaign is ${campaign.status}.` }, 409);
        const settings = await loadSettings(db);
        if (!settings.from_email) return jsonResponse({ error: "from_email_not_set", message: "Set the sending address in Settings first." }, 400);
        const problems = contentProblems(campaign);
        if (problems.length) return jsonResponse({ error: "content_invalid", problems }, 400);

        let scheduledAt: string | null = null;
        if (typeof body.scheduled_at === "string" && body.scheduled_at) {
          const t = Date.parse(body.scheduled_at);
          if (Number.isNaN(t)) return jsonResponse({ error: "invalid_schedule" }, 400);
          if (t > Date.now() + 60_000) scheduledAt = new Date(t).toISOString();
        }

        const audience = parseAudience(campaign.audience);
        const r = await resolveAudience(db, audience, settings.recontact_cooldown_days);
        if (r.truncated) return jsonResponse({ error: "audience_too_large", message: `Narrow the audience to ${MAX_CAMPAIGN_RECIPIENTS} or fewer.` }, 400);
        if (!r.recipients.length) return jsonResponse({ error: "audience_empty", message: "No eligible recipients match this audience." }, 400);
        // The person launching must have seen the exact number being sent.
        if (Number(body.expected_count) !== r.recipients.length) {
          return jsonResponse({ error: "count_changed", count: r.recipients.length, message: `The audience is now ${r.recipients.length}. Review and launch again.` }, 409);
        }

        // 1. Claim the draft (launched_at is the lock) so a double click cannot
        //    launch twice. It stays a draft, so the sender ignores it for now.
        const links = buildCampaignLinks(campaign);
        const { data: claimed, error: claimError } = await db.from("outreach_campaigns")
          .update({
            launched_at: new Date().toISOString(),
            launched_by: auth.userId,
            links,
            total_recipients: r.recipients.length,
            paused_reason: null,
          })
          .eq("id", campaign.id)
          .eq("status", "draft")
          // A launch interrupted more than 5 minutes ago can be retried.
          .or(`launched_at.is.null,launched_at.lt.${new Date(Date.now() - 5 * 60_000).toISOString()}`)
          .select("id")
          .maybeSingle();
        if (claimError || !claimed) return jsonResponse({ error: "launch_conflict", message: "This campaign is already launching or was changed by someone else. Refresh and try again." }, 409);
        // Clear anything left by an interrupted earlier attempt (never sent: the campaign was still a draft).
        await db.from("outreach_messages").delete().eq("campaign_id", campaign.id);

        const unclaim = async () => {
          await db.from("outreach_messages").delete().eq("campaign_id", campaign.id);
          await db.from("outreach_campaigns").update({ launched_at: null, launched_by: null, total_recipients: 0 }).eq("id", campaign.id).eq("status", "draft");
        };

        // 2. Queue every recipient while the campaign is still a draft.
        const rows = r.recipients.map((c) => ({
          campaign_id: campaign.id,
          contact_id: c.id,
          email: c.email,
          business_name: c.business_name,
          token: generateOutreachToken(),
          status: "queued",
        }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await db.from("outreach_messages").insert(rows.slice(i, i + 500));
          if (error) {
            await unclaim();
            return jsonResponse({ error: "launch_failed", message: error.message }, 500);
          }
        }

        // 3. Only now does the sender see it. Doing this last means a sender run
        //    can never find a "sending" campaign with an empty queue and close it.
        const { data: live, error: liveError } = await db.from("outreach_campaigns")
          .update({
            status: scheduledAt ? "scheduled" : "sending",
            scheduled_at: scheduledAt,
            started_at: scheduledAt ? null : new Date().toISOString(),
          })
          .eq("id", campaign.id)
          .eq("status", "draft")
          .select("id")
          .maybeSingle();
        if (liveError || !live) {
          await unclaim();
          return jsonResponse({ error: "launch_failed", message: liveError?.message ?? "Campaign changed during launch. Nothing was sent." }, 500);
        }
        return jsonResponse({ ok: true, queued: rows.length, status: scheduledAt ? "scheduled" : "sending", sending_enabled: settings.sending_enabled });
      }

      case "pause": {
        const { data } = await db.from("outreach_campaigns").update({ status: "paused", paused_reason: "Paused by staff" })
          .eq("id", body.campaign_id).in("status", ["sending", "scheduled"]).select("id").maybeSingle();
        return data ? jsonResponse({ ok: true }) : jsonResponse({ error: "cannot_pause" }, 409);
      }

      case "resume": {
        const { data } = await db.from("outreach_campaigns").update({ status: "sending", paused_reason: null, started_at: new Date().toISOString() })
          .eq("id", body.campaign_id).eq("status", "paused").select("id").maybeSingle();
        return data ? jsonResponse({ ok: true }) : jsonResponse({ error: "cannot_resume" }, 409);
      }

      case "cancel": {
        const { data } = await db.from("outreach_campaigns").update({ status: "cancelled", completed_at: new Date().toISOString() })
          .eq("id", body.campaign_id).in("status", ["scheduled", "sending", "paused"]).select("id").maybeSingle();
        if (!data) return jsonResponse({ error: "cannot_cancel" }, 409);
        // A message mid-send that does go out is re-marked 'sent' by the sender, so this stays accurate.
        await db.from("outreach_messages").update({ status: "cancelled", locked_at: null }).eq("campaign_id", body.campaign_id).in("status", ["queued", "sending"]);
        return jsonResponse({ ok: true });
      }

      case "run_worker": {
        const result = await runOutreachTick(db);
        return jsonResponse({ ok: true, result });
      }

      case "import_contacts": {
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_IMPORT_ROWS) : [];
        const batch = typeof body.import_batch === "string" ? body.import_batch.slice(0, 120) : `import-${new Date().toISOString().slice(0, 10)}`;
        const valid: Record<string, unknown>[] = [];
        const rejected: { row: number; reason: string }[] = [];
        const seen = new Set<string>();
        rows.forEach((raw: unknown, index: number) => {
          const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
          const email = normaliseEmail(r.email);
          const name = typeof r.business_name === "string" ? r.business_name.trim().slice(0, 300) : "";
          if (!email) return rejected.push({ row: index + 1, reason: "invalid email" });
          if (!name) return rejected.push({ row: index + 1, reason: "missing business name" });
          if (seen.has(email)) return rejected.push({ row: index + 1, reason: "duplicate email in file" });
          seen.add(email);
          const str = (k: string, max = 500) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).trim().slice(0, max) : null);
          const legal = str("legal_form", 40) ?? "unknown";
          const chNumber = str("companies_house_number", 20);
          const chVerified = r.companies_house_verified === true && Boolean(chNumber);
          const emailType = ["role", "personal", "unknown"].includes(String(r.email_type)) ? String(r.email_type) : classifyEmailType(email);
          valid.push({
            email,
            business_name: name,
            email_type: emailType,
            category: str("category", 120),
            subcategory: str("subcategory", 120),
            address: str("address"),
            postcode: str("postcode", 12),
            area: str("area", 120),
            district: str("district", 12),
            phone: str("phone", 40),
            website: str("website"),
            legal_form: ["limited_company", "llp", "plc", "public_body", "company_other", "sole_trader", "partnership", "charity_unincorporated", "unknown"].includes(legal) ? legal : "unknown",
            companies_house_number: chNumber,
            companies_house_verified: chVerified,
            companies_house_match_basis: str("companies_house_match_basis", 200),
            // A corporate lawful basis is only recorded once Companies House confirms the company.
            lawful_basis: chVerified ? "corporate_subscriber" : "none",
            priority: ["A", "B", "C"].includes(String(r.priority)) ? String(r.priority) : null,
            source: str("source", 200),
            source_urls: str("source_urls", 2000),
            why_good_fit: str("why_good_fit", 1000),
            import_batch: batch,
            created_by: auth.userId,
          });
        });

        // Never reactivate an address that has opted out, bounced or complained.
        const emails = valid.map((v) => v.email as string);
        const blocked = new Set<string>();
        for (let i = 0; i < emails.length; i += 500) {
          const { data: s } = await db.from("outreach_suppressions").select("email").in("email", emails.slice(i, i + 500));
          for (const row of s ?? []) blocked.add(row.email);
        }
        let upserted = 0;
        for (let i = 0; i < valid.length; i += 500) {
          const chunk = valid.slice(i, i + 500).map((v) => (blocked.has(v.email as string) ? { ...v, status: "do_not_contact" } : v));
          const { data, error } = await db.from("outreach_contacts").upsert(chunk, { onConflict: "email", ignoreDuplicates: false }).select("id");
          if (error) return jsonResponse({ error: "import_failed", message: error.message, upserted, rejected }, 500);
          upserted += data?.length ?? 0;
        }
        // Upserts above can overwrite status; re-apply suppression for anyone on the list.
        if (blocked.size) {
          await db.from("outreach_contacts").update({ status: "do_not_contact" }).in("email", [...blocked]).eq("status", "active");
        }
        const { count: eligible } = await db.from("outreach_contacts").select("id", { count: "exact", head: true }).eq("import_batch", batch).eq("eligible", true);
        return jsonResponse({ ok: true, upserted, rejected, suppressed_on_import: blocked.size, eligible_in_batch: eligible ?? 0 });
      }

      case "suppress": {
        const email = normaliseEmail(body.email);
        if (!email) return jsonResponse({ error: "invalid_email" }, 400);
        const { error } = await db.rpc("outreach_suppress", { p_email: email, p_reason: "manual", p_source: `staff:${auth.userId}`, p_message_id: null });
        if (error) return jsonResponse({ error: "suppress_failed", message: error.message }, 500);
        if (typeof body.note === "string" && body.note.trim()) {
          await db.from("outreach_suppressions").update({ note: body.note.trim().slice(0, 500), created_by: auth.userId }).eq("email", email);
        }
        return jsonResponse({ ok: true });
      }

      case "mark_replied": {
        const { data: m } = await db.from("outreach_messages").update({ replied_at: new Date().toISOString() })
          .eq("id", body.message_id).is("replied_at", null).select("id, campaign_id").maybeSingle();
        if (!m) return jsonResponse({ error: "not_found_or_already_marked" }, 404);
        await db.from("outreach_events").insert({ message_id: m.id, campaign_id: m.campaign_id, event_type: "replied", meta: { by: auth.userId } });
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    console.error("outreach-admin failed", action, message);
    return jsonResponse({ error: "internal_error", message: message.slice(0, 300) }, 500);
  }
});
