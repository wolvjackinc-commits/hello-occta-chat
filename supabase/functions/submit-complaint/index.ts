import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { sendResendEmail, brutalistEmailShell, escapeHtml, recordEmailCommunication } from "../_shared/quoteHelpers.ts";
import { fetchHelpfulLinksHtml } from "../_shared/helpfulLinks.ts";

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

  // Send customer acknowledgement email (fail-soft).
  if (email) {
    try {
      let helpfulHtml = "";
      try {
        helpfulHtml = await fetchHelpfulLinksHtml(svc, "complaint_ack", { max: 3 });
      } catch (_e) {
        helpfulHtml = "";
      }
      const ref = escapeHtml(complaint.complaint_reference);
      const body = `
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;">Thanks for getting in touch — we've received your complaint and it's now logged with our team.</p>
        <div style="margin:16px 0;padding:14px 16px;border:2px solid #000;background:#fafafa;">
          <div style="font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#666;margin:0 0 6px 0;">Reference</div>
          <div style="font:900 18px/1.2 Arial,Helvetica,sans-serif;color:#111;letter-spacing:0.04em;">${ref}</div>
        </div>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;">A member of the team will review and get back to you within <strong>2 working days</strong>. Please keep this reference handy for any follow-up.</p>
        <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#444;">If we can't resolve things within 6 weeks — or if we issue a deadlock letter sooner — you'll be able to refer your complaint to our Alternative Dispute Resolution (ADR) scheme, free of charge.</p>
        ${helpfulHtml}
      `;
      const html = brutalistEmailShell(
        `We've received your complaint`,
        body,
        { label: "View your dashboard", url: "https://www.occta.co.uk/dashboard" },
      );
      const sendResult = await sendResendEmail({
        to: email,
        subject: `We've received your complaint (${complaint.complaint_reference})`,
        html,
        replyTo: "hello@occta.co.uk",
      });
      await recordEmailCommunication(svc, {
        template_name: "complaint_ack",
        recipient_email: email,
        sendResult,
        user_id: userId,
        metadata: { complaint_id: complaint.id, reference: complaint.complaint_reference },
      });
    } catch (e) {
      console.error("[submit-complaint] ack email failed", (e as Error)?.message);
    }
  }

  return jsonResponse({
    ok: true,
    complaint_id: complaint.id,
    reference: complaint.complaint_reference,
    six_week_adr_eligible_at: complaint.six_week_adr_eligible_at,
  });
});