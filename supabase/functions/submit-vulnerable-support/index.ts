import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

// Vulnerable-support request. Auth required. Does NOT accept or store medical details.
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
  if (auth?.startsWith("Bearer ")) {
    const { data } = await svc.auth.getUser(auth.replace("Bearer ", ""));
    userId = data?.user?.id ?? null;
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

  return jsonResponse({ ok: true, ticket_id: ticket.id });
});