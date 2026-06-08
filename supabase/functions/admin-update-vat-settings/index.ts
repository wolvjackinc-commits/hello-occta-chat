import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";

const ALLOWED = ["admin", "super_admin", "finance_admin"];
const EDITABLE = new Set([
  "vat_number", "vat_effective_date", "vat_scheme", "vat_default_rate",
  "residential_vat_display", "business_vat_display",
  "invoice_prefix", "credit_note_prefix",
  "api_mode", "sim_checkout_mode",
  "rewards_enabled", "rewards_unlock_rule",
  "manual_mode_message",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ALLOWED);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object") return jsonResponse({ error: "invalid_body" }, 400);

  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) return jsonResponse({ error: "no_editable_fields" }, 400);

  // Force VAT scheme to Standard VAT Accounting
  if ("vat_scheme" in updates) updates.vat_scheme = "Standard VAT Accounting";
  // Residential locked inclusive; business locked dual
  if ("residential_vat_display" in updates) updates.residential_vat_display = "inclusive";
  if ("business_vat_display" in updates) updates.business_vat_display = "dual";

  const supabase = getServiceClient();
  const { data: before } = await supabase.from("platform_settings").select("*").eq("singleton", true).maybeSingle();

  const { data: after, error } = await supabase
    .from("platform_settings")
    .update({ ...updates, updated_by: auth.userId })
    .eq("singleton", true)
    .select()
    .maybeSingle();
  if (error) return jsonResponse({ error: "update_failed", details: error.message }, 500);

  // Compute diff with only changed fields (avoid logging full snapshots).
  const changed: Record<string, { old: unknown; new: unknown }> = {};
  for (const k of Object.keys(updates)) {
    const ov = (before as any)?.[k] ?? null;
    const nv = (after as any)?.[k] ?? null;
    if (JSON.stringify(ov) !== JSON.stringify(nv)) changed[k] = { old: ov, new: nv };
  }

  await supabase.rpc("log_event", {
    _actor_type: "admin",
    _event_type: "vat_settings_updated",
    _title: "Platform/VAT settings updated",
    _details: { changed_fields: Object.keys(changed) },
    _old_value: changed as any,
    _new_value: null,
    _source_module: "settings",
    _severity: "warn",
  });

  return jsonResponse({ ok: true, fields_changed: Object.keys(changed) });
});