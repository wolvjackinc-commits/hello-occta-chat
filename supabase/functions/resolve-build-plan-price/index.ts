// Resolve Build Your Plan customer pricing — preview endpoint.
// Delegates all logic to _shared/buildPlanResolver and strips internal fields.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  resolveBuildPlanPrice, loadGiacomCandidates, stripInternal,
  RESOLVER_VERSION, LOADER_FAILURE_QUOTE_ONLY,
} from "../_shared/buildPlanResolver.ts";

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
  // Admin-only test fixture. Server re-verifies admin role before honouring.
  test_availability: z.object({
    max_download: z.number().int().min(0).max(100000),
    primary_technology: z.string().max(40).optional(),
  }).optional(),
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

  // Admin gate for test_availability — verify the JWT belongs to an admin.
  let isAdmin = false;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data: u } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (u?.user) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    }
  }

  const input: any = { ...parsed.data };
  if (parsed.data.test_availability && isAdmin) {
    input.max_download = parsed.data.test_availability.max_download;
    if (parsed.data.test_availability.primary_technology) {
      input.primary_technology = parsed.data.test_availability.primary_technology;
    }
  }
  delete input.test_availability;

  const { data: settings } = await supabase
    .from("platform_settings").select("fair_pricing").eq("singleton", true).maybeSingle();

  let candidates;
  try {
    candidates = await loadGiacomCandidates(supabase, parsed.data.speed_bucket);
  } catch (_e) {
    const safe = stripInternal(LOADER_FAILURE_QUOTE_ONLY as any);
    if (parsed.data.test_availability && isAdmin) (safe as any).resolver_version = RESOLVER_VERSION;
    return new Response(JSON.stringify(safe), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const result = resolveBuildPlanPrice(input as any, settings?.fair_pricing ?? {}, candidates);

  // Strip internal block + any supplier_ / margin / ratecard fields.
  const safe = stripInternal(result as any);
  // Admin/test-only deployment parity marker. Never exposes supplier data.
  if (parsed.data.test_availability && isAdmin) (safe as any).resolver_version = RESOLVER_VERSION;
  return new Response(JSON.stringify(safe), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});