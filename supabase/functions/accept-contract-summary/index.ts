import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, getRequestIp, checkRateLimit, sendResendEmail, brutalistEmailShell, escapeHtml, maskEmail } from "../_shared/quoteHelpers.ts";
import { ACCEPTANCE_CHECKBOX_TEXT } from "../_shared/legalText.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  token: z.string().min(16),
  accepted_by_name: z.string().trim().min(2).max(160),
  accepted_by_email: z.string().trim().toLowerCase().email().max(180),
  checkbox_confirmed: z.literal(true),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const i = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "accept_cs", 10, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const supabase = getServiceClient();
  const hash = await sha256Hex(i.token);

  const { data: cs } = await supabase.from("contract_summaries").select("*").eq("public_token_hash", hash).maybeSingle();
  if (!cs) return jsonResponse({ error: "not_found" }, 404);
  if (cs.status === "accepted") return jsonResponse({ ok: true, already_accepted: true, quote_id: cs.quote_id });
  if (!["issued", "viewed", "draft"].includes(cs.status)) return jsonResponse({ error: "not_acceptable", status: cs.status }, 409);
  if (cs.token_expires_at && new Date(cs.token_expires_at) < new Date()) return jsonResponse({ error: "expired" }, 410);

  if (i.accepted_by_email.toLowerCase() !== cs.customer_email_snapshot.toLowerCase()) {
    return jsonResponse({ error: "email_mismatch" }, 400);
  }

  const acceptedAt = new Date().toISOString();
  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  // Insert acceptance (append-only)
  const { error: aErr } = await supabase.from("contract_acceptances").insert({
    contract_summary_id: cs.id,
    quote_id: cs.quote_id,
    customer_id: cs.customer_id,
    accepted_by_name: i.accepted_by_name,
    accepted_by_email: i.accepted_by_email,
    accepted_at: acceptedAt,
    ip, user_agent: ua,
    acceptance_text: ACCEPTANCE_CHECKBOX_TEXT,
    checkbox_confirmed: true,
  });
  if (aErr) return jsonResponse({ error: "accept_failed", details: aErr.message }, 500);

  // Mark CS accepted (immutability trigger allows status -> accepted because OLD.status was issued/viewed/draft)
  const { error: csErr } = await supabase.from("contract_summaries").update({
    status: "accepted",
    accepted_at: acceptedAt,
    accepted_ip: ip,
    accepted_user_agent: ua,
  }).eq("id", cs.id);
  if (csErr) return jsonResponse({ error: "cs_update_failed", details: csErr.message }, 500);

  await supabase.from("quotes").update({ status: "accepted" }).eq("id", cs.quote_id);
  await supabase.from("quote_requests").update({ status: "converted" }).eq("id", cs.quote_request_id);

  await supabase.rpc("log_event", {
    _actor_type: "public", _event_type: "contract_summary_accepted",
    _title: `CS accepted ${cs.cs_number}`,
    _details: { contract_summary_id: cs.id, quote_id: cs.quote_id, email_masked: maskEmail(i.accepted_by_email) },
    _source_module: "contract_summary", _quote_id: cs.quote_id, _contract_summary_id: cs.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: cs.quote_id, quote_request_id: cs.quote_request_id, contract_summary_id: cs.id,
    event_type: "contract_summary_accepted", title: "Contract Summary accepted",
    details: { email_masked: maskEmail(i.accepted_by_email) },
    actor_type: "public",
  });

  // Customer email
  void sendResendEmail({
    to: i.accepted_by_email,
    subject: `Contract Summary accepted — ${cs.cs_number}`,
    html: brutalistEmailShell(
      "Contract Summary accepted",
      `<p>Thanks, ${escapeHtml(i.accepted_by_name.split(" ")[0])}.</p>
       <p>We've recorded your acceptance of Contract Summary <strong>${escapeHtml(cs.cs_number)}</strong>.</p>
       <p>OCCTA will be in touch with the next step. If a payment is required up front, you'll receive a secure payment link from us — we never take card details over email.</p>`,
    ),
  });

  // Internal admin notice
  const adminEmail = Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
  void sendResendEmail({
    to: adminEmail,
    subject: `[CS accepted] ${cs.cs_number}`,
    html: brutalistEmailShell(
      "Contract Summary accepted",
      `<p>CS <strong>${escapeHtml(cs.cs_number)}</strong> accepted by ${escapeHtml(maskEmail(i.accepted_by_email))}.</p><p>Issue payment link or confirm provisioning as needed.</p>`,
      { label: "Open admin", url: `https://www.occta.co.uk/admin/quotes` },
    ),
  });

  return jsonResponse({ ok: true, quote_id: cs.quote_id, contract_summary_id: cs.id });
});