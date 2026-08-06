// Admin-only CSV importer for Giacom (and other) supplier broadband products.
// Requires admin/super_admin JWT. Allowlist columns only. Rows imported with
// active=false; admin must explicitly activate before public resolver uses them.

import { corsHeaders, jsonResponse, getServiceClient, requireStaff } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const RowSchema = z.object({
  supplier_product_id: z.string().trim().min(1).max(160),
  product_name: z.string().trim().min(1).max(220),
  network: z.string().trim().max(80).optional().nullable(),
  technology: z.string().trim().max(40).optional().nullable(),
  download_speed_mbps: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  upload_speed_mbps: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  min_term_months: z.coerce.number().int().min(0).max(60).optional().nullable(),
  supplier_monthly_net: z.coerce.number().min(0).max(10000).optional().nullable(),
  connection_fee_net: z.coerce.number().min(0).max(10000).optional().nullable(),
  migration_fee_net: z.coerce.number().min(0).max(10000).optional().nullable(),
  care_level: z.string().trim().max(40).optional().nullable(),
  care_level_uplift_net: z.coerce.number().min(0).max(10000).optional().nullable(),
  router_compatible: z.string().trim().max(80).optional().nullable(),
  router_required: z.coerce.boolean().optional().default(false),
  router_notes: z.string().trim().max(500).optional().nullable(),
  etf_applies: z.coerce.boolean().optional().default(false),
  disconnect_fee_in_12m_net: z.coerce.number().min(0).max(10000).optional().nullable(),
  disconnect_fee_after_12m_net: z.coerce.number().min(0).max(10000).optional().nullable(),
  bucket_hint: z.enum(["essential","superfast","ultrafast","gigabit"]).optional().nullable(),
  notes: z.string().trim().max(800).optional().nullable(),
  source_document: z.string().trim().max(200).optional().nullable(),
  source_page: z.string().trim().max(40).optional().nullable(),
  source_section: z.string().trim().max(200).optional().nullable(),
});

const BodySchema = z.object({
  supplier_name: z.string().trim().min(1).max(120).default("Giacom"),
  rows: z.array(RowSchema).min(1).max(500),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireStaff(req, ["admin", "super_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const supabase = getServiceClient();
  const { data: profile, error: profErr } = await supabase
    .from("supplier_profiles").select("id").eq("supplier_name", parsed.data.supplier_name).maybeSingle();
  if (profErr || !profile) return jsonResponse({ error: "supplier_not_found" }, 404);

  // Upsert key = (supplier_id, supplier_product_id). Always import active=false.
  let inserted = 0, updated = 0;
  const errors: string[] = [];
  for (const r of parsed.data.rows) {
    const row = {
      supplier_id: profile.id,
      supplier_product_id: r.supplier_product_id,
      product_name: r.product_name,
      service_type: "broadband",
      network: r.network ?? null,
      technology: r.technology ?? null,
      download_speed_mbps: r.download_speed_mbps ?? null,
      upload_speed_mbps: r.upload_speed_mbps ?? null,
      min_term_months: r.min_term_months ?? null,
      supplier_monthly_net: r.supplier_monthly_net ?? null,
      connection_fee_net: r.connection_fee_net ?? null,
      migration_fee_net: r.migration_fee_net ?? null,
      care_level: r.care_level ?? null,
      care_level_uplift_net: r.care_level_uplift_net ?? null,
      router_compatible: r.router_compatible ?? null,
      router_required: r.router_required ?? false,
      router_notes: r.router_notes ?? null,
      etf_applies: r.etf_applies ?? false,
      disconnect_fee_in_12m_net: r.disconnect_fee_in_12m_net ?? null,
      disconnect_fee_after_12m_net: r.disconnect_fee_after_12m_net ?? null,
      bucket_hint: r.bucket_hint ?? null,
      notes: r.notes ?? null,
      source_document: r.source_document ?? null,
      source_page: r.source_page ?? null,
      source_section: r.source_section ?? null,
      active: false,
      quote_only: false,
      supplier_vat_rate: 20,
      reverse_charge: false,
    };
    const { data: existing } = await supabase
      .from("supplier_products").select("id")
      .eq("supplier_id", profile.id).eq("supplier_product_id", r.supplier_product_id).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("supplier_products").update(row).eq("id", existing.id);
      if (error) errors.push(`${r.supplier_product_id}: ${error.message}`); else updated++;
    } else {
      const { error } = await supabase.from("supplier_products").insert(row);
      if (error) errors.push(`${r.supplier_product_id}: ${error.message}`); else inserted++;
    }
  }

  await supabase.rpc("log_audit_action", {
    _action: "supplier_products_import",
    _entity: "supplier_products",
    _metadata: { supplier: parsed.data.supplier_name, inserted, updated, error_count: errors.length },
  });

  return jsonResponse({ ok: true, inserted, updated, errors: errors.slice(0, 20) });
});