import {
  corsHeaders,
  jsonResponse,
  getServiceClient,
  checkRateLimit,
  getRequestIp,
} from "../_shared/quoteHelpers.ts";
import { createSupportTicket } from "../_shared/supportTickets.ts";

// Authenticated support ticket ingress. Rate-limited. Creates support_tickets +
// communication_thread + initial inbound communication_message, then sends a
// customer acknowledgement and an internal support notification.
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

  // Reject obvious payment/bank details from support free text.
  if (/\b\d{13,19}\b/.test(message) || /cvv|sort code|account number\s*[:=]/i.test(message)) {
    return jsonResponse({ error: "sensitive_data_not_allowed" }, 400);
  }

  const priority = ["low", "normal", "medium", "high", "urgent"].includes(priorityIn) ? priorityIn : "normal";

  const ip = getRequestIp(req) ?? "anon";
  const rlKey = email || ip;
  const allowed = await checkRateLimit(rlKey, "submit_support_ticket", 8, 60);
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  const svc = getServiceClient();

  // Auth is required. Always send the acknowledgement to the registered auth
  // email rather than trusting an arbitrary recipient supplied in the form.
  let userId: string | null = null;
  let registeredEmail: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await svc.auth.getUser(auth.replace("Bearer ", ""));
    userId = data?.user?.id ?? null;
    registeredEmail = data?.user?.email?.trim().toLowerCase() ?? null;
  }
  if (!userId) return jsonResponse({ error: "auth_required" }, 401);

  const result = await createSupportTicket(svc, {
    userId,
    registeredEmail,
    name,
    phone,
    ip,
    subject,
    message,
    category,
    priority,
    relatedOrderId,
    relatedInvoiceId,
    relatedQuoteId,
  });
  if (!result.ok) return jsonResponse({ error: result.error }, 500);

  return jsonResponse({ ok: true, ticket_id: result.ticketId, customer_email_sent: result.customerEmailSent });
});
