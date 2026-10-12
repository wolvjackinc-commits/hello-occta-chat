// Outreach unsubscribe.
//   POST ?t=<token>            RFC 8058 one-click from mail clients (body List-Unsubscribe=One-Click)
//   POST {"token": "<token>"}  from the /unsubscribe page on the website
//   POST {"token", "lookup": true}  returns the masked address for the page to show
//   GET  ?t=<token>            redirects people to the website confirmation page
import { corsHeaders, getServiceClient, maskEmail } from "../_shared/quoteHelpers.ts";
import { SITE_URL } from "../_shared/outreachSender.ts";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const t = url.searchParams.get("t") ?? "";
    return new Response(null, {
      status: 302,
      headers: { Location: `${SITE_URL}/unsubscribe${TOKEN_RE.test(t) ? `?t=${encodeURIComponent(t)}` : ""}` },
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let token = url.searchParams.get("t") ?? "";
  let lookup = false;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({})) as { token?: unknown; lookup?: unknown };
    if (typeof body.token === "string") token = body.token;
    lookup = body.lookup === true;
  }
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: "invalid_link" }, 400);

  const db = getServiceClient();
  const { data: message, error } = await db
    .from("outreach_messages")
    .select("id, email, unsubscribed_at")
    .eq("token", token)
    .maybeSingle();
  if (error) return json({ ok: false, error: "temporarily_unavailable" }, 503);
  if (!message) return json({ ok: false, error: "invalid_link" }, 404);

  if (lookup) {
    const { data: s } = await db.from("outreach_suppressions").select("email").eq("email", message.email).maybeSingle();
    return json({ ok: true, email: maskEmail(message.email), unsubscribed: Boolean(s || message.unsubscribed_at) });
  }

  const source = contentType.includes("application/json") ? "unsubscribe_page" : "one_click_header";
  const { error: rpcError } = await db.rpc("outreach_suppress", {
    p_email: message.email,
    p_reason: "unsubscribed",
    p_source: source,
    p_message_id: message.id,
  });
  if (rpcError) {
    console.error("outreach-unsubscribe failed", rpcError.message);
    return json({ ok: false, error: "temporarily_unavailable" }, 503);
  }
  return json({ ok: true, email: maskEmail(message.email) });
});
