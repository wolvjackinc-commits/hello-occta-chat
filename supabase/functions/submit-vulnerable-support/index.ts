import {
  corsHeaders,
  jsonResponse,
  getServiceClient,
  checkRateLimit,
  getRequestIp,
  sendTrackedCommunication,
  brutalistEmailShell,
  escapeHtml,
  getAdminNotificationEmail,
} from "../_shared/quoteHelpers.ts";

// Vulnerable-support request. Auth required. Does NOT accept medical details.
// Emails deliberately exclude the customer's free-text support need.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const need = String(body.need ?? body.message ?? "").trim().slice(0, 1000);
  const preferredContact = String(body.preferred_contact ?? "").trim().slice(0, 64) || null;

  if (need.length < 5) return jsonResponse({ error: "need_too_short" }, 400);

  // Soft block on obvious medical content — we don't want diagnosis text in the DB.
  const medical = /(diagnos|symptom|medication|prescription|condition|disease|illness|cancer|diabetes|seizure|nhs number)/i;
  if (medical.test(need)) {
    return jsonResponse({
      error: "no_medical_details",
      message: "Please tell us only what support you need from OCCTA. You don't need to share medical details.",
    }, 400);
  }

  const ip = getRequestIp(req) ?? "anon";

  const svc = getServiceClient();
  const auth = req.headers.get("Authorization");
  let userId: string | null = null;
  let registeredEmail: string | null = null;
  let registeredName: string | null = null;
  if (auth?.startsWith("Bearer ")) {
    const { data } = await svc.auth.getUser(auth.replace("Bearer ", ""));
    userId = data?.user?.id ?? null;
    registeredEmail = data?.user?.email?.trim().toLowerCase() ?? null;
    registeredName = typeof data?.user?.user_metadata?.full_name === "string"
      ? data.user.user_metadata.full_name.slice(0, 120)
      : null;
  }
  if (!userId) return jsonResponse({ error: "auth_required" }, 401);

  const allowed = await checkRateLimit(userId, "submit_vulnerable_support", 5, 60);
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  const subject = "Vulnerable support request";
  const description =
    `${need}\n\n[Preferred contact: ${preferredContact || "not specified"}]\n` +
    `Digital Voice notice acknowledged: Digital Voice works through broadband and power and may not work during a power cut unless backup power is available.`;

  const { data: ticket, error } = await svc.from("support_tickets").insert({
    user_id: userId,
    subject,
    description,
    category: "vulnerable_support",
    priority: "high",
    status: "open",
    vulnerable_customer_flag: true,
  }).select("id").single();

  if (error || !ticket) return jsonResponse({ error: "create_failed" }, 500);

  const { data: thread } = await svc.from("communication_threads").insert({
    customer_id: userId,
    subject,
    channel: "web_form",
    status: "open",
    related_ticket_id: ticket.id,
  }).select("id").single();

  if (thread?.id) {
    await svc.from("communication_messages").insert({
      thread_id: thread.id,
      direction: "inbound",
      channel: "web_form",
      sender_type: "customer",
      sender_id: userId,
      subject,
      body: need,
      metadata_json: { preferred_contact: preferredContact, ip, vulnerable: true },
    });
  }

  await svc.rpc("log_event", {
    _actor_type: "customer",
    _event_type: "vulnerable_support_requested",
    _title: "Vulnerable support requested",
    _source_module: "support",
    _details: { ticket_id: ticket.id },
    _ticket_id: ticket.id,
    _severity: "warning",
  });

  let customerEmailSent = false;
  if (registeredEmail) {
    try {
      const customerSubject = "We've received your OCCTA support request";
      const customerHtml = brutalistEmailShell(
        "Support request received",
        `<p>Hi ${escapeHtml(registeredName || "there")},</p><p>We've received your request for additional support and marked it for priority review.</p><p><strong>Preferred contact:</strong> ${escapeHtml(preferredContact || "not specified")}</p><p>For your privacy, this email does not repeat the details you entered. Our team can review them securely in your support ticket.</p>`,
        { label: "Open support dashboard", url: "https://www.occta.co.uk/dashboard" },
      );
      const result = await sendTrackedCommunication(svc, {
        template_name: "vulnerable_support_customer_acknowledgement",
        recipient_email: registeredEmail,
        subject: customerSubject,
        html: customerHtml,
        user_id: userId,
        replyTo: "support@occta.co.uk",
        metadata: { ticket_id: ticket.id, preferred_contact: preferredContact },
      });
      customerEmailSent = result.ok;
      if (!result.ok) console.error("vulnerable support acknowledgement failed", result.error);
    } catch (e) {
      console.error("vulnerable support acknowledgement exception", (e as Error)?.message ?? String(e));
    }
  }

  // Internal email carries routing information only. The free-text need remains
  // in the authenticated support system and is not copied into email.
  try {
    const adminEmail = (Deno.env.get("VULNERABLE_SUPPORT_NOTIFY_EMAIL") || Deno.env.get("SUPPORT_NOTIFY_EMAIL") || getAdminNotificationEmail()).trim();
    const internalSubject = "Priority support request received";
    const internalHtml = brutalistEmailShell(
      "Priority support request",
      `<p>A vulnerable-support request has been received and requires priority review.</p><p><strong>Ticket ID:</strong> ${escapeHtml(ticket.id)}<br/><strong>Preferred contact:</strong> ${escapeHtml(preferredContact || "not specified")}</p><p>The customer's free-text request is intentionally omitted from email. Open the protected admin support queue to review it.</p>`,
      { label: "Open admin support", url: "https://www.occta.co.uk/admin/support" },
    );
    const result = await sendTrackedCommunication(svc, {
      template_name: "vulnerable_support_admin_notification",
      recipient_email: adminEmail,
      subject: internalSubject,
      html: internalHtml,
      metadata: { ticket_id: ticket.id, preferred_contact: preferredContact },
    });
    if (!result.ok) console.error("vulnerable support admin notification failed", result.error);
  } catch (e) {
    console.error("vulnerable support admin notification exception", (e as Error)?.message ?? String(e));
  }

  return jsonResponse({ ok: true, ticket_id: ticket.id, customer_email_sent: customerEmailSent });
});
