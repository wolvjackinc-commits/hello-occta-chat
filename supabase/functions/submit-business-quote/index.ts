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
  site_count: z.number().int().min(1).max(1000).default(1),
  services: z.array(z.string()).min(1).max(20),
  requirements: z.record(z.any()).default({}),
  sla_preference: z.enum(["standard", "priority", "enhanced"]).default("standard"),
  message: z.string().max(4000).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  consent: z.boolean().optional(),
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
    const { consent: _c, ...quote } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("business_quote_requests")
      .insert({ ...quote, status: "new" })
      .select("id")
      .single();

    if (error) {
      console.error("insert failed", error);
      return new Response(JSON.stringify({ error: "Failed to save quote request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      const servicesList = quote.services.map(escapeHtml).join(", ");
      const reqLines = Object.entries(quote.requirements ?? {})
        .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`)
        .join("");
      await supabase.functions.invoke("send-email", {
        body: {
          type: "internal_alert",
          to: "business@occta.co.uk",
          subject: `New business quote request — ${quote.company_name}`,
          message_html: `<h2>New business quote request</h2>
            <p><strong>Company:</strong> ${escapeHtml(quote.company_name)}</p>
            <p><strong>Contact:</strong> ${escapeHtml(quote.contact_name)} — ${escapeHtml(quote.email)}${quote.phone ? " · " + escapeHtml(quote.phone) : ""}</p>
            <p><strong>Sites:</strong> ${quote.site_count} · <strong>SLA:</strong> ${escapeHtml(quote.sla_preference)}</p>
            <p><strong>Services:</strong> ${servicesList}</p>
            ${reqLines ? `<p><strong>Requirements:</strong></p><ul>${reqLines}</ul>` : ""}
            <p><strong>Message:</strong><br/>${escapeHtml(quote.message ?? "—").replace(/\n/g, "<br/>")}</p>
            <p><strong>Source:</strong> ${escapeHtml(quote.source ?? "—")}</p>`,
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