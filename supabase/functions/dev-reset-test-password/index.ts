import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

// One-shot Phase D helper. Hard-locked to the test customer id.
// Will be deleted immediately after Phase D verification.
const ALLOWED_USER_ID = "02643ff3-3562-439d-83cb-c64c3fbec155";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const { user_id, password } = await req.json().catch(() => ({} as { user_id?: string; password?: string }));
  if (user_id !== ALLOWED_USER_ID) return jsonResponse({ error: "user_not_allowed" }, 403);
  if (!password || password.length < 16) return jsonResponse({ error: "password_too_short" }, 400);

  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.admin.updateUserById(user_id, { password, email_confirm: true });
  if (error) return jsonResponse({ error: "update_failed", details: error.message }, 500);
  return jsonResponse({ ok: true, user_id: data.user?.id, email: data.user?.email });
});