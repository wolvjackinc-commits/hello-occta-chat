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
    ({ data: result, error } = await supabase.from("supplier_products").update(body).eq("id", id).select().maybeSingle());
    eventType = "supplier_product_updated";
  } else {
    if (!body.supplier_id || !body.product_name || !body.service_type) return jsonResponse({ error: "missing_fields" }, 400);
    ({ data: result, error } = await supabase.from("supplier_products").insert(body).select().maybeSingle());
    eventType = "supplier_product_created";
  }
  if (error) return jsonResponse({ error: error.message }, 400);

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: eventType,
    _title: `${eventType} ${(result as any)?.product_name ?? ""}`,
    _details: { product_id: (result as any)?.id, supplier_id: (result as any)?.supplier_id },
    _source_module: "suppliers",
  });

  return jsonResponse({ ok: true, product: result });
});