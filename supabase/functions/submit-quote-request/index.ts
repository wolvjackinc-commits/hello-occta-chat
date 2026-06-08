import {
  corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp,
  maskEmail, sendResendEmail, brutalistEmailShell, escapeHtml,
} from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().min(7).max(30),
  postcode: z.string().trim().min(5).max(10),
  address_line_1: z.string().trim().max(160).optional().nullable(),
  address_line_2: z.string().trim().max(160).optional().nullable(),
  town: z.string().trim().max(80).optional().nullable(),
  county: z.string().trim().max(80).optional().nullable(),
  service_interest: z.enum(["broadband","sim","digital_voice","business","switching","bundle","other"]),
  plan_preference: z.enum(["flex","contract_saver","not_sure"]).default("not_sure"),
  customer_type: z.enum(["residential","business"]).default("residential"),
  business_name: z.string().trim().max(160).optional().nullable(),
  current_provider: z.string().trim().max(120).optional().nullable(),
  current_monthly_bill: z.number().nonnegative().max(100000).optional().nullable(),
  preferred_contact_method: z.enum(["email","phone","whatsapp"]).default("email"),
  message: z.string().trim().max(2000).optional().nullable(),
  marketing_consent: z.boolean().default(false),
  source: z.string().trim().max(40).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const input = parsed.data;

  const ip = getRequestIp(req);
  const rlKey = `${ip ?? "noip"}:${input.email}`;
  if (!(await checkRateLimit(rlKey, "submit_quote", 5, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();

  // Link to logged-in user if present
  let customer_id: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (data?.user) customer_id = data.user.id;
  }

  const { data: row, error } = await supabase
    .from("quote_requests")
    .insert({
      customer_id,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      postcode: input.postcode.toUpperCase(),
      address_line_1: input.address_line_1 ?? null,
      address_line_2: input.address_line_2 ?? null,
      town: input.town ?? null,
      county: input.county ?? null,
      service_interest: input.service_interest,
      plan_preference: input.plan_preference,
      customer_type: input.customer_type,
      business_name: input.business_name ?? null,
      current_provider: input.current_provider ?? null,
      current_monthly_bill: input.current_monthly_bill ?? null,
      preferred_contact_method: input.preferred_contact_method,
      message: input.message ?? null,
      marketing_consent: input.marketing_consent,
      source: input.source ?? "web",
      ip,
      user_agent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    })
    .select("id, reference")
    .single();

  if (error || !row) return jsonResponse({ error: "create_failed" }, 500);

  // PII-safe activity log
  await supabase.rpc("log_event", {
    _actor_type: "public",
    _event_type: "quote_request_submitted",
    _title: `Quote request ${row.reference}`,
    _details: { reference: row.reference, service: input.service_interest, customer_type: input.customer_type, email_masked: maskEmail(input.email) },
    _source_module: "quote",
  });
  await supabase.from("quote_events").insert({
    quote_request_id: row.id,
    event_type: "quote_request_submitted",
    title: `Submitted: ${row.reference}`,
    details: { service: input.service_interest, customer_type: input.customer_type },
    actor_type: "public",
  });

  // Fire-and-forget emails
  const customerHtml = brutalistEmailShell(
    "We've got your quote request",
    `<p>Hi ${escapeHtml(input.full_name.split(" ")[0])},</p>
     <p>Thanks for getting in touch. Your reference is <strong>${escapeHtml(row.reference)}</strong>.</p>
     <p>OCCTA will check the best available option for your address and confirm speed, price, installation and switching details before you pay.</p>
     <p style="font-size:12px;color:#555;">Your final price, speed estimate, contract length, one-off charges, installation details, cancellation/cease charges and key terms will be confirmed in your Contract Summary before you pay.</p>`,
  );
  void sendResendEmail({ to: input.email, subject: `OCCTA quote request ${row.reference}`, html: customerHtml });

  const adminEmail = Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
  void sendResendEmail({
    to: adminEmail,
    subject: `[Quote Request] ${row.reference} — ${input.service_interest}`,
    html: brutalistEmailShell(
      `New quote request: ${row.reference}`,
      `<p><strong>Service:</strong> ${escapeHtml(input.service_interest)} · ${escapeHtml(input.customer_type)}</p>
       <p><strong>Postcode:</strong> ${escapeHtml(input.postcode.toUpperCase())}</p>
       <p><strong>Preferred contact:</strong> ${escapeHtml(input.preferred_contact_method)}</p>
       <p>Open the admin Quote Requests queue to action.</p>`,
      { label: "Open admin", url: "https://www.occta.co.uk/admin/quote-requests" },
    ),
  });

  return jsonResponse({ ok: true, reference: row.reference });
});