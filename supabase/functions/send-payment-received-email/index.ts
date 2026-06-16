import {
  corsHeaders, jsonResponse, getServiceClient, generateTokenPair,
  sendResendEmail, brutalistEmailShell, escapeHtml,
} from "../_shared/quoteHelpers.ts";

// Sends/resends the "Payment received" email for a paid + webhook-verified PR.
// Idempotent: refuses duplicate sends unless force=true (admin resend).
//
// Callers:
//   - worldpay-webhook (internal): x-internal-service header + service-role JWT
//   - admin (resend):              admin JWT + { force: true }
//
// SAFETY:
//   - Never mutates PR status, paid_at, webhook_verified, provider_payment_id.
//   - Raw receipt token is generated inside this function, hashed into
//     payment_requests.metadata.receipt_token_hash, and ONLY embedded in the
//     outgoing email URL. Never returned in the API response. Never logged.

const STAFF_ROLES = ["admin", "super_admin", "finance_admin", "support_agent"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = getServiceClient();

  let payload: any = {};
  try { payload = await req.json(); } catch { /* ignore */ }
  const prId: string | null = payload?.payment_request_id ?? null;
  const force: boolean = !!payload?.force;
  if (!prId) return jsonResponse({ error: "payment_request_id_required" }, 400);

  // Auth: internal service-role OR admin JWT
  const authHeader = req.headers.get("Authorization") || "";
  const internalHeader = req.headers.get("x-internal-service") === "1";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isInternal = internalHeader && authHeader === `Bearer ${serviceKey}`;

  let actorId: string | null = null;
  if (!isInternal) {
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);
    const { data: userResp, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userResp?.user) return jsonResponse({ error: "invalid_jwt" }, 401);
    actorId = userResp.user.id;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", actorId);
    const isStaff = (roles ?? []).some((r: any) => STAFF_ROLES.includes(r.role));
    if (!isStaff) return jsonResponse({ error: "forbidden" }, 403);
  }

  // Load PR
  const { data: pr, error: prErr } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("id", prId)
    .maybeSingle();
  if (prErr || !pr) return jsonResponse({ error: "not_found" }, 404);

  if (!(pr.status === "paid" || pr.status === "completed") || !pr.webhook_verified || !pr.paid_at) {
    return jsonResponse({ error: "not_paid_verified" }, 409);
  }

  // Idempotency: check communications_log for an existing successful send
  const { data: existing } = await supabase
    .from("communications_log")
    .select("id, sent_at, status")
    .eq("payment_request_id", pr.id)
    .eq("template_name", "payment_received")
    .eq("status", "sent")
    .limit(1);
  if ((existing ?? []).length > 0 && !force) {
    return jsonResponse({ ok: true, already_sent: true });
  }

  // Mint or reuse receipt token. Store hash only.
  const meta = (pr.metadata && typeof pr.metadata === "object") ? pr.metadata : {};
  let receiptTokenHash: string | null = meta.receipt_token_hash ?? null;
  const { raw, hash } = await generateTokenPair();
  // Always rotate on a fresh send so old links can be invalidated if needed.
  receiptTokenHash = hash;
  await supabase
    .from("payment_requests")
    .update({ metadata: { ...meta, receipt_token_hash: receiptTokenHash } })
    .eq("id", pr.id);

  // Build email
  const appBase = Deno.env.get("APP_BASE_URL") || "https://www.occta.co.uk";
  const receiptUrl = `${appBase}/receipt/${raw}`;
  const firstName = (pr.customer_name || "there").split(" ")[0];
  const amountStr = `£${Number(pr.amount ?? 0).toFixed(2)}`;
  const paidStr = pr.paid_at ? new Date(pr.paid_at).toUTCString() : "";

  const html = brutalistEmailShell(
    "Payment received",
    `<p>Hi ${escapeHtml(firstName)},</p>
     <p>Thanks — we've received your payment. Here's your receipt for your records.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Amount</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(amountStr)}</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Reference</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(pr.payment_request_number ?? "")}</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Paid</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(paidStr)}</td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Method</td><td style="padding:6px 0;font-size:13px;">Card (Worldpay)</td></tr>
     </table>
     <p><strong>What's next:</strong> OCCTA is preparing your setup. We'll be in touch shortly with the next step. No further action is needed from you right now.</p>
     <p style="font-size:12px;color:#555;">Questions about your payment? Reply to this email or contact <a href="mailto:hello@occta.co.uk" style="color:#555;">hello@occta.co.uk</a>.</p>`,
    { label: "View / print receipt", url: receiptUrl },
  );

  const send = await sendResendEmail({
    to: pr.customer_email,
    subject: `Payment received — OCCTA`,
    html,
  });

  await supabase.from("communications_log").insert({
    user_id: pr.user_id,
    payment_request_id: pr.id,
    template_name: "payment_received",
    recipient_email: pr.customer_email,
    status: send.ok ? "sent" : "failed",
    sent_at: send.ok ? new Date().toISOString() : null,
    error_message: send.ok ? null : (send.error ?? "send_failed"),
    metadata: {
      payment_request_number: pr.payment_request_number,
      amount: Number(pr.amount ?? 0),
      currency: pr.currency,
      contract_summary_id: pr.contract_summary_id,
      sent_by_admin: actorId,
      forced: force,
    },
  });

  // log_event for timeline. Severity info regardless of email failure.
  await supabase.rpc("log_event", {
    _actor_type: actorId ? "admin" : "system",
    _event_type: send.ok ? "payment_received_email_sent" : "payment_received_email_failed",
    _title: send.ok ? `Payment receipt emailed — ${pr.payment_request_number}` : `Payment receipt email FAILED — ${pr.payment_request_number}`,
    _details: {
      payment_request_id: pr.id,
      payment_request_number: pr.payment_request_number,
      error: send.ok ? null : send.error,
    },
    _customer_id: pr.user_id,
    _source_module: "payments",
    _severity: send.ok ? "info" : "warning",
  });

  if (send.ok) {
    await supabase.from("payment_request_events").insert({
      request_id: pr.id,
      event_type: "receipt_available",
      metadata: { template: "payment_received", forced: force },
    });
  }

  if (!send.ok) return jsonResponse({ error: "email_failed", details: send.error }, 502);
  return jsonResponse({ ok: true });
});