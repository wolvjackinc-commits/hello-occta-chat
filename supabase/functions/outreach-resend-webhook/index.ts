// Resend delivery webhook for outreach emails (delivered, delayed, bounced,
// complained). Requests are verified with the Svix signature scheme using
// RESEND_WEBHOOK_SECRET ("whsec_..."). Events for non-outreach emails are
// acknowledged and ignored.
import { getServiceClient } from "../_shared/quoteHelpers.ts";
import { verifySvix } from "../_shared/svix.ts";

const headers = { "Content-Type": "application/json" };

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; bounce?: { type?: string; subType?: string; message?: string } };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return new Response(JSON.stringify({ error: "webhook_not_configured" }), { status: 503, headers });

  const body = await req.text();
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signature = req.headers.get("svix-signature") ?? "";
  if (!id || !timestamp || !signature || !(await verifySvix({ secret, id, timestamp, signatureHeader: signature, body }))) {
    return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401, headers });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
  }

  const providerId = event.data?.email_id;
  const type = event.type ?? "";
  if (!providerId) return new Response(JSON.stringify({ ok: true, ignored: "no_email_id" }), { status: 200, headers });

  const db = getServiceClient();
  const { data: message } = await db
    .from("outreach_messages")
    .select("id, campaign_id, email, status")
    .eq("provider_message_id", providerId)
    .maybeSingle();
  if (!message) return new Response(JSON.stringify({ ok: true, ignored: "not_outreach" }), { status: 200, headers });

  const at = event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? event.created_at : new Date().toISOString();
  const logEvent = async (eventType: string, meta: Record<string, unknown> = {}) => {
    const { error } = await db.from("outreach_events").insert({
      message_id: message.id, campaign_id: message.campaign_id, event_type: eventType,
      provider_event_id: id, occurred_at: at, meta,
    });
    // Unique violation = Svix redelivery of an event we already stored.
    return !error;
  };

  switch (type) {
    case "email.delivered": {
      if (!(await logEvent("delivered"))) break;
      await db.from("outreach_messages").update({ delivered_at: at, status: "delivered" }).eq("id", message.id).eq("status", "sent");
      await db.from("outreach_messages").update({ delivered_at: at }).eq("id", message.id).is("delivered_at", null);
      break;
    }
    case "email.delivery_delayed":
      await logEvent("delivery_delayed");
      break;
    case "email.bounced": {
      const bounceType = (event.data?.bounce?.type ?? "").toLowerCase();
      const permanent = bounceType !== "transient";
      if (!(await logEvent("bounce", { bounce: event.data?.bounce ?? null, permanent }))) break;
      if (permanent) {
        await db.from("outreach_messages").update({ status: "bounced", bounced_at: at }).eq("id", message.id);
        await db.rpc("outreach_suppress", { p_email: message.email, p_reason: "hard_bounce", p_source: "resend_webhook", p_message_id: null });
      }
      break;
    }
    case "email.complained": {
      if (!(await logEvent("complaint"))) break;
      await db.from("outreach_messages").update({ status: "complained", complained_at: at }).eq("id", message.id);
      await db.rpc("outreach_suppress", { p_email: message.email, p_reason: "complaint", p_source: "resend_webhook", p_message_id: null });
      break;
    }
    default:
      // Opens and clicks are measured by outreach-track; other events are ignored.
      break;
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
