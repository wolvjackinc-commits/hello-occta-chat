import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

const ALLOWED = ["admin", "super_admin", "finance_admin"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ALLOWED);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = body.id as string | undefined;
  delete body.id;

  const supabase = getServiceClient();
  let result, error, eventType;
  if (id) {
    ({ data: result, error } = await supabase.from("supplier_profiles").update(body).eq("id", id).select().maybeSingle());
    eventType = "supplier_updated";
  } else {
    if (!body.supplier_name || !body.supplier_type) return jsonResponse({ error: "missing_fields" }, 400);
    ({ data: result, error } = await supabase.from("supplier_profiles").insert(body).select().maybeSingle());
    eventType = "supplier_created";
  }
  if (error) return jsonResponse({ error: error.message }, 400);

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: eventType,
    _title: `${eventType} ${(result as any)?.supplier_name ?? ""}`,
    _details: { supplier_id: (result as any)?.id },
    _source_module: "suppliers",
  });

  return jsonResponse({ ok: true, supplier: result });
});