// log-event — client-facing universal activity log writer.
//
// SECURITY:
// - Only LOW-RISK event_types may be written from the client.
// - Sensitive events (vat_change, payment_status_change, quote_approval,
//   invoice_edit, payment_override, reward_approval, campaign_publish,
//   contract_summary_change, role_change) MUST come from server-side/admin
//   code paths — never from this endpoint.
// - No PII like card numbers, sort codes, full bank account numbers, passwords
//   or tokens are accepted; the log_event SQL function strips obvious sensitive
//   keys defensively, but we also reject them up-front here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOW_RISK_EVENT_TYPES = new Set([
  "page_view",
  "cta_click",
  "quote_start",
  "postcode_check",
  "form_submit",
  "contract_summary_view",
  "legal_view",
]);

const FORBIDDEN_DETAIL_KEYS = new Set([
  "password",
  "card_number",
  "cvv",
  "token",
  "access_token",
  "refresh_token",
  "sort_code",
  "account_number_full",
  "bank_account",
  "secret",
  "api_key",
]);

function sanitiseDetails(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_DETAIL_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === "string" && v.length > 500) {
      out[k] = v.slice(0, 500);
    } else if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      v === null
    ) {
      out[k] = v;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = String(body.event_type ?? "").trim();
    const title = String(body.title ?? "").trim();
    const sourceModule = String(body.source_module ?? "web").slice(0, 64);
    const details = sanitiseDetails(body.details);

    if (!LOW_RISK_EVENT_TYPES.has(eventType)) {
      return new Response(
        JSON.stringify({ error: "event_type not permitted from client" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!title || title.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify actor from JWT (optional)
    let actorId: string | null = null;
    let actorType: "customer" | "anon" = "anon";
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supa = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: u } = await supa.auth.getUser();
        if (u?.user) {
          actorId = u.user.id;
          actorType = "customer";
        }
      } catch {
        // ignore; treat as anonymous
      }
    }

    // Use service role to write via SECURITY DEFINER log_event()
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;

    const { error } = await admin.rpc("log_event", {
      _actor_type: actorType,
      _event_type: eventType,
      _title: title,
      _details: details,
      _customer_id: actorId,
      _ip: ip,
      _ua: ua,
      _source_module: sourceModule,
      _severity: "info",
    });

    if (error) {
      console.error("[log-event] rpc error:", error.message);
      return new Response(JSON.stringify({ error: "Log write failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[log-event] error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
