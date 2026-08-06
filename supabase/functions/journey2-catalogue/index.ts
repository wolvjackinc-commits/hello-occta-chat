/**
 * Journey 2 catalogue — public, read-only.
 *
 * Returns only exactly-priced, orderable plans, routers and extras resolved
 * server-side from the authoritative pricing configuration. Never returns
 * supplier names, supplier costs, margins or internal product references.
 */
import { corsHeaders, jsonResponse, getServiceClient, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { buildCatalogue, loadJourneySettings } from "../_shared/journey2.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  customer_type: z.enum(["residential", "business"]).default("residential"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey2_catalogue", 60, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const settings = await loadJourneySettings(supabase);
  const catalogue = await buildCatalogue(supabase, settings, parsed.data.customer_type);

  return jsonResponse({ ok: true, catalogue });
});