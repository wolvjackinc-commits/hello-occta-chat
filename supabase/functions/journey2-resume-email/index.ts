/**
 * Journey 2 — abandoned-checkout recovery worker (3 stages).
 *
 * Backup route only: a customer can always finish in one continuous session.
 * Service-to-service / cron only (x-cron-secret). Sends at most three emails
 * per saved checkout, idempotently recorded in public.checkout_reminders.
 * Never mentions money being taken, never promises a Direct Debit collection,
 * and never logs bank/card/DOB data.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, generateTokenPair,
  sendTrackedCommunication, brutalistEmailShell, escapeHtml,
} from "../_shared/quoteHelpers.ts";
import { loadJourneySettings } from "../_shared/journey2.ts";

const SITE = "https://www.occta.co.uk";
const MAX_REMINDERS = 4;
const BATCH = 25;

type SessionRow = {
  id: string;
  customer_details: { full_name?: string; email?: string; marketing_consent?: boolean } | null;
  current_step: string | null;
  plan_term: string | null;
  selected_addons: unknown;
  public_token_hash: string | null;
  reminder_count: number | null;
  reminder_last_queued_at: string | null;
};

function usefulFact(s: SessionRow): string {
  const addons = Array.isArray(s.selected_addons) ? (s.selected_addons as string[]) : [];
  if (s.plan_term === "price_lock_24") {
    return "Useful to know: Price Lock 24 is OCCTA's fixed-term option, for customers who prefer price certainty over a shorter minimum term.";
  }
  if (s.plan_term === "flex_30") {
    return "Useful to know: Flex 30 is OCCTA's rolling monthly option where available, for customers who prefer a shorter commitment.";
  }
  if (addons.includes("digital_voice")) {
    return "Useful to know: Digital Home Phone is a broadband add-on — it depends on your broadband connection and mains power.";
  }
  return "Useful to know: OCCTA confirms final availability, estimated speed, setup and order details with you before the order is placed.";
}

function copyFor(n: number, fact: string, firstName: string, switch50?: Record<string, any> | null) {
  const hi = `<p>Hi ${escapeHtml(firstName)},</p>`;
  if (n === 1) return {
    subject: "Your OCCTA order is saved — pick up where you left off", title: "Your order is saved",
    html: `${hi}<p>You were part-way through your OCCTA order, so we've kept the progress you'd already made.</p><p><strong>Nothing has been charged and no Direct Debit has been set up.</strong> You'll see everything again before the order is placed.</p><p>${fact}</p><p>The secure link below returns you to the exact stage you reached. It's personal to you — please don't forward it.</p>`,
  };
  if (n === 2) return {
    subject: "A quick note before you finish your OCCTA order", title: "Carry on when you're ready",
    html: `${hi}<p>Your saved OCCTA order is still incomplete. If you were comparing options or simply got interrupted, there's no need to start again.</p><p>${fact}</p><p>You can review your saved choices, the contract information and your billing details before submitting anything.</p>`,
  };
  if (n === 4 && switch50) {
    const endDate = new Date(String(switch50.ends_at)).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });
    return {
      subject: "£50 Switch Cash is available on eligible OCCTA orders", title: "£50 Switch Cash",
      html: `${hi}<p>You previously started an OCCTA broadband order and asked to receive offers from us.</p><p><strong>Our £50 Switch Cash offer is now live.</strong> It applies to an eligible new residential <strong>Essential Fibre — Price Lock 24</strong> order placed by ${escapeHtml(endDate)}.</p><p>The £50 reward is separate from your broadband bill and does not reduce the £34.99 monthly broadband price. It becomes eligible 30 days after service activation once the first broadband invoice has been paid and the account remains eligible. One reward per eligible service address. Terms apply.</p><p>Your secure button below reopens the exact saved checkout. You can review or change your plan before submitting anything.</p><p style="font-size:12px;opacity:.75">You received this offer because marketing consent is recorded on your saved checkout. If you no longer want marketing messages, contact privacy@occta.co.uk.</p>`,
    };
  }
  return {
    subject: "Still want to continue your OCCTA order?", title: "Final automatic reminder",
    html: `${hi}<p>This is our final automatic reminder about this saved order.</p><p>If you'd still like to continue, use the secure link below. If you'd rather not, no action is needed — nothing has been charged.</p><p>${fact}</p><p>If something stopped you finishing, call <strong>0800 260 6626</strong> or email <strong>hello@occta.co.uk</strong> and we'll help.</p>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const provided = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_JOB_SECRET") || Deno.env.get("CRON_SECRET");
  if (!expected || !provided || provided !== expected) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);
  if (!settings.customer_journey_v2_abandoned_resume_enabled) {
    return jsonResponse({ ok: true, skipped: "resume_disabled", sent: 0, considered: 0 });
  }

  const delayMin = Math.max(5, Number(settings.customer_journey_v2_resume_delay_minutes ?? 60));
  const nowIso = new Date().toISOString();
  const { data: switch50 } = await supabase
    .from("offer_campaigns")
    .select("code, title, reward_amount, reward_currency, starts_at, ends_at, terms_version, terms_text")
    .eq("code", "SWITCH50")
    .eq("active", true)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso)
    .maybeSingle();
  const stage1Cutoff = new Date(Date.now() - delayMin * 60_000).toISOString();
  const stage2Cutoff = new Date(Date.now() - 23 * 3_600_000).toISOString();
  const stage3Cutoff = new Date(Date.now() - 47 * 3_600_000).toISOString();

  const { data: sessions, error: loadErr } = await supabase
    .from("customer_journey_sessions")
    .select("id, customer_details, current_step, plan_term, selected_addons, public_token_hash, reminder_count, reminder_last_queued_at")
    .eq("journey_version", "v2")
    .not("checkout_tracking_started_at", "is", null)
    .not("abandoned_at", "is", null)
    .is("completed_at", null)
    .is("submitted_at", null)
    .in("status", ["active", "contract_prepared", "contract_accepted"])
    .or("test_session.is.null,test_session.eq.false")
    .gt("expires_at", nowIso)
    .lt("last_activity_at", stage1Cutoff)
    .lt("reminder_count", MAX_REMINDERS)
    // Stage 4 is marketing-only. Sessions that have exhausted the three
    // service reminders and carry no marketing consent can never receive
    // another email, so they must not occupy the batch forever.
    .or("reminder_count.lt.3,customer_details->>marketing_consent.eq.true")
    .not("customer_details->>email", "is", null)
    .neq("customer_details->>email", "")
    .or(`reminder_last_queued_at.is.null,reminder_last_queued_at.lt.${stage2Cutoff}`)
    .order("last_activity_at", { ascending: true })
    .limit(BATCH);

  if (loadErr) return jsonResponse({ ok: false, error: "load_failed", detail: loadErr.message }, 500);

  let sent = 0, failed = 0, skipped = 0;
  const reasons: Record<string, number> = {};
  const skip = (r: string) => { skipped++; reasons[r] = (reasons[r] ?? 0) + 1; };

  for (const raw of (sessions ?? []) as SessionRow[]) {
    const s = raw;
    const count = Number(s.reminder_count ?? 0);
    const next = count + 1;
    if (next > MAX_REMINDERS) { skip("max_reached"); continue; }
    if (next === 4 && (s.customer_details?.marketing_consent !== true || !switch50)) {
      skip(s.customer_details?.marketing_consent === true ? "switch50_unavailable" : "marketing_consent_required");
      continue;
    }

    if (count > 0) {
      const last = s.reminder_last_queued_at;
      if (!last) { skip("no_last_queued"); continue; }
      const gate = count === 1 ? stage2Cutoff : stage3Cutoff;
      if (last >= gate) { skip("spacing_gate"); continue; }
    }

    const email = (s.customer_details?.email ?? "").trim().toLowerCase();
    if (!email) { skip("no_email"); continue; }

    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email")
      .ilike("email", email)
      .maybeSingle();
    if (suppressed) { skip("suppressed"); continue; }

    const { data: existing } = await supabase
      .from("checkout_reminders")
      .select("id, status")
      .eq("journey_session_id", s.id)
      .eq("reminder_number", next)
      .maybeSingle();
    if (existing && existing.status === "sent") { skip("already_sent"); continue; }

    const firstName = (s.customer_details?.full_name ?? "there").trim().split(" ")[0] || "there";
    const { subject, title, html } = copyFor(next, usefulFact(s), firstName, switch50 as Record<string, any> | null);

    const previousHash = s.public_token_hash;
    const { raw: token, hash } = await generateTokenPair();

    const claim = await supabase
      .from("customer_journey_sessions")
      .update({ public_token_hash: hash, reminder_last_queued_at: new Date().toISOString() })
      .eq("id", s.id)
      .eq("reminder_count", count)
      .not("abandoned_at", "is", null)
      .is("completed_at", null)
      .is("submitted_at", null)
      .select("id")
      .maybeSingle();
    if (!claim.data) { skip("claim_failed:" + (claim.error?.message ?? "no_row")); continue; }

    const reminderRow = {
      journey_session_id: s.id,
      reminder_number: next,
      subject,
      stage: s.current_step,
      status: "queued",
      queued_at: new Date().toISOString(),
    };
    if (existing) {
      await supabase.from("checkout_reminders").update(reminderRow).eq("id", existing.id);
    } else {
      await supabase.from("checkout_reminders").insert(reminderRow);
    }

    const params = new URLSearchParams({
      utm_source: "occta",
      utm_medium: "email",
      utm_campaign: next === 4 ? "SWITCH50" : "abandoned_checkout",
      utm_content: `reminder_${next}`,
    });
    if (next === 4) params.set("offer", "SWITCH50");
    const url = `${SITE}/order/${encodeURIComponent(token)}?${params.toString()}`;
    const renderedHtml = brutalistEmailShell(title, html, { label: "Finish your order", url });
    const result = await sendTrackedCommunication(supabase, {
      template_name: `journey2_checkout_reminder_${next}`,
      recipient_email: email,
      subject,
      html: renderedHtml,
      metadata: { session_id: s.id, reminder_number: next, stage: s.current_step, campaign_code: next === 4 ? "SWITCH50" : null },
    });

    if (result.ok) {
      await supabase
        .from("customer_journey_sessions")
        .update({
          reminder_count: next,
          reminder_last_sent_at: new Date().toISOString(),
          resume_email_sent_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      await supabase
        .from("checkout_reminders")
        .update({ status: "sent", delivered_at: new Date().toISOString(), last_error: null })
        .eq("journey_session_id", s.id)
        .eq("reminder_number", next);
      sent++;
    } else {
      await supabase
        .from("customer_journey_sessions")
        .update({ public_token_hash: previousHash })
        .eq("id", s.id);
      await supabase
        .from("checkout_reminders")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          last_error: String(result.error).slice(0, 500),
        })
        .eq("journey_session_id", s.id)
        .eq("reminder_number", next);
      failed++;
    }
  }

  return jsonResponse({ ok: true, considered: (sessions ?? []).length, sent, failed, skipped, reasons });
});
