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
  if (quote.plan_type === "contract_saver" && !quote.contract_length_months) {
    return jsonResponse({ error: "contract_length_required" }, 400);
  }

  const { data: qr } = await supabase.from("quote_requests").select("email, full_name").eq("id", quote.quote_request_id).single();

  // Rotate token if missing
  let publicToken: string | null = null;
  if (!quote.public_token_hash) {
    const { raw, hash } = await generateTokenPair();
    publicToken = raw;
    await supabase.from("quotes").update({ public_token_hash: hash, token_expires_at: quote.expires_at }).eq("id", quote.id);
  } else if (body.rotate_token === true) {
    const { raw, hash } = await generateTokenPair();
    publicToken = raw;
    await supabase.from("quotes").update({ public_token_hash: hash }).eq("id", quote.id);
  }
  // If we don't already have the raw token (e.g. resend), we must rotate. Admin can pass rotate_token=true; otherwise default to rotate-on-send.
  if (!publicToken) {
    const { raw, hash } = await generateTokenPair();
    publicToken = raw;
    await supabase.from("quotes").update({ public_token_hash: hash }).eq("id", quote.id);
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

  return jsonResponse({ ok: true });
});