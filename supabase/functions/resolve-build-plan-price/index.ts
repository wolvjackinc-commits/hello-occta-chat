// Resolve Build Your Plan customer pricing — preview endpoint.
// Delegates all logic to _shared/buildPlanResolver and strips internal fields.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { resolveBuildPlanPrice } from "../_shared/buildPlanResolver.ts";

const BodySchema = z.object({
  speed_bucket: z.enum(["essential", "superfast", "ultrafast", "gigabit"]),
  plan_term: z.enum(["price_lock_24", "flex_30"]),
  router_option: z.enum(["own", "standard", "premium", "business"]),
  router_payment_type: z.enum(["none", "one_off", "monthly"]).default("none"),
  setup_option: z.enum(["remote", "standard", "engineer", "complex"]),
  addons: z.array(z.enum(["priority_support", "static_ip", "digital_voice", "paper_billing"])).default([]),
  customer_type: z.enum(["residential", "business"]).default("residential"),
  max_download: z.number().int().min(0).max(100000).optional(),
  primary_technology: z.string().max(40).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "validation", details: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: settings } = await supabase
    .from("platform_settings").select("fair_pricing").eq("singleton", true).maybeSingle();

  const result = resolveBuildPlanPrice(parsed.data as any, settings?.fair_pricing ?? {});

  // Strip internal block before returning to browser.
  const safe = { ...result } as any;
  if ("internal" in safe) delete safe.internal;
  return new Response(JSON.stringify(safe), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});