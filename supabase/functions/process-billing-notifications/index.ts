/**
 * Sends only status notifications. Never attaches or embeds invoices/receipts.
 * Invocation is protected by the existing server cron secret.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, apikey, content-type",
  "Content-Type": "application/json" };
const reply = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("CRON_JOB_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return reply({ error: "unauthorized" }, 401);
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: entries, error } = await db.from("billing_notifications_outbox")
    .select("id, user_id, invoice_id, kind, amount, status, attempts")
    .in("status", ["pending", "retry"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) return reply({ error: "outbox_unavailable" }, 503);
  let sent = 0, retry = 0, dead = 0;
  for (const item of entries ?? []) {
    const { data: lock } = await db.from("billing_notifications_outbox")
      .update({ status: "processing", attempts: item.attempts + 1 })
      .eq("id", item.id).eq("status", item.status)
      .select("id").maybeSingle();
    if (!lock) continue;
    try {
      const { data: profile } = await db.from("profiles").select("email, full_name")
        .eq("id", item.user_id).maybeSingle();
      const { data: invoice } = await db.from("invoices")
        .select("invoice_number, status").eq("id", item.invoice_id).maybeSingle();
      if (!profile?.email || !invoice) throw new Error("notification_identity_missing");
      if (item.kind === "payment_received" && invoice.status !== "paid") {
        throw new Error("payment_status_not_confirmed");
      }
      const amount = "£" + Number(item.amount).toFixed(2);
      const title = item.kind === "payment_received" ? "Payment received" : "Payment update";
      const message = item.kind === "payment_received"
        ? "Your payment of " + amount + " has been confirmed and allocated to invoice " + invoice.invoice_number + "."
        : "We have received an update regarding the payment attempt for invoice " + invoice.invoice_number + ". Please review your account.";
      const { data, error: sendError } = await db.functions.invoke("send-email", {
        body: {
          type: "custom_admin",
          to: profile.email,
          userId: item.user_id,
          invoiceId: item.invoice_id,
          logToCommunications: true,
          data: {
            subject: "OCCTA | " + title,
            title,
            greeting: "Dear " + (profile.full_name || "Customer"),
            body: message + " No invoice or receipt has been sent by email.",
            cta_text: "View your account",
            cta_url: "https://www.occta.co.uk/dashboard?tab=invoices",
          },
        },
      });
      if (sendError || !data?.success) throw new Error("notification_provider_rejected");
      await db.from("billing_notifications_outbox")
        .update({ status: "sent", processed_at: new Date().toISOString(),
          last_error: null, provider_message_id: data?.data?.data?.id ?? null })
        .eq("id", item.id);
      sent++;
    } catch (e) {
      const failed = item.attempts + 1 >= 5;
      const minutes = Math.min(360, 2 ** (item.attempts + 1));
      await db.from("billing_notifications_outbox").update({
        status: failed ? "dead" : "retry",
        next_attempt_at: new Date(Date.now() + minutes * 60000).toISOString(),
        last_error: String((e as Error).message ?? e).slice(0, 500),
      }).eq("id", item.id);
      if (failed) dead++; else retry++;
    }
  }
  return reply({ sent, retry, dead });
});
