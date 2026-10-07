import { corsHeaders, jsonResponse, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

// Supplier-neutral availability state. OCCTA has no live supplier feed here,
// so this never invents availability or speeds and never reports
// "unavailable" just because no feed exists. The postal address is echoed so
// the customer can continue; network validation happens before any binding
// contract is issued.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "check_availability", 10, 300))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const body = await req.json().catch(() => null);
  const a = body?.address;
  const line1 = String(a?.address_line_1 ?? a?.premises_name ?? "").trim();
  if (!a || typeof a !== "object" || !line1 || !String(a.postcode ?? "").trim()) {
    return jsonResponse({ error: "full_address_required" }, 400);
  }
  const address = {
    address_line_1: line1.slice(0, 200),
    address_line_2: a.address_line_2 ? String(a.address_line_2).slice(0, 200) : null,
    town: (a.town ?? a.post_town) ? String(a.town ?? a.post_town).slice(0, 100) : null,
    county: a.county ? String(a.county).slice(0, 100) : null,
    postcode: String(a.postcode).toUpperCase().slice(0, 10),
  };

  return jsonResponse({
    status: "pending_network_validation",
    network_validation_required: true,
    canContinue: true,
    available: null,
    verifiedExactAddress: false,
    eligibleOcctaPlans: [],
    selectedAddress: address,
    message: "You can continue with your order. OCCTA will confirm the exact network technology, speed and availability at this address before your binding broadband contract is issued.",
  });
});
