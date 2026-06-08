import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

// Public/auth support ticket ingress. Rate-limited. Creates support_tickets +
// communication_thread + initial inbound communication_message. Logs ticket id only.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone ?? "").trim().slice(0, 30) || null;
  const category = String(body.category ?? "other").slice(0, 64);
  const priorityIn = String(body.priority ?? "normal").toLowerCase();
  const subject = String(body.subject ?? "").trim().slice(0, 100);
  const message = String(body.message ?? "").trim().slice(0, 2000);
  const relatedOrderId = body.related_order_id ? String(body.related_order_id).slice(0, 64) : null;
  const relatedInvoiceId = body.related_invoice_id ? String(body.related_invoice_id).slice(0, 64) : null;
  const relatedQuoteId = body.related_quote_id ? String(body.related_quote_id).slice(0, 64) : null;

  if (subject.length < 5) return jsonResponse({ error: "subject_too_short" }, 400);
  if (message.length < 20) return jsonResponse({ error: "message_too_short" }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "invalid_email" }, 400);
  }

  // Reject obvious card-like payloads
  if (/\b\d{13,19}\b/.test(message) || /cvv|sort code|account number\s*[:=]/i.test(message)) {
    return jsonResponse({ error: "sensitive_data_not_allowed" }, 400);
  }

  const priority = ["low", "normal", "medium", "high", "urgent"].includes(priorityIn) ? priorityIn : "normal";

  const ip = getRequestIp(req) ?? "anon";
  const rlKey = email || ip;
  const allowed = await checkRateLimit(rlKey, "submit_support_ticket", 8, 60);
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  const svc = getServiceClient();

  // Resolve user (required — we don't accept anonymous tickets here; public users use the dedicated form/auth)
  let userId: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await svc.auth.getUser(auth.replace("Bearer ", ""));
    userId = data?.user?.id ?? null;
  }
  if (!userId) return jsonResponse({ error: "auth_required" }, 401);

  const insert: Record<string, unknown> = {
    user_id: userId,
    subject,
    description: message,
    category,
    priority,
    status: "open",
  };
  if (relatedOrderId) insert.related_order_id = relatedOrderId;
  if (relatedInvoiceId) insert.related_invoice_id = relatedInvoiceId;
  if (relatedQuoteId) insert.related_quote_id = relatedQuoteId;

  const { data: ticket, error } = await svc.from("support_tickets").insert(insert).select("id").single();
  if (error || !ticket) return jsonResponse({ error: "create_failed" }, 500);

  const { data: thread } = await svc.from("communication_threads").insert({
    customer_id: userId,
    subject: `Ticket: ${subject}`,
    channel: "web_form",
    status: "open",
    related_ticket_id: ticket.id,
    related_order_id: relatedOrderId,
    related_invoice_id: relatedInvoiceId,
    related_quote_id: relatedQuoteId,
  }).select("id").single();

  if (thread?.id) {
    await svc.from("communication_messages").insert({
      thread_id: thread.id,
      direction: "inbound",
      channel: "web_form",
      sender_type: "customer",
      sender_id: userId,
      subject,
      body: message,
      metadata_json: { name, phone, ip },
    });
  }

  await svc.rpc("log_event", {
    _actor_type: "customer",
    _event_type: "support_ticket_created",
    _title: "Support ticket created",
    _source_module: "support",
    _details: { ticket_id: ticket.id, category, priority },
    _ticket_id: ticket.id,
  });

  return jsonResponse({ ok: true, ticket_id: ticket.id });
});