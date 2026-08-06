/**
 * Journey 2 — abandoned-session resume email.
 *
 * Backup route only: the customer can always finish in one continuous session.
 * Sends at most one resume email per session, only when the admin setting is
 * enabled and the configured delay has elapsed. Never mentions payment being
 * taken and never promises a Direct Debit collection.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, generateTokenPair,
  sendResendEmail, brutalistEmailShell, escapeHtml, recordEmailCommunication,
} from "../_shared/quoteHelpers.ts";
import { loadJourneySettings } from "../_shared/journey2.ts";

const SITE = "https://www.occta.co.uk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Service-to-service / cron only.
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected || cronSecret !== expected) return jsonResponse({ error: "forbidden" }, 403);

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);
  if (!settings.customer_journey_v2_abandoned_resume_enabled) {
    return jsonResponse({ ok: true, skipped: "resume_disabled", sent: 0 });
  }

  const delayMin = Math.max(1, Number(settings.customer_journey_v2_resume_delay_minutes ?? 60));
  const cutoff = new Date(Date.now() - delayMin * 60_000).toISOString();

  const { data: sessions } = await supabase
    .from("customer_journey_sessions")
    .select("id, customer_details, current_step, last_activity_at, expires_at, test_session")
    .eq("journey_version", "v2")
    .in("status", ["active", "contract_prepared"])
    .is("resume_email_sent_at", null)
    .is("completed_at", null)
    .lt("last_activity_at", cutoff)
    .gt("expires_at", new Date().toISOString())
    .limit(50);

  let sent = 0;
  for (const s of sessions ?? []) {
    const details = s.customer_details as { full_name?: string; email?: string } | null;
    if (!details?.email) continue;
    if (s.test_session) continue;

    const { raw, hash } = await generateTokenPair();
    const upd = await supabase
      .from("customer_journey_sessions")
      .update({ public_token_hash: hash, resume_email_sent_at: new Date().toISOString() })
      .eq("id", s.id)
      .is("resume_email_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!upd.data) continue; // another worker already sent it

    const url = `${SITE}/order/${encodeURIComponent(raw)}`;
    const result = await sendResendEmail({
      to: details.email,
      subject: "Pick up your OCCTA order where you left off",
      html: brutalistEmailShell(
        "Your order is saved",
        `<p>Hi ${escapeHtml((details.full_name ?? "there").split(" ")[0])},</p>
         <p>Your OCCTA order is saved and ready to finish. Nothing has been charged and no Direct Debit has been set up.</p>
         <p>Use the secure link below to carry on from the step you reached. The link is personal to you — please don't forward it.</p>
         <p style="font-size:12px;color:#555;">Prefer to talk it through? Call 0800 260 6626 or email hello@occta.co.uk.</p>`,
        { label: "Finish your order", url },
      ),
    });
    await recordEmailCommunication(supabase, {
      template_name: "journey2_resume_session",
      recipient_email: details.email,
      sendResult: result,
      metadata: { session_id: s.id, step: s.current_step },
    });
    if (result.ok) sent++;
  }

  return jsonResponse({ ok: true, sent, considered: (sessions ?? []).length });
});