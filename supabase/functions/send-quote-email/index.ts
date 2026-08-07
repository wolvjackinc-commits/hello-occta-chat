import { corsHeaders, jsonResponse, getServiceClient, requireStaff, sendResendEmail, brutalistEmailShell, escapeHtml, generateTokenPair } from "../_shared/quoteHelpers.ts";
import { fetchHelpfulLinksHtml } from "../_shared/helpfulLinks.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Internal service-to-service path (used by admin-bulk-resend-quotes). Requires
  // the service role key AND the explicit internal marker header.
  const isInternal =
    req.headers.get("x-internal-service") === "1" &&
    req.headers.get("Authorization") === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  let actorId: string | null = null;
  if (!isInternal) {
    const auth = await requireStaff(req);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);
    actorId = auth.userId;
  }
  const auth = { userId: actorId } as { userId: string | null };

  const body = await req.json().catch(() => ({}));
  const quote_id: string | undefined = body?.quote_id;
  if (!quote_id) return jsonResponse({ error: "missing_quote_id" }, 400);
  const customMessageRaw: string = typeof body?.custom_message === "string" ? body.custom_message : "";
  const previewOnly: boolean = body?.preview_only === true;
  const rotateToken: boolean = body?.rotate_token === true;

  const supabase = getServiceClient();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quote_id).maybeSingle();
  if (!quote) return jsonResponse({ error: "not_found" }, 404);
  if (!quote.monthly_gross || !quote.expires_at) return jsonResponse({ error: "missing_required_fields" }, 400);
  const unifiedJourney = body?.unified_journey !== false;
  if (quote.plan_type === "contract_saver" && !quote.contract_length_months) {
    return jsonResponse({ error: "contract_length_required" }, 400);
  }

  // Margin guard: block sending if latest margin check is red without override.
  // Skip for preview-only requests so admins can review the email before deciding.
  if (!previewOnly) {
    const { data: canSend } = await supabase.rpc("can_send_quote", { _quote_id: quote_id });
    if (canSend === false) {
    await supabase.rpc("log_event", {
      _actor_type: "admin", _event_type: "quote_blocked_low_margin",
      _title: `Quote send blocked ${quote.quote_number}`,
      _details: { quote_id }, _quote_id: quote_id, _source_module: "margin",
      _severity: "warn",
    });
    return jsonResponse({ error: "blocked_low_margin", message: "Latest margin check is red. Override required before sending." }, 409);
    }
  }

  const { data: qr } = await supabase.from("quote_requests").select("email, full_name").eq("id", quote.quote_request_id).single();

  // Create a public token if missing. Do not rotate by default on resend: old
  // emailed links may already have an in-progress journey attached, and changing
  // the hash strands the customer on a stale link. Only rotate when explicitly
  // requested by admin. For preview requests we render with a placeholder link
  // so we never expose or rotate a real token unnecessarily.
  let publicToken: string | null = null;
  if (!previewOnly) {
    if (!quote.public_token_hash) {
      const { raw, hash } = await generateTokenPair();
      publicToken = raw;
      await supabase.from("quotes").update({ public_token_hash: hash, token_expires_at: quote.expires_at, unified_journey_opt_in: unifiedJourney }).eq("id", quote.id);
    } else if (rotateToken) {
      const { raw, hash } = await generateTokenPair();
      publicToken = raw;
      await supabase.from("quotes").update({ public_token_hash: hash, unified_journey_opt_in: unifiedJourney }).eq("id", quote.id);
    }
    if (!publicToken) {
      return jsonResponse({
        error: "token_rotation_required",
        message: "This quote already has a secure link. Use the existing customer email link, or explicitly rotate the token before resending.",
      }, 409);
    }
  }

  const url = previewOnly
    ? `https://www.occta.co.uk/quote/[secure-link-generated-on-send]`
    : `https://www.occta.co.uk/quote/${publicToken}`;

  const helpfulLinksHtml = await fetchHelpfulLinksHtml(supabase, "quote_sent");

  // Render admin's custom note (plain text with paragraph breaks) into
  // an escaped, brand-styled block placed above the quote details.
  const customBlock = customMessageRaw.trim().length
    ? `<div style="margin:16px 0;padding:14px 16px;border-left:4px solid #facc15;background:#fffbea;font-size:13px;line-height:1.55;color:#111;">
         <div style="font-size:10px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#555;margin-bottom:6px;">A note from your account manager</div>
         ${customMessageRaw.trim().split(/\n{2,}/).map(p =>
           `<p style="margin:0 0 8px 0;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`
         ).join("")}
       </div>`
    : "";

  const html = brutalistEmailShell(
    "Your OCCTA quote is ready",
    `<p>Hi ${escapeHtml(qr?.full_name?.split(" ")[0] ?? "there")},</p>
     <p>Your OCCTA quote (<strong>${escapeHtml(quote.quote_number)}</strong>) is ready to view.</p>
     <p><strong>Plan:</strong> ${escapeHtml(quote.plan_name)} — £${Number(quote.monthly_gross).toFixed(2)}/month</p>
     ${customBlock}
     <p style="font-size:12px;color:#555;">Your final price, speed estimate, contract length, one-off charges, installation details, cancellation/cease charges and key terms will be confirmed in your Contract Summary before you pay. No payment is taken until you've reviewed and accepted your Contract Summary.</p>
     <p style="font-size:11px;color:#777;">This link is unique to you. Quote expires ${new Date(quote.expires_at).toLocaleDateString("en-GB")}.</p>
     ${helpfulLinksHtml}`,
    { label: "View your quote", url },
  );

  const subject = `Your OCCTA quote ${quote.quote_number}`;

  // Preview mode: return the fully-rendered HTML + subject without sending
  // or logging so admins can review before dispatching.
  if (previewOnly) {
    return jsonResponse({ ok: true, preview: true, subject, html, recipient: qr?.email ?? null });
  }

  // Pre-insert log row so the tracking pixel can point at it and we
  // capture read receipts (opened_at / open_count / last_opened_at).
  let logRowId: string | null = null;
  try {
    const { data: logRow } = await supabase
      .from("communications_log")
      .insert({
        user_id: quote.customer_id ?? null,
        template_name: "quote_sent",
        recipient_email: qr!.email,
        status: "queued",
        subject,
        metadata: { quote_id, quote_number: quote.quote_number, has_custom_message: customMessageRaw.trim().length > 0 },
      })
      .select("id")
      .single();
    logRowId = logRow?.id ?? null;
  } catch (e) {
    console.error("[send-quote-email] pre-log insert failed", e);
  }

  const sendRes = await sendResendEmail({
    to: qr!.email,
    subject,
    html,
    trackingLogId: logRowId,
  });

  // Update the log row with the final send outcome + rendered body.
  if (logRowId) {
    try {
      await supabase.from("communications_log").update({
        status: sendRes.ok ? "sent" : "failed",
        provider_message_id: sendRes.ok ? sendRes.messageId : null,
        error_message: sendRes.ok ? null : sendRes.error,
        sent_at: sendRes.ok ? new Date().toISOString() : null,
        body_html: html,
      }).eq("id", logRowId);
    } catch (e) {
      console.error("[send-quote-email] log update failed", e);
    }
  }
  if (!sendRes.ok) return jsonResponse({ error: "email_failed", details: sendRes.error }, 502);

  await supabase.from("quotes").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    locked_at: new Date().toISOString(),
  }).eq("id", quote.id);
  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "quote_sent",
    _title: `Quote sent ${quote.quote_number}`,
    _details: { quote_id: quote.id }, _source_module: "quote", _quote_id: quote.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: quote.id, quote_request_id: quote.quote_request_id,
    event_type: "quote_sent", title: `Quote sent to customer`,
    actor_type: "admin", actor_id: auth.userId,
  });

  // Fire-and-forget: pre-generate Contract Summary + stored PDF so the
  // customer's Continue click can reuse them instantly. Idempotent.
  // Uses EdgeRuntime.waitUntil when available so the background task is
  // not killed when the HTTP response is returned.
  const preGenTask = preGenerateContractSummary(supabase, quote.id, auth.userId);
  try {
    // @ts-expect-error — EdgeRuntime is provided by the Supabase Deno runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-expect-error EdgeRuntime is provided by the Supabase Deno runtime
      EdgeRuntime.waitUntil(preGenTask);
    }
  } catch { /* ignore */ }

  return jsonResponse({ ok: true, public_token: publicToken, public_url: url });
});

/**
 * Fire-and-forget Contract Summary pre-generation.
 * Runs after the quote email is sent so the customer's Continue click can
 * reuse a ready-made CS + stored PDF instead of waiting for synchronous
 * generation. Idempotent: if a non-superseded CS already exists for this
 * (quote_id, version) the generator is skipped. Never creates orders,
 * acceptance evidence, customer emails, or starts cooling-off.
 */
async function preGenerateContractSummary(supabase: ReturnType<typeof getServiceClient>, quote_id: string, actor_id: string | null) {
  try {
    const { data: existing } = await supabase
      .from("contract_summaries")
      .select("id, status, pdf_storage_key")
      .eq("quote_id", quote_id)
      .neq("status", "superseded")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && existing.pdf_storage_key) return; // already ready

    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${projectUrl}/functions/v1/generate-contract-summary`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${svcKey}`,
        "Content-Type": "application/json",
        "x-internal-service": "1",
      },
      body: JSON.stringify({ quote_id, actor_id, journey_mode: true }),
    }).catch(() => {});
  } catch {
    // best-effort; customer Continue path will fall back to synchronous gen
  }
}