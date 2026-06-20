import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

/**
 * Clones a locked/sent quote into a new draft revision. The new quote inherits
 * pricing, line items, supplier, and speed estimate from the source. Admin can
 * then adjust and send the revision. Source quote keeps its history.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({}));
  const source_quote_id: string | undefined = body?.source_quote_id;
  if (!source_quote_id) return jsonResponse({ error: "missing_source_quote_id" }, 400);

  const supabase = getServiceClient();
  const { data: src, error } = await supabase.from("quotes").select("*").eq("id", source_quote_id).maybeSingle();
  if (error || !src) return jsonResponse({ error: "not_found" }, 404);

  // Copy fields, reset lifecycle, link revision_of
  const expiresAt = new Date(Date.now() + 14 * 86400_000).toISOString();
  const insertRow: Record<string, unknown> = {
    quote_request_id: src.quote_request_id,
    customer_id: src.customer_id,
    supplier_name: src.supplier_name,
    supplier_product_id: src.supplier_product_id,
    supplier_reference: src.supplier_reference,
    plan_name: src.plan_name,
    service_type: src.service_type,
    plan_type: src.plan_type,
    customer_type: src.customer_type,
    contract_length_months: src.contract_length_months,
    monthly_net: src.monthly_net, monthly_vat_rate: src.monthly_vat_rate, monthly_vat_amount: src.monthly_vat_amount, monthly_gross: src.monthly_gross,
    setup_net: src.setup_net, setup_vat_amount: src.setup_vat_amount, setup_gross: src.setup_gross,
    router_net: src.router_net, router_vat_amount: src.router_vat_amount, router_gross: src.router_gross,
    delivery_net: src.delivery_net, delivery_vat_amount: src.delivery_vat_amount, delivery_gross: src.delivery_gross,
    installation_net: src.installation_net, installation_vat_amount: src.installation_vat_amount, installation_gross: src.installation_gross,
    cease_fee_gross: src.cease_fee_gross,
    total_due_today_gross: src.total_due_today_gross,
    estimated_download_speed: src.estimated_download_speed,
    estimated_upload_speed: src.estimated_upload_speed,
    speed_notes: src.speed_notes,
    speed_disclaimer: src.speed_disclaimer,
    extra_line_items: src.extra_line_items ?? [],
    reward_eligibility: src.reward_eligibility,
    expires_at: expiresAt,
    token_expires_at: expiresAt,
    public_token_hash: null,
    admin_notes: `[Revision of ${src.quote_number}]\n${src.admin_notes ?? ""}`,
    customer_notes: src.customer_notes,
    created_by: auth.userId,
    status: "draft",
    revision_of_quote_id: src.id,
    parent_quote_id: src.parent_quote_id ?? src.id,
    speed_bucket: src.speed_bucket,
    plan_term: src.plan_term,
    router_option: src.router_option,
    setup_option: src.setup_option,
    selected_addons: src.selected_addons,
  };

  const { data: newQuote, error: insErr } = await supabase.from("quotes").insert(insertRow).select("id, quote_number").single();
  if (insErr || !newQuote) return jsonResponse({ error: "create_failed", details: insErr?.message }, 500);

  await supabase.rpc("log_event", {
    _actor_type: "admin", _event_type: "quote_revision_created",
    _title: `Quote revision created ${newQuote.quote_number} from ${src.quote_number}`,
    _details: { source_quote_id: src.id, new_quote_id: newQuote.id },
    _source_module: "quote", _quote_id: newQuote.id,
  });
  await supabase.from("quote_events").insert({
    quote_id: newQuote.id, quote_request_id: src.quote_request_id,
    event_type: "quote_revision_created",
    title: `Revision of ${src.quote_number} created — ${newQuote.quote_number}`,
    actor_type: "admin", actor_id: auth.userId,
  });

  return jsonResponse({ ok: true, quote_id: newQuote.id, quote_number: newQuote.quote_number });
});