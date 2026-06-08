import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const category = String(body.category ?? "other").slice(0, 64);
  const summary = String(body.summary ?? "").trim().slice(0, 4000);
  const desired = String(body.desired_outcome ?? "").trim().slice(0, 2000) || null;
  const email = String(body.contact_email ?? "").trim().toLowerCase().slice(0, 200) || null;
  const phone = String(body.contact_phone ?? "").trim().slice(0, 30) || null;
  if (summary.length < 5) return jsonResponse({ error: "summary_too_short" }, 400);

  const ip = getRequestIp(req) ?? "anon";
  const rlKey = email || ip;
  const allowed = await checkRateLimit(rlKey, "submit_complaint", 5, 60);
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  const svc = getServiceClient();

  // Resolve authed user (optional — anonymous complaints allowed)
  let userId: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await svc.auth.getUser(auth.replace("Bearer ", ""));
    userId = data?.user?.id ?? null;
  }

  // Generate reference
  const ref = `CMP-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${crypto.randomUUID().replace(/-/g,"").slice(0,6).toUpperCase()}`;

  const { data: complaint, error } = await svc.from("complaints").insert({
    customer_id: userId,
    complaint_reference: ref,
    category,
    summary,
    customer_desired_outcome: desired,
    contact_email: email,
    contact_phone: phone,
    status: "open",
    priority: "normal",
  }).select("id, complaint_reference, six_week_adr_eligible_at").single();

  if (error || !complaint) return jsonResponse({ error: "create_failed" }, 500);

  await svc.from("complaint_events").insert({
    complaint_id: complaint.id,
    event_type: "created",
    title: "Complaint received",
    details: { category, channel: userId ? "dashboard" : "public_form" },
    actor_type: userId ? "customer" : "system",
    actor_id: userId,
    visibility: "customer",
  });

  // Draft acknowledgement letter (admin can review/send later)
  await svc.from("complaint_letters").insert({
    complaint_id: complaint.id,
    letter_type: "acknowledgement",
    subject: `We've received your complaint (${complaint.complaint_reference})`,
    body: `Thank you for contacting OCCTA. We've logged your complaint with reference ${complaint.complaint_reference}. ` +
          `A member of our team will review and respond within 2 working days. ` +
          `If we're unable to resolve your complaint within 6 weeks, or we issue a deadlock letter sooner, ` +
          `you may refer it to our Alternative Dispute Resolution (ADR) scheme.`,
    status: "draft",
  });

  // Create thread for ongoing comms
  await svc.from("communication_threads").insert({
    customer_id: userId,
    subject: `Complaint ${complaint.complaint_reference}`,
    channel: "web_form",
    related_complaint_id: complaint.id,
  });

  await svc.rpc("log_event", {
    _actor_type: userId ? "customer" : "anon",
    _event_type: "complaint_created",
    _title: "Complaint created",
    _source_module: "complaints",
    _details: { complaint_id: complaint.id, reference: complaint.complaint_reference, category },
  });

  return jsonResponse({
    ok: true,
    complaint_id: complaint.id,
    reference: complaint.complaint_reference,
    six_week_adr_eligible_at: complaint.six_week_adr_eligible_at,
  });
});