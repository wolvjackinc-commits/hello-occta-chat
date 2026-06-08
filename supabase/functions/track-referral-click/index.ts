import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

const SALT = Deno.env.get("REFERRAL_HASH_SALT") || "occta-ref-salt-v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase().slice(0, 16);
  if (!code) return jsonResponse({ error: "missing_code" }, 400);

  const ip = getRequestIp(req);
  const rlKey = ip ?? "anon";
  const allowed = await checkRateLimit(`${rlKey}:${code}`, "referral_click", 20, 60);
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  const svc = getServiceClient();
  const { data: rc } = await svc
    .from("referral_codes")
    .select("id, customer_id, status, expires_at")
    .eq("code", code).maybeSingle();
  if (!rc || rc.status !== "active") return jsonResponse({ ok: true }); // silent
  if (rc.expires_at && new Date(rc.expires_at) < new Date()) return jsonResponse({ ok: true });

  const ua = (req.headers.get("user-agent") || "").slice(0, 500);
  const [ipHash, uaHash] = await Promise.all([
    ip ? sha256Hex(SALT + ":" + ip) : Promise.resolve(null),
    ua ? sha256Hex(SALT + ":" + ua) : Promise.resolve(null),
  ]);

  await svc.from("referral_events").insert({
    referral_code_id: rc.id,
    referrer_customer_id: rc.customer_id,
    event_type: "clicked",
    ip_hash: ipHash,
    user_agent_hash: uaHash,
    details: {},
  });

  await svc.rpc("log_event", {
    _actor_type: "anon",
    _event_type: "referral_clicked",
    _title: "Referral link clicked",
    _source_module: "rewards",
    _details: { referral_code_id: rc.id },
  });

  return jsonResponse({ ok: true });
});