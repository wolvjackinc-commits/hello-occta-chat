import { corsHeaders, jsonResponse, getServiceClient, generateTokenPair, sendResendEmail, brutalistEmailShell, escapeHtml } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  console.log("auth_debug", {
    hasAuth: !!authHeader,
    tokLen: token.length,
    svcLen: serviceKey.length,
    matchSvc: !!serviceKey && token === serviceKey,
    matchAnon: !!anonKey && token === anonKey,
    headers: Object.fromEntries(req.headers.entries()),
  });
  if (!token || (token !== serviceKey && token !== anonKey)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const quote_id: string | undefined = body?.quote_id;
  const extra_to: string | undefined = body?.extra_to;
  if (!quote_id) return jsonResponse({ error: "missing_quote_id" }, 400);

  const supabase = getServiceClient();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quote_id).maybeSingle();
  if (!quote) return jsonResponse({ error: "not_found" }, 404);

  const { data: qr } = await supabase.from("quote_requests").select("email, full_name").eq("id", quote.quote_request_id).single();

  const { raw, hash } = await generateTokenPair();
  await supabase.from("quotes").update({ public_token_hash: hash, token_expires_at: quote.expires_at }).eq("id", quote.id);

  const url = `https://www.occta.co.uk/quote/${raw}`;
  const firstName = qr?.full_name?.split(" ")[0] ?? "there";

  const html = brutalistEmailShell(
    "Your OCCTA quote link is ready",
    `<p>Hi ${escapeHtml(firstName)},</p>
     <p>Good news — the issue with your quote has been resolved. Your secure link is ready and the journey will now complete end-to-end.</p>
     <p><strong>Quote:</strong> ${escapeHtml(quote.quote_number)}<br/>
        <strong>Plan:</strong> ${escapeHtml(quote.plan_name)} — £${Number(quote.monthly_gross).toFixed(2)}/month</p>
     <p>Please use the button below to pick up where you left off. If you'd prefer a brand-new link instead, just reply to this email and we'll send one.</p>
     <p style="font-size:11px;color:#777;">This link is unique to you and replaces any previous link. Quote expires ${new Date(quote.expires_at).toLocaleDateString("en-GB")}.</p>`,
    { label: "Continue your quote", url },
  );

  const recipients = [qr!.email];
  if (extra_to) recipients.push(extra_to);

  const sendRes = await sendResendEmail({ to: recipients, subject: `Your OCCTA quote ${quote.quote_number} — link ready`, html });
  if (!sendRes.ok) return jsonResponse({ error: "email_failed", details: sendRes.error }, 502);

  return jsonResponse({ ok: true, sent_to: recipients, url });
});