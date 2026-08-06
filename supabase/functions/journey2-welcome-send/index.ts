/**
 * Journey 2 — welcome-pack outbox sender.
 *
 * The browser never sends the welcome email. This function is the only sender:
 * it is service-role driven for the automatic send after a successful live order
 * commit, and admin-authorised for a manual resend. Sends are idempotent —
 * a row already marked `sent` is only re-sent through an explicit, audited
 * admin resend, and a `sending` row is never picked up twice.
 *
 * Test journeys never reach this function: their evidence lives in
 * journey2_test_email_outbox with status `suppressed_test`.
 */
import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { REQUIRED_DOC_TYPES } from "../_shared/journey2Docs.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  order_id: z.string().uuid().optional(),
  resend: z.boolean().optional(),
  process_pending: z.boolean().optional(),
});

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return !!key && auth === `Bearer ${key}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonResponse({ error: "validation" }, 400);
  const body = parsed.data;

  const service = isServiceRole(req);
  let adminId: string | null = null;
  if (!service) {
    const staff = await requireStaff(req, ["admin", "super_admin", "support_agent"]);
    if (!("userId" in staff)) return jsonResponse({ error: staff.error }, staff.status);
    adminId = staff.userId;
  }
  // Only an authenticated administrator may resend an already-sent pack.
  if (body.resend && !adminId) return jsonResponse({ error: "resend_requires_admin" }, 403);

  const supabase = getServiceClient();
  const statuses = body.resend ? ["sent", "failed", "pending"] : ["pending", "failed"];

  const base = supabase
    .from("journey2_email_outbox")
    .select("id, order_id, session_id, email_type, recipient_email, subject, attachments, status, retry_count")
    .eq("email_type", "journey2_welcome_pack")
    .in("status", statuses)
    .order("created_at", { ascending: true })
    .limit(body.order_id ? 1 : 25);
  const { data: rows } = body.order_id ? await base.eq("order_id", body.order_id) : await base;

  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const results: { order_id: string; ok: boolean; detail?: string }[] = [];

  for (const row of rows ?? []) {
    // Document pack readiness is a hard gate on sending.
    const { count: docCount } = await supabase
      .from("journey2_documents")
      .select("id", { count: "exact", head: true })
      .eq("session_id", row.session_id);
    if ((docCount ?? 0) < REQUIRED_DOC_TYPES.length) {
      await supabase.from("journey2_email_outbox").update({
        status: "pending",
        last_attempt_at: new Date().toISOString(),
        last_error: "document_pack_not_ready",
      }).eq("id", row.id);
      results.push({ order_id: row.order_id, ok: false, detail: "document_pack_not_ready" });
      continue;
    }

    // Claim the row so a concurrent run can never send twice.
    const claim = await supabase.from("journey2_email_outbox")
      .update({ status: "sending", last_attempt_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("status", statuses)
      .select("id")
      .maybeSingle();
    if (!claim.data) {
      results.push({ order_id: row.order_id, ok: false, detail: "already_claimed" });
      continue;
    }

    const { data: order } = await supabase
      .from("orders")
      .select("occta_order_number, plan_name, plan_price, preferred_start_date, billing_anchor_day")
      .eq("id", row.order_id)
      .maybeSingle();
    const { data: summaryDoc } = await supabase
      .from("journey2_documents")
      .select("content")
      .eq("session_id", row.session_id)
      .eq("doc_type", "order_summary")
      .maybeSingle();

    const res = await fetch(`${projectUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "order_confirmation",
        to: row.recipient_email,
        orderNumber: order?.occta_order_number ?? null,
        logToCommunications: true,
        data: {
          orderNumber: order?.occta_order_number ?? null,
          planName: order?.plan_name ?? null,
          monthlyPrice: order?.plan_price ?? null,
          preferredStartDate: order?.preferred_start_date ?? null,
          billingDay: order?.billing_anchor_day ?? null,
          amountDueToday: 0,
          documents: row.attachments ?? [],
          summary: summaryDoc?.content ?? null,
          resent: !!body.resend,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    const ok = res.ok && !(json as any).error;

    await supabase.from("journey2_email_outbox").update({
      status: ok ? "sent" : "failed",
      retry_count: ok ? row.retry_count : row.retry_count + 1,
      sent_at: ok ? new Date().toISOString() : null,
      last_attempt_at: new Date().toISOString(),
      last_error: ok ? null : String((json as any)?.error ?? `http_${res.status}`).slice(0, 400),
    }).eq("id", row.id);

    if (adminId) {
      await supabase.from("audit_logs").insert({
        user_id: adminId,
        action: body.resend ? "journey2_welcome_pack_resent" : "journey2_welcome_pack_sent",
        table_name: "journey2_email_outbox",
        record_id: row.id,
        new_values: { order_id: row.order_id, ok, resend: !!body.resend },
      }).then(() => {}).catch(() => {});
    }

    results.push({ order_id: row.order_id, ok, detail: ok ? undefined : "send_failed" });
  }

  return jsonResponse({ ok: true, processed: results.length, results });
});
