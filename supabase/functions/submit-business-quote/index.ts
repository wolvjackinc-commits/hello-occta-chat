import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RequirementValue = z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]);
const BodySchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().max(50).optional().nullable(),
  site_count: z.number().int().min(1).max(500).default(1),
  services: z.array(z.enum(["broadband", "voice", "sim", "bundle", "leased_line"])).min(1).max(5),
  requirements: z.record(RequirementValue).refine((v) => Object.keys(v).length <= 80, "Too many requirement fields").default({}),
  sla_preference: z.enum(["standard", "priority", "enhanced"]).default("standard"),
  message: z.string().max(4000).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  consent: z.literal(true),
});

type QualificationStatus = "auto_qualified" | "needs_review" | "complex";

const MARKETING_FLOOR_EX: Record<number, number> = { 80: 34.99, 160: 39.99, 330: 42.99, 550: 49.99, 1000: 59.99 };
const ENGINE_VERSION = "business_giacom_v4_2026_09_09";
const SOURCE_DOCUMENT = "giacom_broadband_ratecard_v4.0";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function round2(n: number) { return Math.round(n * 100) / 100; }
function next99(n: number) {
  const whole = Math.floor(n);
  return round2(whole + 0.99 >= n ? whole + 0.99 : whole + 1.99);
}
function addBusinessDay(from = new Date()) {
  const d = new Date(from);
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  d.setUTCHours(17, 0, 0, 0);
  return d.toISOString();
}
function makeReference() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `BQ-${day}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
function asString(v: unknown) { return typeof v === "string" ? v.trim() : v == null ? "" : String(v); }
function asNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function normaliseTech(v: unknown): "FTTP" | "SOGEA" | null {
  const s = asString(v).toLowerCase();
  if (s.includes("fttp") || s.includes("full fibre") || s.includes("full-fibre")) return "FTTP";
  if (s.includes("sogea") || s.includes("fttc")) return "SOGEA";
  return null;
}

async function qualifyBroadband(supabase: any, quote: z.infer<typeof BodySchema>) {
  const r = quote.requirements;
  const reasons: string[] = [];
  let status: QualificationStatus = "auto_qualified";

  if (quote.site_count !== 1) { status = "complex"; reasons.push("multi_site"); }
  if (quote.services.includes("leased_line")) { status = "complex"; reasons.push("dedicated_connectivity"); }
  if (quote.services.includes("bundle") || quote.services.filter((s) => s !== "broadband").length > 0) {
    if (status !== "complex") status = "needs_review";
    reasons.push("multi_service_pricing");
  }
  if (!quote.services.includes("broadband")) return { status, reasons, snapshot: { engine_version: ENGINE_VERSION, source_document: SOURCE_DOCUMENT } };

  const speed = asNumber(r.bb_speed);
  const termRaw = asString(r.term_preference);
  const term = [1, 24, 36].includes(Number(termRaw)) ? Number(termRaw) : null;
  const addressConfirmed = asString(r.availability_confirmed) === "yes" && Boolean(asString(r.selected_address));
  const maxDownload = asNumber(r.availability_max_download);
  const tech = normaliseTech(r.availability_primary_technology);
  const router = asString(r.router_preference);
  const care = asString(r.care_preference);
  const connection = asString(r.connection_type);

  if (!addressConfirmed) { if (status !== "complex") status = "needs_review"; reasons.push("address_not_live_qualified"); }
  if (!speed || !MARKETING_FLOOR_EX[speed]) { if (status !== "complex") status = "needs_review"; reasons.push("non_standard_or_unspecified_speed"); }
  if (!term) { if (status !== "complex") status = "needs_review"; reasons.push("term_not_selected"); }
  if (maxDownload != null && speed != null && speed > maxDownload) { if (status !== "complex") status = "needs_review"; reasons.push("requested_speed_above_lookup"); }
  if (care && care !== "standard") { if (status !== "complex") status = "needs_review"; reasons.push("care_upgrade_requested"); }
  if (asString(r.static_ip) === "yes") { if (status !== "complex") status = "needs_review"; reasons.push("static_ip_requested"); }
  if (asString(r.continuity) === "yes") { if (status !== "complex") status = "needs_review"; reasons.push("continuity_requested"); }
  if (router === "business") { if (status !== "complex") status = "needs_review"; reasons.push("business_wifi_requested"); }
  if (connection !== "new") { if (status !== "complex") status = "needs_review"; reasons.push(connection === "switch" ? "migration_requested" : "connection_type_unconfirmed"); }

  const snapshot: Record<string, unknown> = {
    engine_version: ENGINE_VERSION,
    source_document: SOURCE_DOCUMENT,
    requested_speed_mbps: speed,
    requested_term_months: term,
    lookup_technology: tech,
    lookup_max_download_mbps: maxDownload,
    supplier_route: "not_committed",
  };

  // Commercial guardrail: for a standard, explicit speed/term we calculate
  // against the most expensive matching active Giacom route, not the cheapest.
  // This is deliberately conservative because the public availability lookup
  // does not prove which wholesale network will be provisionable at the address.
  if (speed && term && MARKETING_FLOOR_EX[speed]) {
    const { data: profile } = await supabase.from("supplier_profiles").select("id").ilike("supplier_name", "%Giacom%").limit(1).maybeSingle();
    if (profile?.id) {
      let q = supabase.from("supplier_products")
        .select("id, product_name, network, technology, supplier_monthly_net, supplier_router_net, connection_fee_net, min_term_months, download_speed_mbps, source_document")
        .eq("supplier_id", profile.id)
        .eq("active", true)
        .eq("quote_only", false)
        .eq("service_type", "broadband")
        .eq("download_speed_mbps", speed)
        .eq("min_term_months", term);
      if (tech) q = q.ilike("technology", `%${tech}%`);
      const { data: candidates, error } = await q;
      if (error) {
        if (status !== "complex") status = "needs_review";
        reasons.push("supplier_catalogue_lookup_failed");
      } else if (!candidates?.length) {
        if (status !== "complex") status = "needs_review";
        reasons.push("no_matching_active_supplier_row");
      } else {
        const monthlyCosts = candidates.map((c: any) => Number(c.supplier_monthly_net)).filter(Number.isFinite);
        const connectionCosts = candidates.map((c: any) => Number(c.connection_fee_net ?? 0)).filter(Number.isFinite);
        const routerCosts = candidates.map((c: any) => c.supplier_router_net == null ? null : Number(c.supplier_router_net));
        const worstMonthly = Math.max(...monthlyCosts);
        const worstConnection = Math.max(0, ...connectionCosts);
        const hasUnknownRouterCost = router === "standard" && routerCosts.some((v: number | null) => v == null || !Number.isFinite(v));
        const knownRouterCosts = routerCosts.filter((v: number | null): v is number => v != null && Number.isFinite(v));
        // £3.50 operating-risk buffer + £7.50 minimum recurring contribution.
        const safeRecurring = Math.max(MARKETING_FLOOR_EX[speed], next99(worstMonthly + 11));
        const safeSetup = worstConnection > 0 ? round2(worstConnection + 5) : 0;
        const safeRouter = router === "standard" && knownRouterCosts.length ? round2(Math.max(...knownRouterCosts) + 10) : 0;
        Object.assign(snapshot, {
          active_candidate_count: candidates.length,
          worst_case_supplier_monthly_ex_vat: round2(worstMonthly),
          safe_retail_floor_monthly_ex_vat: safeRecurring,
          safe_retail_floor_monthly_inc_vat: round2(safeRecurring * 1.2),
          safe_standard_connection_ex_vat: safeSetup,
          safe_standard_connection_inc_vat: round2(safeSetup * 1.2),
          safe_standard_router_one_off_ex_vat: safeRouter || null,
          supplier_routes_considered: candidates.map((c: any) => c.network).filter(Boolean),
        });
        if (hasUnknownRouterCost) {
          if (status !== "complex") status = "needs_review";
          reasons.push("router_cost_requires_route_confirmation");
        }
      }
    } else {
      if (status !== "complex") status = "needs_review";
      reasons.push("giacom_profile_missing");
    }
  }

  return { status, reasons: [...new Set(reasons)], snapshot };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { consent: _consent, ...quote } = parsed.data;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const qualification = await qualifyBroadband(supabase, parsed.data);
    const reference = makeReference();
    const followUpDueAt = addBusinessDay();

    const { data, error } = await supabase.from("business_quote_requests").insert({
      ...quote,
      status: "new",
      reference,
      qualification_status: qualification.status,
      qualification_reasons: qualification.reasons,
      qualification_snapshot: qualification.snapshot,
      follow_up_due_at: followUpDueAt,
    }).select("id, reference").single();

    if (error) {
      console.error("business quote insert failed", error);
      return new Response(JSON.stringify({ error: "Failed to save quote request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const servicesList = quote.services.map(escapeHtml).join(", ");
    const reqLines = Object.entries(quote.requirements ?? {}).filter(([, v]) => v !== null && String(v).trim() !== "").map(([k, v]) => `<li><strong>${escapeHtml(k.replaceAll("_", " "))}:</strong> ${escapeHtml(v)}</li>`).join("");
    const preview = qualification.snapshot as Record<string, unknown>;
    const commercialHtml = preview.safe_retail_floor_monthly_ex_vat != null
      ? `<p><strong>Internal safe retail floor:</strong> £${escapeHtml(preview.safe_retail_floor_monthly_ex_vat)} ex VAT / £${escapeHtml(preview.safe_retail_floor_monthly_inc_vat)} inc VAT per month.<br/><strong>Safe standard connection:</strong> £${escapeHtml(preview.safe_standard_connection_ex_vat ?? 0)} ex VAT.</p>`
      : "<p><strong>Internal pricing:</strong> manual commercial review required.</p>";

    // Best-effort internal alert. send-email supports custom_admin, not the old
    // internal_alert type; using the supported type fixes previously silent 400s.
    try {
      const internalSubject = `Business quote ${reference} — ${quote.company_name}`;
      const { error: notifyError } = await supabase.functions.invoke("send-email", {
        body: {
          type: "custom_admin",
          to: "business@occta.co.uk",
          data: {
            subject: internalSubject,
            title: "New business quote request",
            greeting: "Business team",
            message_html: `<p><strong>Reference:</strong> ${escapeHtml(reference)}</p><p><strong>Company:</strong> ${escapeHtml(quote.company_name)}</p><p><strong>Contact:</strong> ${escapeHtml(quote.contact_name)} — ${escapeHtml(quote.email)}${quote.phone ? " · " + escapeHtml(quote.phone) : ""}</p><p><strong>Sites:</strong> ${quote.site_count} · <strong>Qualification:</strong> ${escapeHtml(qualification.status)}</p><p><strong>Reasons:</strong> ${escapeHtml(qualification.reasons.join(", ") || "none")}</p><p><strong>Services:</strong> ${servicesList}</p>${reqLines ? `<p><strong>Requirements:</strong></p><ul>${reqLines}</ul>` : ""}${commercialHtml}<p><strong>Follow-up due:</strong> ${escapeHtml(followUpDueAt)}</p><p><strong>Message:</strong><br/>${escapeHtml(quote.message ?? "—").replace(/\n/g, "<br/>")}</p>`,
          },
        },
      });
      if (notifyError) console.error("internal quote notification failed", notifyError);
    } catch (e) { console.error("internal quote notification exception", e); }

    let acknowledged = false;
    try {
      const customerSubject = `We received your OCCTA business quote request — ${reference}`;
      const { error: ackError } = await supabase.functions.invoke("send-email", {
        body: {
          type: "custom_admin",
          to: quote.email,
          data: {
            subject: customerSubject,
            title: "Business quote request received",
            greeting: `Hi ${quote.contact_name}`,
            message_html: `<p>Thanks for asking OCCTA to quote for <strong>${escapeHtml(quote.company_name)}</strong>.</p><p>Your reference is <strong>${escapeHtml(reference)}</strong>.</p><p>We have recorded your requested services and site information. We now validate the available network route, commercial term, setup, equipment and any care options against our current supplier catalogue.</p><p><strong>This acknowledgement is not a supplier order or a contract.</strong> Nothing is provisioned and no different plan or price is substituted without your agreement. Your final quote and Contract Summary show the applicable ex-VAT and inc-VAT charges before acceptance.</p>`,
          },
        },
      });
      if (!ackError) {
        acknowledged = true;
        await supabase.from("business_quote_requests").update({ customer_acknowledged_at: new Date().toISOString() }).eq("id", data.id);
      } else console.error("customer quote acknowledgement failed", ackError);
    } catch (e) { console.error("customer quote acknowledgement exception", e); }

    return new Response(JSON.stringify({ id: data.id, reference: data.reference, qualification_status: qualification.status, acknowledged, ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("business quote unhandled", e);
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});