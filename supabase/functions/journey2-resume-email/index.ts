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
  sendResendEmail, brutalistEmailShell, escapeHtml, recordEmailCommunication,
} from "../_shared/quoteHelpers.ts";
import { loadJourneySettings } from "../_shared/journey2.ts";

const SITE = "https://www.occta.co.uk";
const MAX_REMINDERS = 3;
const BATCH = 25;

type SessionRow = {
  id: string;
  customer_details: { full_name?: string; email?: string } | null;
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

function copyFor(n: number, fact: string, firstName: string) {
  const hi = `<p>Hi ${escapeHtml(firstName)},</p>`;
  if (n === 1) {
    return {
      subject: "Your OCCTA order is saved — pick up where you left off",
      title: "Your order is saved",
      html: `${hi}
<p>You were part-way through your OCCTA order, so we've kept the progress you'd already made.</p>
<p><strong>Nothing has been charged and no Direct Debit has been set up.</strong> You'll see everything again before the order is placed.</p>
<p>${fact}</p>
<p>The secure link below returns you to the exact stage you reached. It's personal to you — please don't forward it.</p>`,
    };
  }
  if (n === 2) {
    return {
      subject: "A quick note before you finish your OCCTA order",
      title: "Carry on when you're ready",
      html: `${hi}
<p>Your saved OCCTA order is still incomplete. If you were comparing options or simply got interrupted, there's no need to start again.</p>
<p>${fact}</p>
<p>You can review your saved choices, the contract information and your billing details before submitting anything.</p>`,
    };
  }
  return {
    subject: "Still want to continue your OCCTA order?",
    title: "Final automatic reminder",
    html: `${hi}
<p>This is our final automatic reminder about this saved order.</p>
<p>If you'd still like to continue, use the secure link below. If you'd rather not, no action is needed — nothing has been charged.</p>
<p>${fact}</p>
<p>If something stopped you finishing, call <strong>0800 260 6626</strong> or email <strong>hello@occta.co.uk</strong> and we'll help.</p>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Service-to-service / cron only — same convention as the other deployed cron workers.
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
    // Only fetch contactable sessions. Without this, batches fill up with
    // sessions abandoned before the email was captured (address step), which
    // starves genuine candidates and nothing ever sends.
    .not("customer_details->>email", "is", null)
    .neq("customer_details->>email", "")
    // Exclude sessions still inside their spacing window, so they don't occupy
    // the batch (and starve other candidates) for the next 24h.
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

    // Spacing: #1 after the abandonment delay, #2 ~24h later, #3 ~48h after that.
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
    const { subject, title, html } = copyFor(next, usefulFact(s), firstName);

    // Fresh secure token for this reminder. If delivery fails we restore the
    // previous hash so an existing browser session is never broken.
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
    if (!claim.data) { skip("claim_failed:" + (claim.error?.message ?? "no_row")); continue; } // resumed, completed or already claimed

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

    const url = `${SITE}/order/${encodeURIComponent(token)}`;
    const result = await sendResendEmail({
      to: email,
      subject,
      html: brutalistEmailShell(title, html, { label: "Finish your order", url }),
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
      // Restore the prior browser token; do not advance the reminder counters.
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

    await recordEmailCommunication(supabase, {
      template_name: `journey2_checkout_reminder_${next}`,
      recipient_email: email,
      sendResult: result,
      metadata: { session_id: s.id, reminder_number: next, stage: s.current_step },
    });
  }

  return jsonResponse({ ok: true, considered: (sessions ?? []).length, sent, failed, skipped, reasons });
});
