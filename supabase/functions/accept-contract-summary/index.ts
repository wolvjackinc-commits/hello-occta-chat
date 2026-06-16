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

  // CORRECTION #1 — refuse to lock acceptance if the immutable PDF is missing.
  // The signed copy MUST reference a stored, hashed document; never generate
  // post-acceptance evidence. If the PDF is absent, admin must investigate.
  if (!cs.pdf_storage_key || !cs.pdf_sha256) {
    return jsonResponse({
      error: "missing_immutable_pdf",
      message: "This Contract Summary has no stored PDF yet. Please ask OCCTA to resend it before accepting.",
    }, 409);
  }

  const acceptedAt = new Date().toISOString();
  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? null;

  // Insert acceptance (append-only) with full Phase D vault snapshot
  const { error: aErr } = await supabase.from("contract_acceptances").insert({
    contract_summary_id: cs.id,
    quote_id: cs.quote_id,
    quote_request_id: cs.quote_request_id,
    customer_id: cs.customer_id,
    accepted_by_name: i.accepted_by_name,
    accepted_by_email: i.accepted_by_email,
    accepted_by_user: cs.customer_id,
    accepted_at: acceptedAt,
    ip, user_agent: ua,
    acceptance_text: ACCEPTANCE_CHECKBOX_TEXT,
    acceptance_text_version: cs.terms_version,
    checkbox_confirmed: true,
    cs_version: cs.version,
    terms_version: cs.terms_version,
    privacy_version: cs.privacy_version,
    pdf_storage_key: cs.pdf_storage_key,
    pdf_sha256: cs.pdf_sha256,
    account_number: cs.account_number,
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

  await supabase.from("quotes").update({ status: "contract_summary_accepted" }).eq("id", cs.quote_id);
  await supabase.from("quote_requests").update({ status: "contract_summary_accepted", updated_at: acceptedAt }).eq("id", cs.quote_request_id);

  await supabase.rpc("log_event", {
    _actor_type: "anon", _event_type: "contract_summary_accepted",
    _title: `CS accepted ${cs.cs_number}`,
    _details: { contract_summary_id: cs.id, quote_id: cs.quote_id, email_masked: maskEmail(i.accepted_by_email) },
    _source_module: "contract_summary", _quote_id: cs.quote_id, _contract_summary_id: cs.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: cs.quote_id, quote_request_id: cs.quote_request_id, contract_summary_id: cs.id,
    event_type: "contract_summary_accepted", title: "Contract Summary accepted",
    details: { email_masked: maskEmail(i.accepted_by_email) },
    actor_type: "anon",
  });

  // CORRECTION #4 — acceptance is now locked. Email delivery is a best-effort
  // side-effect; never roll back the acceptance if email fails.
  await sendAcceptanceWelcome(supabase, cs, i.accepted_by_email, i.accepted_by_name);

  return jsonResponse({ ok: true, quote_id: cs.quote_id, contract_summary_id: cs.id });
});

// ─────────────────────────────────────────────────────────────────────────────
// Welcome / signed-copy email — idempotent via communications_log dedupe.
// Sends a warm branded email plus an internal admin notice. Logs success/failure
// rows in communications_log so admin can resend later.
// ─────────────────────────────────────────────────────────────────────────────
async function sendAcceptanceWelcome(
  supabase: ReturnType<typeof getServiceClient>,
  cs: any,
  recipient: string,
  acceptedByName: string,
) {
  try {
    // Idempotency — never send a duplicate welcome email for the same CS.
    const { data: existing } = await supabase
      .from("communications_log")
      .select("id")
      .eq("template_name", "contract_summary_accepted_welcome")
      .eq("status", "sent")
      .contains("metadata", { contract_summary_id: cs.id })
      .limit(1)
      .maybeSingle();
    if (existing) return;

    // Fetch a fresh signed download URL for the IMMUTABLE PDF (never regenerated).
    let signedUrl: string | null = null;
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
        body: JSON.stringify({ contract_summary_id: cs.id, internal: true }),
      });
      if (r.ok) {
        const j = await r.json();
        signedUrl = j?.signed_url ?? null;
      }
    } catch { /* signedUrl stays null */ }

    const firstName = (acceptedByName || "there").split(" ")[0];
    const priceLine = cs.customer_type === "business"
      ? `£${Number(cs.business_monthly_incl_vat ?? cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`
      : `£${Number(cs.monthly_price_incl_vat ?? 0).toFixed(2)}/mo incl. VAT`;

    const html = brutalistEmailShell(
      "Welcome to OCCTA",
      `<p>Hi ${escapeHtml(firstName)},</p>
       <p>Welcome aboard — the paperwork is officially behaving itself. Your Contract Summary has been accepted and your copy is safely stored below.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse;">
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Contract Summary</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.cs_number)}</strong> (v${cs.version})</td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Plan</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(cs.plan_name)}</strong></td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Monthly price</td><td style="padding:6px 0;font-size:13px;"><strong>${escapeHtml(priceLine)}</strong></td></tr>
         <tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#555;">Accepted</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(new Date(cs.accepted_at ?? Date.now()).toLocaleString("en-GB"))}</td></tr>
       </table>
       <p><strong>What happens next?</strong> Our team will follow up with a secure payment link — we never take card details over email. After payment we'll arrange your install / activation.</p>
       <p>Your signed copy is below — keep it for your records. The link refreshes for 7 days; you can always download a fresh copy from your OCCTA dashboard.</p>
       <p style="font-size:12px;color:#555;">Questions? Reply to this email or contact <a href="mailto:hello@occta.co.uk" style="color:#555;">hello@occta.co.uk</a>.</p>`,
      signedUrl ? { label: "Download signed copy", url: signedUrl } : undefined,
    );

    const send = await sendResendEmail({
      to: recipient,
      subject: `Welcome to OCCTA — your Contract Summary is accepted`,
      html,
    });

    await supabase.from("communications_log").insert({
      user_id: cs.customer_id,
      template_name: "contract_summary_accepted_welcome",
      recipient_email: recipient,
      status: send.ok ? "sent" : "failed",
      sent_at: send.ok ? new Date().toISOString() : null,
      error_message: send.ok ? null : (send.error ?? "send_failed"),
      metadata: {
        contract_summary_id: cs.id,
        cs_number: cs.cs_number,
        cs_version: cs.version,
        pdf_sha256: cs.pdf_sha256,
        has_signed_url: !!signedUrl,
        accepted_via: "token",
      },
    });

    // Internal admin notice (best-effort, not deduped — admin can have multiple inboxes)
    const adminEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
    void sendResendEmail({
      to: adminEmail,
      subject: `[CS accepted] ${cs.cs_number}`,
      html: brutalistEmailShell(
        "Contract Summary accepted",
        `<p>CS <strong>${escapeHtml(cs.cs_number)}</strong> accepted by ${escapeHtml(maskEmail(recipient))}.</p>
         <p>PDF SHA-256: <code style="font-size:11px;">${escapeHtml(String(cs.pdf_sha256))}</code></p>`,
        { label: "Open admin", url: `https://www.occta.co.uk/admin/quote-requests` },
      ),
    });
  } catch (e) {
    // Never throw — acceptance is the legal action; email is best-effort.
    try {
      await supabase.from("communications_log").insert({
        user_id: cs.customer_id,
        template_name: "contract_summary_accepted_welcome",
        recipient_email: recipient,
        status: "failed",
        error_message: `exception: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`,
        metadata: { contract_summary_id: cs.id, accepted_via: "token" },
      });
    } catch { /* swallow */ }
  }
}