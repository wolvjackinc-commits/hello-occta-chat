import { corsHeaders, jsonResponse, getServiceClient, requireStaff, sendResendEmail, brutalistEmailShell, escapeHtml, generateTokenPair } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({}));
  const quote_id: string | undefined = body?.quote_id;
  if (!quote_id) return jsonResponse({ error: "missing_quote_id" }, 400);

  const supabase = getServiceClient();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quote_id).maybeSingle();
  if (!quote) return jsonResponse({ error: "not_found" }, 404);
  if (!quote.monthly_gross || !quote.expires_at) return jsonResponse({ error: "missing_required_fields" }, 400);
  const unifiedJourney = body?.unified_journey !== false;
  if (quote.plan_type === "contract_saver" && !quote.contract_length_months) {
    return jsonResponse({ error: "contract_length_required" }, 400);
  }

  // Margin guard: block sending if latest margin check is red without override.
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

  const { data: qr } = await supabase.from("quote_requests").select("email, full_name").eq("id", quote.quote_request_id).single();

  // Create a public token if missing. Do not rotate by default on resend: old
  // emailed links may already have an in-progress journey attached, and changing
  // the hash strands the customer on a stale link. Only rotate when explicitly
  // requested by admin.
  let publicToken: string | null = null;
  if (!quote.public_token_hash) {
    const { raw, hash } = await generateTokenPair();
    publicToken = raw;
    await supabase.from("quotes").update({ public_token_hash: hash, token_expires_at: quote.expires_at, unified_journey_opt_in: unifiedJourney }).eq("id", quote.id);
  } else if (body.rotate_token === true) {
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

  const url = `https://www.occta.co.uk/quote/${publicToken}`;

  const html = brutalistEmailShell(
    "Your OCCTA quote is ready",
    `<p>Hi ${escapeHtml(qr?.full_name?.split(" ")[0] ?? "there")},</p>
     <p>Your OCCTA quote (<strong>${escapeHtml(quote.quote_number)}</strong>) is ready to view.</p>
     <p><strong>Plan:</strong> ${escapeHtml(quote.plan_name)} — £${Number(quote.monthly_gross).toFixed(2)}/month</p>
     <p style="font-size:12px;color:#555;">Your final price, speed estimate, contract length, one-off charges, installation details, cancellation/cease charges and key terms will be confirmed in your Contract Summary before you pay. No payment is taken until you've reviewed and accepted your Contract Summary.</p>
     <p style="font-size:11px;color:#777;">This link is unique to you. Quote expires ${new Date(quote.expires_at).toLocaleDateString("en-GB")}.</p>`,
    { label: "View your quote", url },
  );

  const sendRes = await sendResendEmail({ to: qr!.email, subject: `Your OCCTA quote ${quote.quote_number}`, html });
  if (!sendRes.ok) return jsonResponse({ error: "email_failed", details: sendRes.error }, 502);

  await supabase.from("quotes").update({ status: "sent" }).eq("id", quote.id);
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