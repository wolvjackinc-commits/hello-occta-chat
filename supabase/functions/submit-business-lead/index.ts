import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  company_name: z.string().min(1).max(200),
  contact_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(50).optional().nullable(),
  postcode: z.string().max(20).optional().nullable(),
  team_size: z.string().max(20).optional().nullable(),
  interest: z.string().max(50).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  consent: z.boolean().optional(),
  // Extended fields
  sla_preference: z.enum(["standard", "priority", "enhanced"]).optional(),
  secondary_contact_name: z.string().max(200).optional().nullable(),
  secondary_contact_email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  secondary_contact_phone: z.string().max(50).optional().nullable(),
  billing_contact_name: z.string().max(200).optional().nullable(),
  billing_contact_email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  billing_contact_phone: z.string().max(50).optional().nullable(),
  site_address_line1: z.string().max(200).optional().nullable(),
  site_address_line2: z.string().max(200).optional().nullable(),
  site_city: z.string().max(100).optional().nullable(),
  site_postcode: z.string().max(20).optional().nullable(),
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { consent: _c, ...lead } = parsed.data;
    // Normalise empty strings to null so validation/CHECK constraints stay happy.
    const cleaned = Object.fromEntries(
      Object.entries(lead).map(([k, v]) => [k, v === "" ? null : v]),
    ) as typeof lead;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("business_leads")
      .insert({ ...cleaned, status: "new" })
      .select("id")
      .single();

    if (error) {
      console.error("insert failed", error);
      return new Response(JSON.stringify({ error: "Failed to save lead" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Best-effort internal notification (do not fail the lead if it errors)
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          type: "internal_alert",
          to: "business@occta.co.uk",
          subject: `New business lead — ${lead.company_name}`,
          message_html: `<h2>New business lead</h2>
            <p><strong>Company:</strong> ${escapeHtml(lead.company_name)}</p>
            <p><strong>Contact:</strong> ${escapeHtml(lead.contact_name)} — ${escapeHtml(lead.email)}${lead.phone ? " · " + escapeHtml(lead.phone) : ""}</p>
            <p><strong>Postcode:</strong> ${escapeHtml(lead.postcode ?? "—")} · <strong>Team:</strong> ${escapeHtml(lead.team_size ?? "—")} · <strong>Interest:</strong> ${escapeHtml(lead.interest ?? "—")}</p>
            <p><strong>SLA preference:</strong> ${escapeHtml(lead.sla_preference ?? "standard")}</p>
            ${lead.billing_contact_name || lead.billing_contact_email ? `<p><strong>Billing contact:</strong> ${escapeHtml(lead.billing_contact_name ?? "")} — ${escapeHtml(lead.billing_contact_email ?? "")}</p>` : ""}
            ${lead.secondary_contact_name ? `<p><strong>Secondary contact:</strong> ${escapeHtml(lead.secondary_contact_name)} — ${escapeHtml(lead.secondary_contact_email ?? "")}</p>` : ""}
            ${lead.site_address_line1 ? `<p><strong>Site:</strong> ${escapeHtml(lead.site_address_line1)}${lead.site_address_line2 ? ", " + escapeHtml(lead.site_address_line2) : ""}, ${escapeHtml(lead.site_city ?? "")} ${escapeHtml(lead.site_postcode ?? "")}</p>` : ""}
            <p><strong>Message:</strong><br/>${escapeHtml(lead.message ?? "—").replace(/\n/g, "<br/>")}</p>
            <p><strong>Source:</strong> ${escapeHtml(lead.source ?? "—")}</p>`,
        },
        headers: { "x-internal-secret": Deno.env.get("CRON_JOB_SECRET") ?? "" },
      });
    } catch (e) {
      console.error("notify failed", e);
    }

    return new Response(JSON.stringify({ id: data.id, ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("unhandled", e);
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});