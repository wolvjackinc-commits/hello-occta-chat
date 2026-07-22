import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await authed.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
  const svc = createClient(supabaseUrl, serviceRole);
  const adminRes = await svc.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  const superRes = await svc.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" });
  if (adminRes.data !== true && superRes.data !== true) return json(403, { error: "Forbidden" });

  let body: { delivery_id?: string } = {};
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  if (!body.delivery_id) return json(400, { error: "delivery_id required" });

  const { data: row, error: rowErr } = await svc
    .from("webhook_deliveries")
    .select("*")
    .eq("id", body.delivery_id)
    .maybeSingle();
  if (rowErr || !row) return json(404, { error: "Delivery not found" });

  const source = String(row.source || "");
  if (source.startsWith("worldpay:")) {
    const secret = Deno.env.get("WORLDPAY_WEBHOOK_SECRET");
    if (!secret) return json(500, { error: "WORLDPAY_WEBHOOK_SECRET not configured" });
    const targetUrl = `${supabaseUrl}/functions/v1/worldpay-webhook`;
    const payloadText = typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload ?? {});
    let httpStatus = 0;
    let respBody: unknown = null;
    try {
      const r = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": secret,
          "x-replay-of": row.id,
          "authorization": `Bearer ${serviceRole}`,
        },
        body: payloadText,
      });
      httpStatus = r.status;
      try { respBody = await r.json(); } catch { respBody = null; }
    } catch (e: any) {
      httpStatus = 0;
      respBody = { error: e.message };
    }

    await svc.from("webhook_deliveries").update({
      replay_count: (row.replay_count ?? 0) + 1,
      last_replayed_at: new Date().toISOString(),
      last_replayed_by: userData.user.id,
    }).eq("id", row.id);

    await svc.from("audit_logs").insert({
      action: "webhook_replay",
      entity: "webhook_delivery",
      metadata: { delivery_id: row.id, source, http_status: httpStatus, by: userData.user.id },
    });

    return json(200, { status: httpStatus, result: respBody });
  }

  return json(400, { error: `Replay not supported for source: ${source}` });
});