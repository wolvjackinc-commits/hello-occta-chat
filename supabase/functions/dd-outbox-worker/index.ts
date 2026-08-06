// Direct Debit notification outbox worker.
//
// The ONLY place a Direct Debit status email is sent. Notifications are created
// atomically with the status change by public.dd_admin_change_mandate_status
// and drained here, server-side. The browser never sends a DD email.
//
// Test mandates never leave a `suppressed_test` row: nothing is sent and no
// provider is contacted (OCCTA's two providers are manual-portal only, so there
// is no provider API call anywhere in this file by design).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDDStatusEmail, sanitiseDDPayload, type DDStatusPayload } from "../_shared/ddStatusEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_RETRIES = 5;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body = drain pending */ }

  const outboxId = typeof body.outboxId === "string" ? body.outboxId : null;
  const isResend = body.resend === true;

  // A resend is an admin action and needs an authorised caller + audit trail.
  let actorId: string | null = null;
  if (isResend) {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Unauthorized" }, 401);
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return json({ success: false, error: "Unauthorized" }, 401);
    const { data: allowed } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    const { data: fin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "finance_admin" });
    if (!allowed && !fin) return json({ success: false, error: "Forbidden" }, 403);
    actorId = userData.user.id;
    if (!outboxId) return json({ success: false, error: "outboxId required for resend" }, 400);
  }

  let query = supabase
    .from("dd_email_outbox")
    .select("id, mandate_id, recipient_email, subject, payload, status, retry_count, is_test")
    .order("created_at", { ascending: true })
    .limit(25);

  if (outboxId) query = query.eq("id", outboxId);
  else query = query.eq("status", "pending");

  const { data: items, error } = await query;
  if (error) return json({ success: false, error: error.message }, 500);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const results: Array<Record<string, unknown>> = [];

  for (const item of items ?? []) {
    // Test mandates: evidence only. Never send, never call a provider.
    if (item.is_test) {
      await supabase
        .from("dd_email_outbox")
        .update({ status: "suppressed_test", last_attempt_at: new Date().toISOString(), last_error: null })
        .eq("id", item.id);
      results.push({ id: item.id, status: "suppressed_test" });
      continue;
    }

    if (!isResend && item.status !== "pending") {
      results.push({ id: item.id, status: item.status, skipped: true });
      continue;
    }

    if (!item.recipient_email) {
      await supabase
        .from("dd_email_outbox")
        .update({ status: "failed", last_error: "no_recipient_email", last_attempt_at: new Date().toISOString() })
        .eq("id", item.id);
      results.push({ id: item.id, status: "failed", error: "no_recipient_email" });
      continue;
    }

    await supabase
      .from("dd_email_outbox")
      .update({ status: "sending", last_attempt_at: new Date().toISOString() })
      .eq("id", item.id);

    const safePayload = sanitiseDDPayload((item.payload ?? {}) as Record<string, unknown>) as unknown as DDStatusPayload;
    const mail = buildDDStatusEmail(safePayload);

    try {
      if (!resendKey) throw new Error("email_provider_not_configured");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "OCCTA <billing@occta.co.uk>",
          to: [item.recipient_email],
          subject: item.subject || mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });
      if (!res.ok) throw new Error(`provider_${res.status}`);

      await supabase
        .from("dd_email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", item.id);
      results.push({ id: item.id, status: "sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      const retries = (item.retry_count ?? 0) + 1;
      await supabase
        .from("dd_email_outbox")
        .update({
          status: retries >= MAX_RETRIES ? "failed" : "pending",
          retry_count: retries,
          last_error: message,
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      results.push({ id: item.id, status: "failed", error: message, retry_count: retries });
    }

    if (isResend && actorId) {
      await supabase.from("audit_logs").insert({
        actor_user_id: actorId,
        action: "dd_notification_resend",
        entity: "dd_email_outbox",
        entity_id: item.id,
        metadata: { mandate_id: item.mandate_id, subject: item.subject },
      });
    }
  }

  return json({ success: true, processed: results.length, results });
});