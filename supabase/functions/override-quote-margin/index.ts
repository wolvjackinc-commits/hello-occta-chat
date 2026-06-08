import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const { quote_id, reason } = (await req.json().catch(() => ({}))) as { quote_id?: string; reason?: string };
  if (!quote_id) return jsonResponse({ error: "missing_quote_id" }, 400);
  if (!reason || reason.trim().length < 10) return jsonResponse({ error: "reason_too_short" }, 400);

  const supabase = getServiceClient();

  // Confirm there is a red latest check to override
  const { data: latest } = await supabase
    .from("quote_margin_checks")
    .select("status")
    .eq("quote_id", quote_id)
    .order("checked_at", { ascending: false })
    .limit(1).maybeSingle();
  if (!latest || (latest as any).status !== "red") {
    return jsonResponse({ error: "no_red_to_override" }, 409);
  }

  const { data: row, error } = await supabase.from("quote_margin_checks").insert({
    quote_id,
    status: "green",
    reason: `OVERRIDE: ${reason.trim().slice(0, 500)}`,
    checked_by: auth.userId,
  }).select().maybeSingle();
  if (error) return jsonResponse({ error: error.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "quote_margin_override",
    _title: "Red margin overridden",
    _details: { quote_id }, _new_value: { reason: reason.trim().slice(0, 500) } as any,
    _quote_id: quote_id, _source_module: "margin", _severity: "warn",
  });

  return jsonResponse({ ok: true, check: row });
});