// Public endpoint for the LeadCaptureWidget.
// Validates payload, inserts into public.marketing_leads with service-role,
// and fires an internal notification email to the sales inbox.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const INTERESTS = new Set(["broadband", "sim", "router", "landline", "business", "other"]);

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return bad("Method not allowed", 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  const name = String(payload.name ?? "").trim().slice(0, 120);
  const email = payload.email ? String(payload.email).trim().slice(0, 200).toLowerCase() : null;
  const phone = payload.phone ? String(payload.phone).trim().slice(0, 40) : null;
  const postcode = String(payload.postcode ?? "").trim().slice(0, 12).toUpperCase();
  const interest = String(payload.interest ?? "").trim().toLowerCase();
  const message = payload.message ? String(payload.message).slice(0, 2000) : null;
  const source = payload.source ? String(payload.source).slice(0, 120) : null;
  const pagePath = payload.page_path ? String(payload.page_path).slice(0, 300) : null;
  const utm = payload.utm && typeof payload.utm === "object" ? payload.utm : null;

  if (!name) return bad("Name is required");
  if (!postcode || !UK_POSTCODE.test(postcode)) return bad("A valid UK postcode is required");
  if (!INTERESTS.has(interest)) return bad("Choose what you're interested in");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return bad("Invalid email");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase
    .from("marketing_leads")
    .insert({
      name,
      email,
      phone,
      postcode,
      interest,
      message,
      source: source ?? "web",
      page_path: pagePath,
      utm,
    })
    .select("id")
    .single();

  if (error) {
    console.error("marketing_leads insert failed", error);
    return bad("Could not save your enquiry. Please try again.", 500);
  }

  // Fire-and-forget internal notification. Failure here must not fail the lead.
  try {
    await supabase.functions.invoke("send-email", {
      body: {
        to: "sales@occta.co.uk",
        subject: `New ${interest} lead — ${name} (${postcode})`,
        html: `
          <h2>New lead via ${source ?? "web"}</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
          <strong>Postcode:</strong> ${escapeHtml(postcode)}<br/>
          <strong>Interest:</strong> ${escapeHtml(interest)}<br/>
          <strong>Email:</strong> ${escapeHtml(email ?? "—")}<br/>
          <strong>Phone:</strong> ${escapeHtml(phone ?? "—")}<br/>
          <strong>Page:</strong> ${escapeHtml(pagePath ?? "—")}</p>
          ${message ? `<p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>` : ""}
          <p style="color:#666;font-size:12px">Lead ID: ${data.id}</p>
        `,
        internal: true,
      },
    });
  } catch (err) {
    console.error("lead notification failed", err);
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}