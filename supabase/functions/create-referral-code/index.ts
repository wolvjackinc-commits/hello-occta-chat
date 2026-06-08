import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SAFE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += SAFE[b % SAFE.length];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return jsonResponse({ error: "invalid_jwt" }, 401);
  const userId = u.user.id;

  const svc = getServiceClient();

  // Check for existing active code
  const { data: existing } = await svc
    .from("referral_codes")
    .select("id, code, status")
    .eq("customer_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return jsonResponse({ error: "already_has_active_code", code: existing.code }, 409);

  let code = "";
  for (let i = 0; i < 6; i++) {
    code = genCode(8);
    const { data: clash } = await svc.from("referral_codes").select("id").eq("code", code).maybeSingle();
    if (!clash) break;
    if (i === 5) return jsonResponse({ error: "code_generation_failed" }, 500);
  }

  const { data: row, error } = await svc
    .from("referral_codes")
    .insert({ customer_id: userId, code, status: "active" })
    .select().maybeSingle();
  if (error) return jsonResponse({ error: error.message }, 500);

  await svc.rpc("log_event", {
    _actor_type: "customer",
    _event_type: "referral_code_created",
    _title: "Referral code created",
    _customer_id: userId,
    _source_module: "rewards",
    _severity: "info",
    _details: { code },
  });

  return jsonResponse({ ok: true, code: row?.code });
});