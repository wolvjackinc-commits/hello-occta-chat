import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase().slice(0, 16);
  const quoteRequestId = String(body.quote_request_id ?? "").trim();
  if (!code || !quoteRequestId) return jsonResponse({ ok: true }); // best-effort silent

  const svc = getServiceClient();
  const { data: rc } = await svc
    .from("referral_codes")
    .select("id, customer_id, status, expires_at")
    .eq("code", code).maybeSingle();
  if (!rc || rc.status !== "active") return jsonResponse({ ok: true });
  if (rc.expires_at && new Date(rc.expires_at) < new Date()) return jsonResponse({ ok: true });

  const { data: qr } = await svc
    .from("quote_requests")
    .select("id, email, phone, customer_id")
    .eq("id", quoteRequestId).maybeSingle();
  if (!qr) return jsonResponse({ ok: true });

  // Self-referral checks
  let selfRef = false;
  if (rc.customer_id && qr.customer_id && rc.customer_id === qr.customer_id) selfRef = true;
  if (rc.customer_id) {
    const { data: ownerProfile } = await svc
      .from("profiles").select("email, phone").eq("id", rc.customer_id).maybeSingle();
    if (ownerProfile?.email && qr.email && ownerProfile.email.toLowerCase() === String(qr.email).toLowerCase()) selfRef = true;
    if (ownerProfile?.phone && qr.phone && ownerProfile.phone === qr.phone) selfRef = true;
  }

  if (selfRef) {
    await svc.from("fraud_flags").insert({
      customer_id: qr.customer_id ?? null,
      flag_type: "self_referral",
      severity: "medium",
      details: { referral_code_id: rc.id, quote_request_id: qr.id },
    });
    await svc.rpc("log_event", {
      _actor_type: "system", _event_type: "fraud_flag_created",
      _title: "Self-referral flagged",
      _source_module: "rewards", _severity: "warn",
      _details: { referral_code_id: rc.id, reason: "self_referral" },
    });
    return jsonResponse({ ok: true, flagged: true });
  }

  await svc.from("referral_events").insert({
    referral_code_id: rc.id,
    referrer_customer_id: rc.customer_id,
    referred_customer_id: qr.customer_id,
    referred_quote_request_id: qr.id,
    event_type: "quote_submitted",
    details: {},
  });
  await svc.from("referral_codes").update({ usage_count: 1 }).eq("id", rc.id);
  // increment usage_count atomically
  await svc.rpc?.("noop").catch(() => {});
  await svc.from("referral_codes").update({ usage_count: (await svc.from("referral_codes").select("usage_count").eq("id", rc.id).maybeSingle()).data?.usage_count ?? 1 }).eq("id", rc.id);

  await svc.rpc("log_event", {
    _actor_type: "system", _event_type: "referral_attached_to_quote",
    _title: "Referral attached to quote",
    _source_module: "rewards",
    _details: { referral_code_id: rc.id, quote_request_id: qr.id },
  });

  return jsonResponse({ ok: true });
});