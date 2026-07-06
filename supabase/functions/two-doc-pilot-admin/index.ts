// Admin-only management for the two-document staff pilot allowlist.
// GET  { action: "list" }                            -> current allowlist rows
// POST { action: "add", user_id, note? }             -> whitelist a user
// POST { action: "remove", user_id }                 -> deactivate a user
// POST { action: "events", limit? }                  -> last N pilot events
//
// Requires an admin/super_admin JWT. The global flag is untouched.

import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
import { callerUserIdFromRequest } from "../_shared/twoDocFlowGate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const callerId = callerUserIdFromRequest(req);
  if (!callerId) return jsonResponse({ error: "unauthorized" }, 401);

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: callerId, _role: "admin",
  });
  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: callerId, _role: "super_admin",
  });
  if (!isAdmin && !isSuper) return jsonResponse({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action ?? "list");

  if (action === "list") {
    const { data } = await supabase
      .from("two_doc_pilot_allowlist")
      .select("*")
      .order("created_at", { ascending: false });
    return jsonResponse({ ok: true, rows: data ?? [] });
  }

  if (action === "add") {
    const userId = String(body.user_id ?? "");
    if (!userId) return jsonResponse({ error: "user_id_required" }, 400);
    const { data, error } = await supabase
      .from("two_doc_pilot_allowlist")
      .upsert({
        user_id: userId,
        added_by: callerId,
        note: body.note ? String(body.note) : null,
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();
    if (error) return jsonResponse({ error: "insert_failed", details: error.message }, 500);
    return jsonResponse({ ok: true, row: data });
  }

  if (action === "remove") {
    const userId = String(body.user_id ?? "");
    if (!userId) return jsonResponse({ error: "user_id_required" }, 400);
    const { error } = await supabase
      .from("two_doc_pilot_allowlist")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: "update_failed", details: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  if (action === "events") {
    const limit = Math.min(Math.max(1, Number(body.limit ?? 100)), 500);
    const { data } = await supabase
      .from("two_doc_pilot_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return jsonResponse({ ok: true, rows: data ?? [] });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});