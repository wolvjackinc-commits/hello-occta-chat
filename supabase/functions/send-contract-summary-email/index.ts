import {
  corsHeaders, jsonResponse, getServiceClient, requireStaff,
  generateTokenPair, sendResendEmail, brutalistEmailShell, escapeHtml,
} from "../_shared/quoteHelpers.ts";
import { fetchHelpfulLinksHtml } from "../_shared/helpfulLinks.ts";
import { z } from "https://esm.sh/zod@3.23.8";

// Admin-only: send the "Contract Summary ready" email to the customer.
//   - Rotates the public token (raw token NEVER stored or returned to admin —
//     only the SHA-256 hash lands in the DB; the raw token appears only inside
//     the email URL).
//   - REFUSES to rotate / resend once the CS has been accepted.
//   - Guarantees the immutable PDF exists before sending (calls
//     generate-contract-summary-pdf with internal=1 if missing).
//   - Logs every send attempt to communications_log so admin can audit / retry.

const Schema = z.object({
  contract_summary_id: z.string().uuid(),
  expires_in_days: z.number().int().min(1).max(60).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { contract_summary_id, expires_in_days } = parsed.data;

  const supabase = getServiceClient();

  const { data: cs, error: csErr } = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("id", contract_summary_id)
    .maybeSingle();
  if (csErr || !cs) return jsonResponse({ error: "cs_not_found" }, 404);

  if (cs.status === "accepted") {
    return jsonResponse({
      error: "already_accepted",
      message: "This Contract Summary has already been accepted. The signed copy is locked — no new link can be issued.",
    }, 409);
  }
  if (!["draft", "issued", "viewed"].includes(cs.status)) {
    return jsonResponse({ error: "not_sendable", status: cs.status }, 409);
  }

  // Ensure the IMMUTABLE PDF exists before sending. Never regenerated after acceptance,
  // but at this stage status is draft/issued/viewed so first-time generation is allowed.
  if (!cs.pdf_storage_key) {
    try {
      const projectUrl = Deno.env.get("SUPABASE_URL")!;
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${projectUrl}/functions/v1/generate-contract-summary-pdf`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${svcKey}`,
          "Content-Type": "application/json",
          "x-internal-service": "1",
        },
        body: JSON.stringify({ contract_summary_id: cs.id, internal: true, actor_id: auth.userId }),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        return jsonResponse({ error: "pdf_generation_failed", details: body.slice(0, 300) }, 502);
      }
    } catch (e) {
      return jsonResponse({ error: "pdf_generation_failed", details: (e as Error).message }, 502);
    }
  }

  // Rotate the public token. Raw token is NEVER persisted or returned to admin —
  // only the SHA-256 hash hits the DB, and the raw value lives only in the email URL.
  const { raw, hash } = await generateTokenPair();
  const daysValid = expires_in_days ?? 14;
  const tokenExpiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();

  const { error: updErr } = await supabase
    .from("contract_summaries")
    .update({
      public_token_hash: hash,
      token_expires_at: tokenExpiresAt,
      emailed_at: new Date().toISOString(),
      // bump status from draft -> issued so the customer-facing flow expects it
      status: cs.status === "draft" ? "issued" : cs.status,
    })
    .eq("id", cs.id);
  if (updErr) return jsonResponse({ error: "token_rotate_failed", details: updErr.message }, 500);

  const appBase = Deno.env.get("APP_BASE_URL") || "https://www.occta.co.uk";
  const csUrl = `${appBase}/quote/contract-summary/${raw}`;

  const recipient = cs.customer_email_snapshot;
  const firstName = (cs.customer_name_snapshot || "there").split(" ")[0];
  const priceLine = cs.customer_type === "business"
    ? `£${Number(cs.business_monthly_incl_vat ?? cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`
    : `£${Number(cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`;

  const html = brutalistEmailShell(
    "Your OCCTA Contract Summary",
    `<p>Hi ${escapeHtml(firstName)},</p>
     <p>Your OCCTA Contract Summary is ready to review. Nothing has been charged — this is your chance to read the details and confirm you're happy before we go any further.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Contract Summary</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.cs_number)}</strong> (v${cs.version})</td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Plan</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.plan_name)}</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Monthly price</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(priceLine)}</strong></td></tr>
       <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Service address</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(cs.service_address ?? "")}</td></tr>
     </table>
     <p><strong>What you need to do:</strong> open the Contract Summary, read it, then tick the box and accept if you're happy. If anything looks off, just reply to this email and we'll sort it.</p>
     <p><strong>What happens after acceptance:</strong> we send a secure payment link from OCCTA — we never take card details over email — then arrange your install / activation.</p>
     <p style="font-size:12px;color:#555;">This link is private to you and expires in ${daysValid} days. Sending a new copy disables old links.</p>
     <p style="font-size:12px;color:#555;">Questions? Reply to this email or contact <a href="mailto:hello@occta.co.uk" style="color:#555;">hello@occta.co.uk</a>.</p>
     ${await fetchHelpfulLinksHtml(supabase, "contract_summary_ready")}`,
    { label: "View and accept Contract Summary", url: csUrl },
  );

  const send = await sendResendEmail({
    to: recipient,
    subject: `Your OCCTA Contract Summary is ready`,
    html,
  });

  // Audit — log to communications_log regardless of outcome
  await supabase.from("communications_log").insert({
    user_id: cs.customer_id,
    template_name: "contract_summary_ready",
    recipient_email: recipient,
    status: send.ok ? "sent" : "failed",
    sent_at: send.ok ? new Date().toISOString() : null,
    error_message: send.ok ? null : (send.error ?? "send_failed"),
    metadata: {
      contract_summary_id: cs.id,
      cs_number: cs.cs_number,
      cs_version: cs.version,
      pdf_sha256: cs.pdf_sha256,
      sent_by_admin: auth.userId,
      token_expires_at: tokenExpiresAt,
    },
  });

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: send.ok ? "contract_summary_email_sent" : "contract_summary_email_failed",
    _title: send.ok
      ? `CS ready email sent — ${cs.cs_number}`
      : `CS ready email FAILED — ${cs.cs_number}`,
    _details: {
      contract_summary_id: cs.id,
      cs_number: cs.cs_number,
      error: send.ok ? null : send.error,
    },
    _source_module: "contract_summary",
    _quote_id: cs.quote_id,
    _contract_summary_id: cs.id,
    _customer_id: cs.customer_id,
    _severity: send.ok ? "info" : "warning",
  });

  await supabase.from("quote_events").insert({
    quote_id: cs.quote_id,
    quote_request_id: cs.quote_request_id,
    contract_summary_id: cs.id,
    event_type: send.ok ? "contract_summary_email_sent" : "contract_summary_email_failed",
    title: send.ok ? `Contract Summary email sent to customer` : `Contract Summary email failed`,
    actor_type: "admin",
    actor_id: auth.userId,
    details: { cs_number: cs.cs_number, cs_version: cs.version, error: send.ok ? null : send.error },
  });

  if (!send.ok) {
    return jsonResponse({ error: "email_failed", details: send.error }, 502);
  }

  // Deliberately do NOT include the raw token in the response — never expose it
  // to admin diagnostics; it lives only in the customer's email.
  return jsonResponse({
    ok: true,
    contract_summary_id: cs.id,
    cs_number: cs.cs_number,
    recipient_masked: recipient.replace(/(.).+?(@.+)/, "$1***$2"),
    token_expires_at: tokenExpiresAt,
  });
});