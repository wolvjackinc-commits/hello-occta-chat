// Staff-only: record a customer who called in, so an agent can build a quote
// for them and send the normal secure quote link. From the moment the quote is
// created everything (Contract Summary, OTP acceptance, Direct Debit, start
// date, order, billing) runs through the exact same pipeline as a web request.
//
// Deliberately does NOT use save_quote_submission: that RPC records a web
// checkout conversion, and a phone call is not one.
import { corsHeaders, jsonResponse, getServiceClient, requireStaff, maskEmail } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().min(7).max(30),
  postcode: z.string().trim().min(5).max(10),
  address_line_1: z.string().trim().min(2).max(160),
  address_line_2: z.string().trim().max(160).optional().nullable(),
  town: z.string().trim().max(80).optional().nullable(),
  county: z.string().trim().max(80).optional().nullable(),
  service_interest: z.enum(["broadband","sim","digital_voice","business","switching","bundle","other"]),
  plan_preference: z.enum(["flex","contract_saver","not_sure"]).default("not_sure"),
  customer_type: z.enum(["residential","business"]).default("residential"),
  business_name: z.string().trim().max(160).optional().nullable(),
  current_provider: z.string().trim().max(120).optional().nullable(),
  call_reference: z.string().trim().max(80).optional().nullable(),
  call_notes: z.string().trim().max(2000).optional().nullable(),
  // Only true when the caller said yes on the call. Never defaulted on.
  marketing_consent: z.boolean().default(false),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;
  if (i.customer_type === "business" && !i.business_name) {
    return jsonResponse({ error: "validation", details: { fieldErrors: { business_name: ["Required for business customers"] } } }, 400);
  }

  const supabase = getServiceClient();
  const postcode = i.postcode.toUpperCase().replace(/\s+/g, " ");

  // Double-click / retry guard: same caller, same address, logged by phone in
  // the last 15 minutes → hand back that request instead of a duplicate.
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("quote_requests")
    .select("id, reference")
    .eq("source", "phone")
    .eq("email", i.email)
    .eq("postcode", postcode)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return jsonResponse({ ok: true, replayed: true, quote_request_id: recent.id, reference: recent.reference });

  // Link to an existing customer account when the email already belongs to one.
  const { data: existing } = await supabase
    .from("profiles").select("id, account_number").ilike("email", i.email).limit(1).maybeSingle();

  const { data: agent } = await supabase
    .from("profiles").select("full_name, email").eq("id", auth.userId).maybeSingle();
  const agentName = agent?.full_name || agent?.email || "staff";

  const callLine = `Phone order taken by ${agentName}${i.call_reference ? ` · call ref ${i.call_reference}` : ""}.`;
  const message = i.call_notes ? `${callLine}\n${i.call_notes}` : callLine;

  const { data: row, error } = await supabase.from("quote_requests").insert({
    customer_id: existing?.id ?? null,
    full_name: i.full_name,
    email: i.email,
    phone: i.phone,
    postcode,
    address_line_1: i.address_line_1,
    address_line_2: i.address_line_2 ?? null,
    town: i.town ?? null,
    county: i.county ?? null,
    service_interest: i.service_interest,
    plan_preference: i.plan_preference,
    customer_type: i.customer_type,
    business_name: i.customer_type === "business" ? i.business_name ?? null : null,
    current_provider: i.current_provider ?? null,
    preferred_contact_method: "phone",
    message,
    marketing_consent: i.marketing_consent,
    source: "phone",
    status: "assigned",
    assigned_admin_id: auth.userId,
    user_agent: "occta-admin-phone-order",
  }).select("id, reference").single();

  if (error || !row) return jsonResponse({ error: "create_failed", details: error?.message }, 500);

  const details = {
    reference: row.reference,
    source: "phone",
    agent_id: auth.userId,
    agent_name: agentName,
    call_reference: i.call_reference ?? null,
    service: i.service_interest,
    customer_type: i.customer_type,
    existing_account: existing?.account_number ?? null,
    marketing_consent: i.marketing_consent,
    email_masked: maskEmail(i.email),
  };

  await supabase.from("quote_events").insert({
    quote_request_id: row.id,
    event_type: "phone_order_started",
    title: `Phone order started by ${agentName}: ${row.reference}`,
    details,
    actor_type: "admin",
    actor_id: auth.userId,
  });
  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "phone_order_started",
    _title: `Phone order ${row.reference}`,
    _details: details,
    _source_module: "quote",
  });

  return jsonResponse({
    ok: true,
    replayed: false,
    quote_request_id: row.id,
    reference: row.reference,
    existing_account: existing?.account_number ?? null,
  });
});
